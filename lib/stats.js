const storage = require('./storage');

function recordRequest(isSuccess = true) {
    return storage.recordRequest(isSuccess);
}

function getStats() {
    return storage.loadStats();
}

module.exports = {
    recordRequest,
    getStats
};

