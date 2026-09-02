const playerInfoHandler = require('./player-info');
const adminHandler = require('./admin');

module.exports = async (req, res) => {
    const url = req.url || '';
    if (url.includes('/api/admin') || url.includes('/admin')) {
        return adminHandler(req, res);
    }
    return playerInfoHandler(req, res);
};
