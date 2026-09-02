const FreeFireAPI = require('@pure0cd/freefire-api');

// Your Official Garena Guest Bot Account Credentials
const BOT_UID = process.env.BOT_UID || "7403290144";
const BOT_PASSWORD = process.env.BOT_PASSWORD || "10FA10F1D5D1694D64518D7F6CB8CE92720C5F34B33BAC77E2C440ADE6977913";

let ffClient = null;
let lastLoginTime = 0;
const SESSION_TTL = 1000 * 60 * 60 * 6; // 6 hours session cache

/**
 * Connect and authenticate directly with Garena Official Game Gateway
 */
async function getClient() {
    const now = Date.now();
    if (!ffClient || now - lastLoginTime > SESSION_TTL) {
        console.log("[i] Authenticating directly with Garena Game Server...");
        const client = new FreeFireAPI();
        await client.login(BOT_UID, BOT_PASSWORD);
        ffClient = client;
        lastLoginTime = Date.now();
        console.log("[+] Logged into Garena successfully! Server URL:", client.session.serverUrl);
    }
    return ffClient;
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
        const client = await getClient();

        // 1. Fetch direct profile from Garena
        let profile;
        try {
            profile = await client.getPlayerProfile(cleanUid);
        } catch (err) {
            // If token expired, reset session and retry once
            console.warn("[!] Garena session expired or request failed, re-logging in:", err.message);
            ffClient = null;
            const freshClient = await getClient();
            profile = await freshClient.getPlayerProfile(cleanUid);
        }

        if (!profile || !profile.basicinfo) {
            return res.status(404).json({
                success: false,
                message: 'Player not found on Garena official game servers.'
            });
        }

        // 2. Fetch equipped items and battle stats
        let items = null;
        let stats = null;
        try {
            const [itemsRes, statsRes] = await Promise.allSettled([
                client.getPlayerItems(cleanUid),
                client.getPlayerStats(cleanUid)
            ]);
            if (itemsRes.status === 'fulfilled') items = itemsRes.value;
            if (statsRes.status === 'fulfilled') stats = statsRes.value;
        } catch (e) {}

        const b = profile.basicinfo || {};
        const s = profile.socialinfo || {};
        const c = profile.clanbasicinfo || {};
        const p = profile.petinfo || {};
        const cs = profile.creditscoreinfo || {};
        const epList = profile.historyepinfo || profile.eplist || [];
        const latestEp = epList.length > 0 ? epList[0] : {};

        // Extract equipped cosmetic IDs from items if available
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

        // Format standardized payload (100% Garena Official Data)
        const formattedData = {
            AccountInfo: {
                AccountName: b.nickname || 'Unknown Player',
                AccountLevel: b.level || 0,
                AccountEXP: b.exp || 0,
                AccountRegion: b.region || region,
                AccountLikes: b.liked || 0,
                AccountCreateTime: b.createat ? String(b.createat) : null,
                AccountLastLogin: b.lastloginat ? String(b.lastloginat) : null,
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
                language: s.language || 'LANGUAGEDEFAULT',
                signature: s.signature || null,
                rankShow: s.rankshow || 'RANKSHOWBR'
            },
            CreditScoreInfo: {
                creditScore: cs.creditscore || 100,
                rewardState: cs.rewardstate || 'REWARDSTATEUNCLAIMED'
            },
            GuildInfo: {
                GuildID: c.clanid && c.clanid !== "0" ? String(c.clanid) : "None",
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

        // Cache response for 5 minutes (300s) on Vercel CDN
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

        return res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error("Garena Direct Gateway Error:", error);
        return res.status(500).json({
            success: false,
            message: 'Unable to fetch player profile at this moment.'
        });
    }
};
