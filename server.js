const express = require('express');
const cors = require('cors');
const playerInfoHandler = require('./api/player-info');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/player-info', playerInfoHandler);
app.get('/player-info', playerInfoHandler);
app.get('/', (req, res) => {
    res.json({
        service: "Free Fire Custom Player Info API",
        status: "active",
        endpoints: {
            lookup: "/api/player-info?uid=YOUR_PLAYER_UID"
        }
    });
});

app.listen(PORT, () => {
    console.log(`[+] Free Fire Custom API is running at: http://localhost:${PORT}`);
    console.log(`[i] Test link: http://localhost:${PORT}/api/player-info?uid=YOUR_UID`);
});
