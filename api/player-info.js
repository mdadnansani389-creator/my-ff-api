const axios = require('axios');
let FreeFireAPI;
try {
    FreeFireAPI = require('@pure0cd/freefire-api');
} catch (e) {
    FreeFireAPI = null;
}

let ffClient = null;
let lastLoginTime = 0;
const SESSION_TTL = 1000 * 60 * 30; // 30 mins session cache

/**
 * Get or refresh active Garena Free Fire API session
 */
async function getClient() {
    const now = Date.now();
    if (!ffClient || now - lastLoginTime > SESSION_TTL) {
        if (!FreeFireAPI) {
            throw new Error("FreeFireAPI module not available");
        }
        ffClient = new FreeFireAPI();
        const botUid = process.env.BOT_UID || null;
        const botPassword = process.env.BOT_PASSWORD || null;
        await ffClient.login(botUid, botPassword);
        lastLoginTime = Date.now();
    }
    return ffClient;
}

/**
 * Fallback to Garena Official Topup Service for basic player validation
 */
async function fetchFromGarenaTopup(uid) {
    try {
        const res = await axios.post(
            'https://shop.garena.my/api/auth/player_id_login',
            {
                app_id: 100067,
                login_id: String(uid)
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 8000
            }
        );
        if (res.data && res.data.nickname) {
            return {
                AccountInfo: {
                    AccountName: res.data.nickname,
                    AccountRegion: res.data.region || 'BD',
                    AccountLevel: null,
                    AccountLikes: null
                },
                SocialInfo: {
                    accountId: String(uid)
                }
            };
        }
    } catch (e) {
        // Fallback failed
    }
    return null;
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const uid = req.query.uid || req.query.id;
    const region = req.query.region || 'BD';

    if (!uid || !/^\d+$/.test(String(uid).trim())) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid numeric UID.'
        });
    }

    const cleanUid = String(uid).trim();

    try {
        // 1. Try Protobuf Full Stats via Garena Game Gateway if Bot credentials provided
        if (FreeFireAPI && process.env.BOT_UID && process.env.BOT_PASSWORD) {
            try {
                const client = await getClient();
                const profile = await client.getPlayerProfile(cleanUid);

                if (profile && profile.basicInfo) {
                    const b = profile.basicInfo || {};
                    const s = profile.socialInfo || {};
                    const c = profile.clanInfo || {};
                    const ep = profile.epInfo || {};
                    const cs = profile.creditScoreInfo || {};

                    const formattedData = {
                        AccountInfo: {
                            AccountName: b.nickname || 'Unknown Player',
                            AccountLevel: b.level || 0,
                            AccountEXP: b.exp || 0,
                            AccountRegion: b.region || region,
                            AccountLikes: b.liked || 0,
                            AccountCreateTime: b.createat ? String(b.createat) : null,
                            AccountLastLogin: b.lastloginat ? String(b.lastloginat) : null,
                            AccountSeasonId: b.seasonid || null
                        },
                        AccountProfileInfo: {
                            BrMaxRank: b.maxrank || b.rank || 0,
                            BrRankPoint: b.rankingpoints || 0,
                            CsMaxRank: b.csmaxrank || b.csrank || 0,
                            CsRankPoint: b.csrankingpoints || 0,
                            ShowBrRank: true,
                            ShowCsRank: true
                        },
                        EquippedItemsInfo: {
                            EquippedAvatarId: b.headpic || null,
                            EquippedBannerId: b.bannerid || null,
                            EquippedBPID: ep.epeventid || null,
                            EquippedBPBadges: ep.badgecnt || ep.epbadge || 0
                        },
                        SocialInfo: {
                            accountId: String(cleanUid),
                            gender: s.gender !== undefined ? `Gender_${s.gender}` : null,
                            language: s.language !== undefined ? `Language_${s.language}` : null,
                            signature: s.signature || null
                        },
                        CreditScoreInfo: {
                            creditScore: cs.creditscore || 100
                        },
                        GuildInfo: {
                            GuildID: c.clanid ? String(c.clanid) : "None",
                            GuildName: c.clanname || null,
                            GuildLevel: c.clanlevel || null
                        }
                    };

                    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
                    return res.status(200).json({
                        success: true,
                        source: 'private_garena_gateway',
                        data: formattedData
                    });
                }
            } catch (err) {
                console.error("Direct Gateway lookup error:", err.message);
                ffClient = null;
            }
        }

        // 2. High-speed Garena Gateway Relay with Edge Caching
        try {
            const gatewayUrl = `https://api.gameskinbo.com/ff-info/get?uid=${encodeURIComponent(cleanUid)}` + (region && region !== 'AUTO' ? `&region=${encodeURIComponent(region)}` : '');
            const gRes = await axios.get(gatewayUrl, {
                headers: {
                    'x-api-key': 'y_n6Sg5yqZPIX3cQTNP-VFg3AgrhID8CXbcOg5Mo2qA',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                timeout: 12000
            });

            if (gRes.data && (gRes.data.AccountInfo || gRes.data.basicInfo)) {
                res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
                return res.status(200).json({
                    success: true,
                    source: 'cloud_edge_gateway',
                    data: gRes.data
                });
            }
        } catch (relayErr) {
            console.error("Relay gateway error:", relayErr.message);
        }

        // 3. Fallback to Garena Topup validation
        const topupData = await fetchFromGarenaTopup(cleanUid);
        if (topupData) {
            res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
            return res.status(200).json({
                success: true,
                source: 'garena_topup',
                data: topupData
            });
        }

        return res.status(404).json({
            success: false,
            message: 'Player not found or Garena servers did not return profile data.'
        });

    } catch (error) {
        console.error("API Handler Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error while fetching player profile.'
        });
    }
};
