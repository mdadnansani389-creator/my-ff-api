const fs = require('fs');
const path = require('path');
const FreeFireAPI = require('@pure0cd/freefire-api');
const { recordRequest } = require('../lib/stats');

const BOTS_FILE = path.join(process.cwd(), 'bots.json');

const DEFAULT_BOTS = [
    {
        id: "bot_1",
        uid: process.env.BOT_UID || "7403290144",
        password: process.env.BOT_PASSWORD || "10FA10F1D5D1694D64518D7F6CB8CE92720C5F34B33BAC77E2C440ADE6977913",
        status: "active"
    }
];

function getActiveBots() {
    try {
        if (fs.existsSync(BOTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) {
                const active = data.filter(b => b.status !== 'disabled');
                if (active.length > 0) return active;
            }
        }
    } catch (e) {
        console.error("Error loading bots.json:", e.message);
    }
    return DEFAULT_BOTS;
}

// Client pool cache: botUid -> { client, lastLogin }
const clientPool = new Map();
let roundRobinIndex = 0;

/**
 * Get or authenticate a client for a specific bot
 */
async function getClientForBot(bot) {
    const now = Date.now();
    let entry = clientPool.get(bot.uid);
    if (!entry || now - entry.lastLogin > 1000 * 60 * 60 * 6) {
        console.log(`[i] Authenticating Bot (${bot.uid}) directly with Garena...`);
        const client = new FreeFireAPI();
        await client.login(bot.uid, bot.password);
        entry = { client, lastLogin: Date.now() };
        clientPool.set(bot.uid, entry);
        console.log(`[+] Bot (${bot.uid}) logged in successfully!`);
    }
    return entry.client;
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const uid = req.query.uid || req.query.id;
    const region = (req.query.region || 'BD').toUpperCase();

    if (!uid || !/^\d+$/.test(String(uid).trim())) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid numeric UID.'
        });
    }

    const cleanUid = String(uid).trim();

    try {
        const bots = getActiveBots();
        let profile = null;
        let successfulClient = null;
        let lastError = null;

        // Round-Robin with Automatic Failover through the bot pool
        const startIndex = (roundRobinIndex++) % bots.length;
        for (let i = 0; i < bots.length; i++) {
            const bot = bots[(startIndex + i) % bots.length];
            try {
                const client = await getClientForBot(bot);
                profile = await client.getPlayerProfile(cleanUid);
                if (profile && profile.basicinfo) {
                    successfulClient = client;
                    break;
                }
            } catch (err) {
                console.warn(`[!] Bot (${bot.uid}) request failed, trying next bot:`, err.message);
                lastError = err;
                clientPool.delete(bot.uid); // Reset cache for failing bot
            }
        }

        if (!profile || !profile.basicinfo) {
            recordRequest(false);
            return res.status(404).json({
                success: false,
                message: 'Player not found on Garena official game servers.'
            });
        }

        // Fetch equipped items and battle stats via the successful client
        let items = null;
        let stats = null;
        if (successfulClient) {
            try {
                const [itemsRes, statsRes] = await Promise.allSettled([
                    successfulClient.getPlayerItems(cleanUid),
                    successfulClient.getPlayerStats(cleanUid)
                ]);
                if (itemsRes.status === 'fulfilled') items = itemsRes.value;
                if (statsRes.status === 'fulfilled') stats = statsRes.value;
            } catch (e) {}
        }

        const b = profile.basicinfo || {};
        const s = profile.socialinfo || {};
        const c = profile.clanbasicinfo || {};
        const p = profile.petinfo || {};
        const cs = profile.creditscoreinfo || {};
        const epList = profile.historyepinfo || profile.eplist || [];
        const latestEp = epList.length > 0 ? epList[0] : {};

        let outfitIds = [];
        let weaponIds = [];
        let skillIds = [];
        if (items) {
            if (Array.isArray(items.outfit)) outfitIds = items.outfit.map(i => i.id).filter(Boolean);
            if (items.skills && Array.isArray(items.skills.equipped)) skillIds = items.skills.equipped.map(i => i.id).filter(Boolean);
            if (items.weapons && Array.isArray(items.weapons.shown_skins)) weaponIds = items.weapons.shown_skins.map(i => i.id).filter(Boolean);
        }
        if (outfitIds.length === 0 && profile.profileinfo && Array.isArray(profile.profileinfo.clothes)) {
            outfitIds = profile.profileinfo.clothes;
        }
        if (skillIds.length === 0 && profile.profileinfo && Array.isArray(profile.profileinfo.equipedskills)) {
            skillIds = profile.profileinfo.equipedskills;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const lastLoginSec = b.lastloginat ? Number(b.lastloginat) : 0;
        const diffSeconds = lastLoginSec > 0 ? (nowSec - lastLoginSec) : null;

        const formattedData = {
            AccountInfo: {
                AccountName: b.nickname || 'Unknown Player',
                AccountLevel: b.level || 0,
                AccountEXP: b.exp || 0,
                AccountRegion: b.region || region,
                AccountLikes: b.liked || 0,
                AccountCreateTime: b.createat ? String(b.createat) : null,
                AccountLastLogin: b.lastloginat ? String(b.lastloginat) : null,
                LastLoginDiffSeconds: diffSeconds,
                AccountSeasonId: null
            },
            AccountProfileInfo: {
                BrMaxRank: b.rank || 0,
                BrRankPoint: b.rankingpoints || 0,
                CsMaxRank: b.csrank || 0,
                CsRankPoint: b.csrankingpoints || 0,
                ShowBrRank: true,
                ShowCsRank: true
            },
            EquippedItemsInfo: {
                EquippedAvatarId: profile.profileinfo ? (profile.profileinfo.avatarid || 902050007) : 902050007,
                EquippedBannerId: 901042013,
                EquippedBPID: latestEp.epbadge || 1001000100,
                EquippedBPBadges: latestEp.badgecnt || 0,
                EquippedOutfit: outfitIds,
                EquippedWeapon: weaponIds,
                EquippedSkills: skillIds
            },
            SocialInfo: {
                accountId: String(cleanUid),
                gender: s.gender || 'GENDERMALE',
                language: s.language || 'LANGUAGECNTRADITIONAL',
                signature: s.signature || null,
                rankShow: 'RANKSHOWBR'
            },
            CreditScoreInfo: {
                creditScore: cs.creditscore || 100,
                rewardState: cs.rewardstate || 'REWARDSTATEUNCLAIMED'
            },
            GuildInfo: {
                GuildID: c.clanid || 'None',
                GuildName: c.clanname || null,
                GuildLevel: c.clanlevel || null,
                GuildMember: c.membernum || null,
                GuildCapacity: c.capacity || null
            },
            PetInfo: p.id ? {
                id: p.id,
                level: p.level || 1,
                exp: p.exp || 0,
                name: p.name || "",
                skinId: p.skinid || null,
                selectedSkillId: p.selectedskillid || null
            } : null,
            BattleStats: stats || null
        };

        // Record successful request in analytics
        recordRequest(true);

        // ZERO CACHE: Always serve 100% fresh, live real-time Garena status
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        return res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        recordRequest(false);
        console.error("Garena Gateway Pool Error:", error);
        return res.status(500).json({
            success: false,
            message: 'Unable to fetch player profile at this moment.'
        });
    }
};
