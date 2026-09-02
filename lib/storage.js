const fs = require('fs');
const path = require('path');
const axios = require('axios');

const IS_VERCEL = !!process.env.VERCEL;

// File paths
const LOCAL_BOTS_FILE = path.join(process.cwd(), 'bots.json');
const LOCAL_STATS_FILE = path.join(process.cwd(), 'stats.json');
const TMP_BOTS_FILE = path.join('/tmp', 'bots.json');
const TMP_STATS_FILE = path.join('/tmp', 'api_stats.json');

// MongoDB Atlas configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.STORAGE_URL || process.env.DATABASE_URL || null;

// Upstash / Vercel KV REST configuration
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL || null;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN || null;

const DEFAULT_BOTS = [
    {
        id: "bot_1",
        uid: process.env.BOT_UID || "7403290144",
        password: process.env.BOT_PASSWORD || "10FA10F1D5D1694D64518D7F6CB8CE92720C5F34B33BAC77E2C440ADE6977913",
        label: "Primary Guest Bot",
        status: "active",
        addedAt: new Date().toISOString()
    }
];

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

// In-memory shared cache
let memoryBots = null;
let memoryStats = null;
let redisAvailable = null;
let mongoAvailable = null;
let cachedMongoClient = null;

/**
 * Get MongoDB Database instance (with connection reuse for Serverless)
 */
async function getMongoDb() {
    if (!MONGODB_URI) return null;
    try {
        if (!cachedMongoClient) {
            const { MongoClient } = require('mongodb');
            cachedMongoClient = new MongoClient(MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000
            });
            await cachedMongoClient.connect();
        }
        mongoAvailable = true;
        return cachedMongoClient.db('ff_api_db');
    } catch (err) {
        console.warn('[Storage] MongoDB connection error:', err.message);
        mongoAvailable = false;
        return null;
    }
}

/**
 * Execute a command on Upstash Redis REST API
 */
async function redisCommand(command, ...args) {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    try {
        const cleanUrl = REDIS_URL.replace(/\/$/, '');
        const cmdParts = [command, ...args].map(encodeURIComponent).join('/');
        const response = await axios.get(`${cleanUrl}/${cmdParts}`, {
            headers: {
                Authorization: `Bearer ${REDIS_TOKEN}`
            },
            timeout: 3500
        });
        redisAvailable = true;
        return response.data && response.data.result !== undefined ? response.data.result : null;
    } catch (err) {
        console.warn(`[Storage] Upstash Redis command "${command}" failed:`, err.message);
        redisAvailable = false;
        return null;
    }
}

/**
 * Set a JSON value in Upstash Redis
 */
async function redisSet(key, value) {
    if (!REDIS_URL || !REDIS_TOKEN) return false;
    try {
        const cleanUrl = REDIS_URL.replace(/\/$/, '');
        await axios.post(`${cleanUrl}/set/${encodeURIComponent(key)}`, JSON.stringify(value), {
            headers: {
                Authorization: `Bearer ${REDIS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 3500
        });
        redisAvailable = true;
        return true;
    } catch (err) {
        console.warn(`[Storage] Upstash Redis SET failed:`, err.message);
        redisAvailable = false;
        return false;
    }
}

/**
 * Read bots from disk/tmp safely
 */
function readBotsFromDisk() {
    if (IS_VERCEL) {
        try {
            if (fs.existsSync(TMP_BOTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(TMP_BOTS_FILE, 'utf-8'));
                if (Array.isArray(data) && data.length > 0) return data;
            }
        } catch (e) {}
    }

    try {
        if (fs.existsSync(LOCAL_BOTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(LOCAL_BOTS_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data;
        }
    } catch (e) {}

    return DEFAULT_BOTS;
}

/**
 * Write bots to disk/tmp safely without crashing on readonly file systems
 */
function writeBotsToDisk(bots) {
    if (IS_VERCEL) {
        try {
            fs.writeFileSync(TMP_BOTS_FILE, JSON.stringify(bots, null, 2), 'utf-8');
        } catch (e) {}
    }

    try {
        fs.writeFileSync(LOCAL_BOTS_FILE, JSON.stringify(bots, null, 2), 'utf-8');
    } catch (e) {}
}

/**
 * Load bots pool with automatic Cloud (MongoDB Atlas / Upstash Redis) sync & Fallback
 */
async function loadBots() {
    // 1. Try MongoDB Atlas (Primary Cloud Persistence)
    if (MONGODB_URI) {
        const db = await getMongoDb();
        if (db) {
            try {
                const col = db.collection('settings');
                const doc = await col.findOne({ _id: 'bots_pool' });
                if (doc && Array.isArray(doc.bots) && doc.bots.length > 0) {
                    memoryBots = doc.bots;
                    writeBotsToDisk(memoryBots);
                    return memoryBots;
                } else {
                    // Seed initial bots into MongoDB Atlas
                    const initial = readBotsFromDisk();
                    await col.updateOne(
                        { _id: 'bots_pool' },
                        { $set: { bots: initial, updatedAt: new Date() } },
                        { upsert: true }
                    );
                    memoryBots = initial;
                    writeBotsToDisk(memoryBots);
                    return memoryBots;
                }
            } catch (e) {
                console.warn('[Storage] Error loading bots from MongoDB:', e.message);
            }
        }
    }

    // 2. Try Upstash Redis
    if (REDIS_URL && REDIS_TOKEN) {
        const cloudBots = await redisCommand('get', 'ff_bots');
        if (cloudBots) {
            try {
                const parsed = typeof cloudBots === 'string' ? JSON.parse(cloudBots) : cloudBots;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    memoryBots = parsed;
                    writeBotsToDisk(memoryBots);
                    return memoryBots;
                }
            } catch (e) {}
        }
    }

    // 3. Return memory cache if available
    if (memoryBots && Array.isArray(memoryBots) && memoryBots.length > 0) {
        return memoryBots;
    }

    // 4. Load from disk/tmp
    memoryBots = readBotsFromDisk();
    return memoryBots;
}

/**
 * Synchronous get of bots from memory cache
 */
function getBotsSync() {
    if (memoryBots && Array.isArray(memoryBots) && memoryBots.length > 0) {
        return memoryBots;
    }
    memoryBots = readBotsFromDisk();
    return memoryBots;
}

/**
 * Get active (non-disabled) bots
 */
async function getActiveBots() {
    const bots = await loadBots();
    const active = bots.filter(b => b.status !== 'disabled');
    return active.length > 0 ? active : DEFAULT_BOTS;
}

/**
 * Synchronous get active bots
 */
function getActiveBotsSync() {
    const bots = getBotsSync();
    const active = bots.filter(b => b.status !== 'disabled');
    return active.length > 0 ? active : DEFAULT_BOTS;
}

/**
 * Save bots pool (saves to MongoDB Atlas + Redis + /tmp + local disk + memory)
 */
async function saveBots(bots) {
    memoryBots = bots;
    writeBotsToDisk(bots);

    // Persist to MongoDB Atlas
    if (MONGODB_URI) {
        const db = await getMongoDb();
        if (db) {
            try {
                await db.collection('settings').updateOne(
                    { _id: 'bots_pool' },
                    { $set: { bots, updatedAt: new Date() } },
                    { upsert: true }
                );
            } catch (e) {
                console.warn('[Storage] Error saving bots to MongoDB:', e.message);
            }
        }
    }

    // Persist to Upstash Redis if configured
    if (REDIS_URL && REDIS_TOKEN) {
        await redisSet('ff_bots', bots);
    }

    return true;
}

/**
 * Read stats from disk/tmp safely
 */
function readStatsFromDisk() {
    const statFile = IS_VERCEL ? TMP_STATS_FILE : LOCAL_STATS_FILE;
    try {
        if (fs.existsSync(statFile)) {
            const data = JSON.parse(fs.readFileSync(statFile, 'utf-8'));
            if (data && data.date) return data;
        }
    } catch (e) {}

    try {
        if (fs.existsSync(LOCAL_STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(LOCAL_STATS_FILE, 'utf-8'));
            if (data && data.date) return data;
        }
    } catch (e) {}

    return {
        date: getTodayStr(),
        todayRequests: 0,
        todaySuccess: 0,
        totalRequests: 0,
        totalSuccess: 0,
        lastRequestAt: null
    };
}

/**
 * Write stats to disk/tmp safely
 */
function writeStatsToDisk(stats) {
    if (IS_VERCEL) {
        try {
            fs.writeFileSync(TMP_STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
        } catch (e) {}
    }
    try {
        fs.writeFileSync(LOCAL_STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
    } catch (e) {}
}

/**
 * Load API Statistics
 */
async function loadStats() {
    const today = getTodayStr();

    // 1. Try MongoDB Atlas
    if (MONGODB_URI) {
        const db = await getMongoDb();
        if (db) {
            try {
                const col = db.collection('analytics');
                const doc = await col.findOne({ _id: 'api_stats' });
                if (doc && doc.date) {
                    memoryStats = {
                        date: doc.date,
                        todayRequests: doc.todayRequests || 0,
                        todaySuccess: doc.todaySuccess || 0,
                        totalRequests: doc.totalRequests || 0,
                        totalSuccess: doc.totalSuccess || 0,
                        lastRequestAt: doc.lastRequestAt || null
                    };
                    if (memoryStats.date !== today) {
                        memoryStats.date = today;
                        memoryStats.todayRequests = 0;
                        memoryStats.todaySuccess = 0;
                        col.updateOne({ _id: 'api_stats' }, { $set: { date: today, todayRequests: 0, todaySuccess: 0 } }).catch(() => {});
                    }
                    writeStatsToDisk(memoryStats);
                    return memoryStats;
                }
            } catch (e) {}
        }
    }

    // 2. Try Upstash Redis
    if (REDIS_URL && REDIS_TOKEN) {
        const cloudStats = await redisCommand('get', 'ff_stats');
        if (cloudStats) {
            try {
                const parsed = typeof cloudStats === 'string' ? JSON.parse(cloudStats) : cloudStats;
                if (parsed && parsed.date) {
                    memoryStats = parsed;
                    if (memoryStats.date !== today) {
                        memoryStats.date = today;
                        memoryStats.todayRequests = 0;
                        memoryStats.todaySuccess = 0;
                        await redisSet('ff_stats', memoryStats);
                    }
                    writeStatsToDisk(memoryStats);
                    return memoryStats;
                }
            } catch (e) {}
        }
    }

    if (!memoryStats) {
        memoryStats = readStatsFromDisk();
    }

    if (memoryStats.date !== today) {
        memoryStats.date = today;
        memoryStats.todayRequests = 0;
        memoryStats.todaySuccess = 0;
    }

    return memoryStats;
}

/**
 * Record a request in analytics
 */
async function recordRequest(isSuccess = true) {
    const today = getTodayStr();
    if (!memoryStats) {
        memoryStats = readStatsFromDisk();
    }

    if (memoryStats.date !== today) {
        memoryStats.date = today;
        memoryStats.todayRequests = 0;
        memoryStats.todaySuccess = 0;
    }

    memoryStats.todayRequests = (memoryStats.todayRequests || 0) + 1;
    memoryStats.totalRequests = (memoryStats.totalRequests || 0) + 1;
    if (isSuccess) {
        memoryStats.todaySuccess = (memoryStats.todaySuccess || 0) + 1;
        memoryStats.totalSuccess = (memoryStats.totalSuccess || 0) + 1;
    }
    memoryStats.lastRequestAt = new Date().toISOString();

    writeStatsToDisk(memoryStats);

    // Asynchronously update MongoDB Atlas
    if (MONGODB_URI) {
        getMongoDb().then(async (db) => {
            if (!db) return;
            try {
                const incObj = {
                    todayRequests: 1,
                    totalRequests: 1
                };
                if (isSuccess) {
                    incObj.todaySuccess = 1;
                    incObj.totalSuccess = 1;
                }
                await db.collection('analytics').updateOne(
                    { _id: 'api_stats' },
                    {
                        $set: { date: today, lastRequestAt: new Date().toISOString() },
                        $inc: incObj
                    },
                    { upsert: true }
                );
            } catch (e) {}
        }).catch(() => {});
    }

    // Asynchronously update Redis if configured
    if (REDIS_URL && REDIS_TOKEN) {
        redisSet('ff_stats', memoryStats).catch(() => {});
    }

    return memoryStats;
}

/**
 * Check storage status & configuration
 */
function getStorageStatus() {
    const hasMongo = !!MONGODB_URI;
    const hasRedis = !!(REDIS_URL && REDIS_TOKEN);
    const isPersistent = hasMongo || hasRedis || !IS_VERCEL;

    let provider = 'Local File System';
    let type = 'local_file';

    if (hasMongo) {
        provider = 'MongoDB Atlas Cloud (atlas-yellow-planet)';
        type = 'mongodb_atlas';
    } else if (hasRedis) {
        provider = 'Upstash Redis / Vercel KV';
        type = 'upstash_redis';
    } else if (IS_VERCEL) {
        provider = 'Serverless Ephemeral (/tmp)';
        type = 'vercel_ephemeral';
    }

    return {
        type,
        persistent: isPersistent,
        provider,
        isVercel: IS_VERCEL,
        mongoConfigured: hasMongo,
        mongoConnected: mongoAvailable === true,
        redisConfigured: hasRedis,
        redisConnected: redisAvailable === true
    };
}

module.exports = {
    loadBots,
    getBotsSync,
    getActiveBots,
    getActiveBotsSync,
    saveBots,
    loadStats,
    recordRequest,
    getStorageStatus,
    DEFAULT_BOTS
};
