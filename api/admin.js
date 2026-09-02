const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ffmax69";
const BOTS_FILE = path.join(process.cwd(), 'bots.json');

// Memory cache for bots in serverless environment
let inMemoryBots = null;

function loadBots() {
    if (inMemoryBots) return inMemoryBots;
    try {
        if (fs.existsSync(BOTS_FILE)) {
            const data = fs.readFileSync(BOTS_FILE, 'utf-8');
            inMemoryBots = JSON.parse(data);
            return inMemoryBots;
        }
    } catch (e) {
        console.error("Error reading bots.json:", e.message);
    }
    inMemoryBots = [
        {
            id: "bot_1",
            uid: "7403290144",
            password: "10FA10F1D5D1694D64518D7F6CB8CE92720C5F34B33BAC77E2C440ADE6977913",
            label: "Primary Guest Bot",
            status: "active",
            addedAt: new Date().toISOString()
        }
    ];
    return inMemoryBots;
}

function saveBots(bots) {
    inMemoryBots = bots;
    try {
        fs.writeFileSync(BOTS_FILE, JSON.stringify(bots, null, 2), 'utf-8');
    } catch (e) {
        console.warn("Could not write to local bots.json (serverless readonly):", e.message);
    }
}

async function testGarenaAuth(uid, password) {
    try {
        const params = new URLSearchParams();
        params.append('uid', String(uid).trim());
        params.append('password', String(password).trim());
        params.append('response_type', 'token');
        params.append('client_type', '2');
        params.append('client_secret', '2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3');
        params.append('client_id', '100067');

        const response = await axios.post(
            'https://ffmconnect.live.gop.garenanow.com/oauth/guest/token/grant',
            params,
            {
                headers: {
                    'User-Agent': 'GarenaMSDK/4.0.19P9(A063 ;Android 13;en;IN;)',
                    'Connection': 'Keep-Alive',
                    'Accept-Encoding': 'gzip'
                },
                timeout: 8000
            }
        );

        if (response.data && response.data.access_token) {
            return {
                valid: true,
                openId: response.data.open_id,
                expiresIn: response.data.expires_in
            };
        } else {
            return {
                valid: false,
                error: response.data ? (response.data.error || 'Invalid credentials') : 'No token received'
            };
        }
    } catch (err) {
        return {
            valid: false,
            error: err.response && err.response.data ? JSON.stringify(err.response.data) : err.message
        };
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const authHeader = req.headers.authorization || '';
    const providedToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const action = req.query.action || (req.body && req.body.action) || '';

    // Action 1: Login
    if (action === 'login') {
        const pass = (req.body && req.body.password) || req.query.password || '';
        if (pass === ADMIN_PASSWORD) {
            const sessionToken = Buffer.from(`ffmax:${pass}:${Date.now()}`).toString('base64');
            return res.status(200).json({
                success: true,
                token: sessionToken,
                message: "Authentication successful"
            });
        }
        return res.status(401).json({ success: false, message: "Invalid password." });
    }

    // Auth verification for all remaining actions
    const isValidAuth = providedToken && (() => {
        try {
            const decoded = Buffer.from(providedToken, 'base64').toString('utf-8');
            return decoded.startsWith(`ffmax:${ADMIN_PASSWORD}:`);
        } catch(e) {
            return false;
        }
    })();

    if (!isValidAuth) {
        return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    let bots = loadBots();

    // Action 2: List Bots
    if (action === 'list_bots') {
        // Return masked passwords
        const safeBots = bots.map(b => ({
            id: b.id,
            uid: b.uid,
            passwordMasked: b.password ? `${b.password.slice(0, 6)}••••••••${b.password.slice(-4)}` : '',
            label: b.label || 'Bot',
            status: b.status || 'active',
            addedAt: b.addedAt
        }));
        return res.status(200).json({ success: true, bots: safeBots });
    }

    // Action 3: Test Bot Connection
    if (action === 'test_bot') {
        const { uid, password } = req.body || {};
        if (!uid || !password) {
            return res.status(400).json({ success: false, message: "UID and Password are required." });
        }
        const testResult = await testGarenaAuth(uid, password);
        return res.status(200).json({ success: true, testResult });
    }

    // Action 4: Add New Bot
    if (action === 'add_bot') {
        const { uid, password, label } = req.body || {};
        if (!uid || !password) {
            return res.status(400).json({ success: false, message: "UID and Password are required." });
        }

        const cleanUid = String(uid).trim();
        const cleanPassword = String(password).trim();

        // Check if already exists
        if (bots.some(b => b.uid === cleanUid)) {
            return res.status(400).json({ success: false, message: "A bot with this UID already exists." });
        }

        // Test with Garena before saving
        const testResult = await testGarenaAuth(cleanUid, cleanPassword);
        if (!testResult.valid) {
            return res.status(400).json({
                success: false,
                message: `Garena authentication failed: ${testResult.error}`
            });
        }

        const newBot = {
            id: `bot_${Date.now()}`,
            uid: cleanUid,
            password: cleanPassword,
            label: label ? String(label).trim() : `Bot ${cleanUid}`,
            status: 'active',
            addedAt: new Date().toISOString()
        };

        bots.push(newBot);
        saveBots(bots);

        return res.status(200).json({
            success: true,
            message: "Bot verified and added to pool successfully!",
            bot: {
                id: newBot.id,
                uid: newBot.uid,
                label: newBot.label,
                status: newBot.status
            }
        });
    }

    // Action 5: Delete Bot
    if (action === 'delete_bot') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, message: "Bot ID required." });

        if (bots.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete the last remaining bot! At least 1 active bot is required."
            });
        }

        const initialLength = bots.length;
        bots = bots.filter(b => b.id !== id);

        if (bots.length === initialLength) {
            return res.status(404).json({ success: false, message: "Bot not found." });
        }

        saveBots(bots);
        return res.status(200).json({ success: true, message: "Bot removed successfully." });
    }

    // Action 6: Toggle Bot Status (active/disabled)
    if (action === 'toggle_bot') {
        const { id } = req.body || {};
        const bot = bots.find(b => b.id === id);
        if (!bot) return res.status(404).json({ success: false, message: "Bot not found." });

        bot.status = bot.status === 'active' ? 'disabled' : 'active';
        saveBots(bots);
        return res.status(200).json({ success: true, status: bot.status });
    }

    return res.status(400).json({ success: false, message: "Unknown action." });
};
