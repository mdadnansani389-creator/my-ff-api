const express = require('express');
const cors = require('cors');
const path = require('path');
const playerInfoHandler = require('./api/player-info');
const adminHandler = require('./api/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Routes
app.all('/api/admin', adminHandler);
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Player Info API
app.get('/api/player-info', playerInfoHandler);
app.get('/player-info', playerInfoHandler);

// Root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[+] Server running at: http://localhost:${PORT}`);
    console.log(`[+] Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`[i] Test Lookup: http://localhost:${PORT}/api/player-info?uid=YOUR_UID`);
});
