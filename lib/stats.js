const fs = require('fs');
const path = require('path');

// Support both local repo root and /tmp in Vercel serverless
const STATS_FILE = process.env.VERCEL ? path.join('/tmp', 'api_stats.json') : path.join(process.cwd(), 'stats.json');

let memoryStats = {
    date: getTodayStr(),
    todayRequests: 0,
    todaySuccess: 0,
    totalRequests: 0,
    totalSuccess: 0,
    lastRequestAt: null
};

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
            if (data && data.date) {
                memoryStats = data;
            }
        }
    } catch (e) {}

    // Reset today's count if new day
    const today = getTodayStr();
    if (memoryStats.date !== today) {
        memoryStats.date = today;
        memoryStats.todayRequests = 0;
        memoryStats.todaySuccess = 0;
    }
    return memoryStats;
}

function saveStats() {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(memoryStats, null, 2), 'utf-8');
    } catch (e) {}
}

function recordRequest(isSuccess = true) {
    loadStats();
    memoryStats.todayRequests = (memoryStats.todayRequests || 0) + 1;
    memoryStats.totalRequests = (memoryStats.totalRequests || 0) + 1;
    if (isSuccess) {
        memoryStats.todaySuccess = (memoryStats.todaySuccess || 0) + 1;
        memoryStats.totalSuccess = (memoryStats.totalSuccess || 0) + 1;
    }
    memoryStats.lastRequestAt = new Date().toISOString();
    saveStats();
    return memoryStats;
}

function getStats() {
    return loadStats();
}

module.exports = {
    recordRequest,
    getStats
};
