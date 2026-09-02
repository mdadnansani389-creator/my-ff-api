# 🎮 Free Fire Player Info Custom API (Node.js & Vercel)

[![Live API](https://img.shields.io/badge/API-Live%20on%20Vercel-success?style=for-the-badge&logo=vercel)](https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

একটি উচ্চগতির ও আধুনিক **Free Fire Player Info REST API** যা গ্যারেনার অফিসিয়াল গেটওয়ে ও প্রোটোবাফ আর্কিটেকচার থেকে রিয়েল-টাইমে প্লেয়ারের সম্পূর্ণ প্রোফাইল ডেটা (নাম, লেভেল, লাইক, র্যাঙ্ক, অ্যাভাটার, ব্যানার, বায়ো ইত্যাদি) ফেচ করে দেয়।

---

## 🌐 লাইভ এন্ডপয়েন্ট (Live Endpoint)

```http
GET https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID&region=BD
```

> 📖 **সম্পূর্ণ ডকুমেন্টেশন ও কোড উদাহরণের জন্য [API_DOCUMENTATION.md](API_DOCUMENTATION.md) ফাইলটি দেখুন।**

---

## 🚀 কুইক স্টার্ট (Quick Start)

### ব্রাউজারে টেস্ট লিংক:
[https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID&region=BD](https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID&region=BD)

### JavaScript দিয়ে ডেটা ফেচ:
```javascript
fetch("https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID")
  .then(res => res.json())
  .then(data => console.log(data));
```

### Python দিয়ে ডেটা ফেচ:
```python
import requests
res = requests.get("https://my-ff-api-three.vercel.app/api/player-info?uid=YOUR_UID")
print(res.json())
```

---

## 💻 লোকালি চালানোর নিয়ম (Local Setup)

```bash
# ১. রিপোজিটরি ক্লোন করুন
git clone https://github.com/mdadnansani389-creator/my-ff-api.git
cd my-ff-api

# ২. প্যাকেজ ইনস্টল করুন
npm install

# ৩. লোকাল সার্ভার রান করুন
node server.js
```
সার্ভারটি `http://localhost:3000`-এ চালু হবে।

---

## ⚙️ প্রজেক্ট স্ট্রাকচার (Project Structure)
```
├── api/
│   └── player-info.js       # Vercel Serverless Function (Primary API)
├── vercel.json              # Vercel রুট কনফিগারেশন
├── server.js                # লোকাল এক্সপ্রেস সার্ভার
├── package.json             # ডিপেন্ডেন্সি লিস্ট
├── API_DOCUMENTATION.md     # পূর্ণাঙ্গ API ডকুমেন্টেশন
└── README.md                # প্রজেক্ট পরিচিতি
```
