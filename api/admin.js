const axios = require('axios');
const storage = require('../lib/storage');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ffmax69";

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

    let bots = await storage.loadBots();

    // Action 2: List Bots & Stats
    if (action === 'list_bots') {
        const safeBots = bots.map(b => ({
            id: b.id,
            uid: b.uid,
            passwordMasked: b.password ? `${b.password.slice(0, 6)}••••••••${b.password.slice(-4)}` : '',
            label: b.label || 'Bot',
            status: b.status || 'active',
            addedAt: b.addedAt
        }));
        const stats = await storage.loadStats();
        const storageStatus = storage.getStorageStatus();
        return res.status(200).json({ success: true, bots: safeBots, stats, storageStatus });
    }

    // Action 3: Storage Status
    if (action === 'storage_status') {
        return res.status(200).json({ success: true, storageStatus: storage.getStorageStatus() });
    }

    // Action 4: Test Bot Connection
    if (action === 'test_bot') {
        const { uid, password } = req.body || {};
        if (!uid || !password) {
            return res.status(400).json({ success: false, message: "UID and Password are required." });
        }
        const testResult = await testGarenaAuth(uid, password);
        return res.status(200).json({ success: true, testResult });
    }

    // Action 5: Add New Bot
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
        await storage.saveBots(bots);

        return res.status(200).json({
            success: true,
            message: "Bot verified and added to pool successfully!",
            bot: {
                id: newBot.id,
                uid: newBot.uid,
                label: newBot.label,
                status: newBot.status
            },
            storageStatus: storage.getStorageStatus()
        });
    }

    // Action 6: Delete Bot
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

        await storage.saveBots(bots);
        return res.status(200).json({ success: true, message: "Bot removed successfully." });
    }

    // Action 7: Toggle Bot Status (active/disabled)
    if (action === 'toggle_bot') {
        const { id } = req.body || {};
        const bot = bots.find(b => b.id === id);
        if (!bot) return res.status(404).json({ success: false, message: "Bot not found." });

        bot.status = bot.status === 'active' ? 'disabled' : 'active';
        await storage.saveBots(bots);
        return res.status(200).json({ success: true, status: bot.status });
    }

    // Action 8: Export Raw Bots JSON (for backup/git commit)
    if (action === 'export_bots') {
        return res.status(200).json({ success: true, bots });
    }

    // Action 9: Import Bots JSON (restore/sync)
    if (action === 'import_bots') {
        const { importedBots } = req.body || {};
        if (!Array.isArray(importedBots) || importedBots.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid bots array provided." });
        }

        const validBots = importedBots.filter(b => b && b.uid && b.password);
        if (validBots.length === 0) {
            return res.status(400).json({ success: false, message: "No valid bots found in imported data." });
        }

        await storage.saveBots(validBots);
        return res.status(200).json({
            success: true,
            message: `Successfully imported and activated ${validBots.length} bot(s).`
        });
    }

    return res.status(400).json({ success: false, message: "Unknown action." });
};

