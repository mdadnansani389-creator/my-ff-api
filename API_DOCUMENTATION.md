# 🎮 Free Fire Player Info API Documentation

> **Base URL:** `https://my-ff-api-three.vercel.app`  
> **Version:** `1.0.0`  
> **Format:** `JSON`  
> **CORS:** Enabled (`*`)  
> **CDN / Edge Caching:** 300 seconds (5 mins)  

---

## 📌 ১. ওভারভিউ (Overview)
এটি একটি উচ্চগতির সার্ভারলেস **Free Fire Player Info REST API** যা গ্যারেনার অফিসিয়াল গেটওয়ে ও প্রোটোবাফ আর্কিটেকচার ব্যবহার করে যেকোনো প্লেয়ারের পূর্ণাঙ্গ ইন-গেম প্রোফাইল ডেটা (নাম, লেভেল, লাইক, র‍্যাঙ্ক, অ্যাভাটার, ব্যানার, বায়ো ইত্যাদি) রিয়েল-টাইমে ফেচ করে। এটি **Vercel Serverless Function** হিসেবে হোস্ট করা এবং যেকোনো ওয়েবসাইট, অ্যান্ড্রয়েড অ্যাপ, ডিসকর্ড বট বা টেলিগ্রাম বটে ব্যবহারযোগ্য।

---

## 🚀 ২. এন্ডপয়েন্ট তালিকা (Endpoints)

### `GET /api/player-info`
প্লেয়ারের UID এবং রিজিয়ন দিয়ে পূর্ণাঙ্গ প্রোফাইল ডেটা সংগ্রহ করতে এই এন্ডপয়েন্টটি কল করুন।

#### রিকোয়েস্ট URL উদাহরণ:
```http
GET https://my-ff-api-three.vercel.app/api/player-info?uid=3000391898&region=BD
```

---

## ⚙️ ৩. কুয়েরি প্যারামিটারস (Query Parameters)

| প্যারামিটার | টাইপ | আবশ্যক? | ডিফল্ট | বিবরণ |
|:---|:---|:---:|:---:|:---|
| `uid` বা `id` | `String` / `Number` | **হ্যাঁ** | — | প্লেয়ারের ইন-গেম সংখ্যাসূচক UID (যেমন: `3000391898`) |
| `region` | `String` | না | `BD` | প্লেয়ারের গেম রিজিয়ন (যেমন: `BD`, `IND`, `SG`, `ID`, `ME`, `BR`, `US`) |

---

## 📤 ৪. সফল রেসপন্স (HTTP 200 OK Example)

```json
{
  "success": true,
  "source": "cloud_edge_gateway",
  "data": {
    "AccountInfo": {
      "AccountName": "ᶜᵉᵒ〆FLEX™",
      "AccountLevel": 70,
      "AccountEXP": 2860195,
      "AccountRegion": "BD",
      "PrimeLevel": 6,
      "AccountLikes": 9163,
      "AccountLastLogin": "1788325315",
      "AccountCreateTime": "1617791209",
      "AccountSeasonId": 53
    },
    "AccountProfileInfo": {
      "BrMaxRank": 317,
      "BrRankPoint": 2994,
      "CsMaxRank": 321,
      "CsRankPoint": 91,
      "ShowBrRank": true,
      "ShowCsRank": true,
      "Title": 904090025
    },
    "EquippedItemsInfo": {
      "EquippedAvatarId": 902050007,
      "EquippedBannerId": 901042013,
      "EquippedBPID": 1001000100,
      "EquippedBPBadges": 10,
      "EquippedOutfit": [211046056, 203046064, 204051038, 205000225, 214039008],
      "EquippedWeapon": [907105425, 912054001, 914000002],
      "EquippedSkills": [16, 4804, 8, 1, 16, 1003, 8, 2, 16, 5206, 8, 3, 16, 6201]
    },
    "SocialInfo": {
      "accountId": "3000391898",
      "gender": "Gender_MALE",
      "language": "Language_CN_TRADITIONAL",
      "signature": "[b][c][FF0000]know your place f.o.o.l",
      "rankShow": "RankShow_BR"
    },
    "PetInfo": {
      "id": 1300000123,
      "level": 4,
      "exp": 540,
      "isSelected": true,
      "skinId": 1310000235,
      "selectedSkillId": 1315000011
    },
    "CreditScoreInfo": {
      "creditScore": 100,
      "rewardState": "REWARD_STATE_UNCLAIMED"
    },
    "GuildInfo": {
      "GuildID": "None",
      "GuildName": null,
      "GuildLevel": null
    }
  }
}
```

---

## 📊 ৫. রেসপন্স ফিল্ড বিবরণী (Response Field Dictionary)

### ১. `AccountInfo` (অ্যাকাউন্ট সাধারণ তথ্য)
- `AccountName`: প্লেয়ারের বর্তমান ইন-গেম নাম / ডাকনাম।
- `AccountLevel`: প্লেয়ারের বর্তমান লেভেল (যেমন `70`)।
- `AccountEXP`: মোট সংগৃহীত এক্সপেরিয়েন্স পয়েন্ট (EXP)।
- `AccountRegion`: যে সার্ভারে অ্যাকাউন্টটি অবস্থিত (যেমন `BD`, `IND`, `SG`)।
- `AccountLikes`: মোট প্রাপ্ত লাইক সংখ্যা।
- `AccountCreateTime`: অ্যাকাউন্ট তৈরির ইউনিক্স টাইমস্ট্যাম্প।
- `AccountLastLogin`: সর্বশেষ গেম লগইন করার টাইমস্ট্যাম্প।

### ২. `AccountProfileInfo` (র‍্যাঙ্ক ও পয়েন্ট)
- `BrMaxRank`: ব্যাটল রয়্যাল (BR) বর্তমান সর্বোচ্চ র‍্যাঙ্ক টায়ার।
- `BrRankPoint`: বর্তমান BR র‍্যাঙ্ক পয়েন্ট (যেমন `2994`)।
- `CsMaxRank`: ক্লাস স্কোয়াড (CS) সর্বোচ্চ র‍্যাঙ্ক টায়ার।
- `CsRankPoint`: বর্তমান CS স্টার/পয়েন্ট।

### ৩. `EquippedItemsInfo` (পরিহিত কসমেটিকস ও আইডি)
- `EquippedAvatarId`: অ্যাক্টিভ প্রোফাইল অ্যাভাটার আইডি (যেমন `902050007`)।
- `EquippedBannerId`: অ্যাক্টিভ প্রোফাইল ব্যানার আইডি (যেমন `901042013`)।
- `EquippedBPID`: বর্তমান অ্যাক্টিভ ব্যাটল পাস আইডি।
- `EquippedBPBadges`: ব্যাটল পাসের সংগৃহীত ব্যাজ সংখ্যা।
- `EquippedOutfit`: পরিহিত পোশাকের আইটেম আইডি অ্যারে।
- `EquippedWeapon`: হাতে থাকা গানের স্কিন আইডি অ্যারে।
- `EquippedSkills`: অ্যাক্টিভ ক্যারেক্টার স্কিল আইডি।

### ৪. `SocialInfo` (সোশ্যাল ও সিগনেচার)
- `gender`: জেন্ডার (`Gender_MALE` / `Gender_FEMALE`)।
- `language`: সিলেক্টেড ভাষা।
- `signature`: প্লেয়ারের প্রোফাইল বায়ো / সিগনেচার টেক্সট (কালার কোড সহ)।

---

## 🖼️ ৬. অ্যাভাটার ও ব্যানার ইমেজ ফেচ করার CDN লিঙ্ক

আইডি থেকে সরাসরি গেমের আসল ছবি পেতে নিচের ফ্রি CDN ব্যবহার করুন:

```http
# অ্যাভাটার ছবির URL:
https://cdn.jsdelivr.net/gh/TSun-FreeFire/TSun-FF-Avatar-And-Banners@main/icons/{EquippedAvatarId}.png

# ব্যানার ছবির URL:
https://cdn.jsdelivr.net/gh/TSun-FreeFire/TSun-FF-Avatar-And-Banners@main/icons/{EquippedBannerId}.png

# ব্যাটল পাস ব্যাজের URL:
https://cdn.jsdelivr.net/gh/TSun-FreeFire/TSun-FF-Avatar-And-Banners@main/icons/{EquippedBPID}.png
```
*উদাহরণ:* `https://cdn.jsdelivr.net/gh/TSun-FreeFire/TSun-FF-Avatar-And-Banners@main/icons/902050007.png`

---

## 💻 ৭. কোড ইমপ্লিমেন্টেশন উদাহরণ (Code Examples)

### JavaScript (Fetch API)
```javascript
const uid = "3000391898";
const apiUrl = `https://my-ff-api-three.vercel.app/api/player-info?uid=${uid}&region=BD`;

fetch(apiUrl)
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      const player = data.data.AccountInfo;
      console.log(`Player Name: ${player.AccountName}`);
      console.log(`Level: ${player.AccountLevel}`);
      console.log(`Likes: ${player.AccountLikes}`);
    } else {
      console.error(data.message);
    }
  })
  .catch(err => console.error("API Error:", err));
```

### Python (Requests)
```python
import requests

uid = "3000391898"
url = f"https://my-ff-api-three.vercel.app/api/player-info?uid={uid}&region=BD"

response = requests.get(url, timeout=10)
result = response.json()

if result.get("success"):
    account = result["data"]["AccountInfo"]
    print(f"Name: {account['AccountName']}")
    print(f"Level: {account['AccountLevel']}")
    print(f"Likes: {account['AccountLikes']}")
else:
    print(f"Error: {result.get('message')}")
```

### PHP (cURL)
```php
<?php
$uid = "3000391898";
$url = "https://my-ff-api-three.vercel.app/api/player-info?uid=" . urlencode($uid) . "&region=BD";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
if (!empty($data['success'])) {
    $player = $data['data']['AccountInfo'];
    echo "Player: " . $player['AccountName'] . " (Lv. " . $player['AccountLevel'] . ")";
}
?>
```

### cURL (Terminal / Command Prompt)
```bash
curl -X GET "https://my-ff-api-three.vercel.app/api/player-info?uid=3000391898&region=BD"
```

---

## ⚠️ ৮. ত্রুটি ও স্ট্যাটাস কোড (HTTP Status Codes)

| স্ট্যাটাস কোড | অর্থ | কারণ | সমাধান |
|:---:|:---|:---|:---|
| **`200 OK`** | Success | প্লেয়ার সফলভাবে পাওয়া গেছে | রেসপন্স ডেটা ব্যবহার করুন |
| **`400 Bad Request`** | Invalid UID | কোনো UID দেওয়া হয়নি বা সংখ্যাসূচক নয় | সঠিক সংখ্যাসূচক UID দিন |
| **`404 Not Found`** | Player Not Found | এই UID-তে কোনো আইডি গ্যারেনায় রেজিস্টার্ড নেই | UID চেক করুন |
| **`500 / 502`** | Server Error | গ্যারেনা গেটওয়ে সাময়িক ডাউন | ২-৩ সেকেন্ড পর রিট্রাই করুন |

---

## ⚡ ৯. পারফরম্যান্স ও ক্যাশিং (Edge Caching)
- এই API-তে **Vercel Global Edge Caching** যুক্ত করা আছে (`s-maxage=300, stale-while-revalidate=600`)।
- একই UID ৫ মিনিটের মধ্যে যতবারই সার্চ করা হোক, তা মিলিসেকেন্ডের মধ্যে বিশ্বের নিকটতম Vercel CDN সার্ভার থেকে সার্ভ করা হয়। এর ফলে কোনো ধরনের থার্ড-পার্টি রেট-লিমিট বা স্লোডাউন তৈরি হয় না।

---

## 🔐 ১০. নিজস্ব গেস্ট বট কনফিগারেশন (ঐচ্ছিক)
আপনি যদি সরাসরি আপনার নিজস্ব Free Fire গেস্ট বট অ্যাকাউন্ট ব্যবহার করতে চান:
1. Vercel ড্যাশবোর্ডে গিয়ে প্রজেক্টের **Settings** ➔ **Environment Variables**-এ যান।
2. নিচের ২টি ভ্যারিয়েবল যোগ করুন:
   - `BOT_UID`: আপনার গেস্ট অ্যাকাউন্টের UID
   - `BOT_PASSWORD`: আপনার গেস্ট অ্যাকাউন্টের হেক্স পাসওয়ার্ড
3. এরপর প্রজেক্টটি একবার **Redeploy** করলেই আপনার API সম্পূর্ণ আপনার নিজস্ব গেস্ট অ্যাকাউন্ট দিয়ে সরাসরি গ্যারেনায় কানেক্ট হবে।
