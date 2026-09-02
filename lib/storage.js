const fs = require('fs');
const path = require('path');
const axios = require('axios');

const IS_VERCEL = !!process.env.VERCEL;

// File paths
const LOCAL_BOTS_FILE = path.join(process.cwd(), 'bots.json');
const LOCAL_STATS_FILE = path.join(process.cwd(), 'stats.json');
const TMP_BOTS_FILE = path.join('/tmp', 'bots.json');
const TMP_STATS_FILE = path.join('/tmp', 'api_stats.json');

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
let redisAvailable = null; // null = untried, true = connected, false = failed

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
    // 1. Try /tmp in Vercel first (most recent runtime updates)
    if (IS_VERCEL) {
        try {
            if (fs.existsSync(TMP_BOTS_FILE)) {
                const data = JSON.parse(fs.readFileSync(TMP_BOTS_FILE, 'utf-8'));
                if (Array.isArray(data) && data.length > 0) return data;
            }
        } catch (e) {}
    }

    // 2. Try repo root bots.json
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
    // Write to /tmp if on Vercel
    if (IS_VERCEL) {
        try {
            fs.writeFileSync(TMP_BOTS_FILE, JSON.stringify(bots, null, 2), 'utf-8');
        } catch (e) {
            console.warn("[Storage] Could not write to /tmp/bots.json:", e.message);
        }
    }

    // Attempt writing to local repo root (works when running locally)
    try {
        fs.writeFileSync(LOCAL_BOTS_FILE, JSON.stringify(bots, null, 2), 'utf-8');
    } catch (e) {
        // Readonly on Vercel /var/task is expected
    }
}

/**
 * Load bots pool with automatic Cloud Redis sync & Fallback
 */
async function loadBots() {
    // If Redis is configured, try fetching from Redis
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

    // If already in memory cache, return
    if (memoryBots && Array.isArray(memoryBots) && memoryBots.length > 0) {
        return memoryBots;
    }

    // Otherwise load from disk/tmp
    memoryBots = readBotsFromDisk();

    // If Redis is configured but empty, seed it with default/initial bots
    if (REDIS_URL && REDIS_TOKEN && memoryBots) {
        redisSet('ff_bots', memoryBots).catch(() => {});
    }

    return memoryBots;
}

/**
 * Synchronous get of bots from memory cache (for fast player-info lookups)
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
 * Save bots pool (saves to Redis + /tmp + local disk + memory)
 */
async function saveBots(bots) {
    memoryBots = bots;
    writeBotsToDisk(bots);

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

    // Fallback to local stats.json
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

    if (REDIS_URL && REDIS_TOKEN) {
        // Asynchronously update Redis so we don't delay player-info response
        redisSet('ff_stats', memoryStats).catch(() => {});
    }

    return memoryStats;
}

/**
 * Check storage status & configuration
 */
function getStorageStatus() {
    const hasRedis = !!(REDIS_URL && REDIS_TOKEN);
    return {
        type: hasRedis ? 'upstash_redis' : (IS_VERCEL ? 'vercel_ephemeral' : 'local_file'),
        persistent: hasRedis || !IS_VERCEL,
        provider: hasRedis ? 'Upstash Redis / Vercel KV' : (IS_VERCEL ? 'Serverless Ephemeral (/tmp)' : 'Local File System'),
        isVercel: IS_VERCEL,
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
