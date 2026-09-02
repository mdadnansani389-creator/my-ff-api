# Free Fire Custom Player Info API (Node.js & Vercel)

এই প্রজেক্টটি একটি কাস্টম Free Fire API যা গ্যারেনা গেটওয়ে ও প্রোটোবাফ ব্যবহার করে যেকোনো প্লেয়ারের প্রোফাইল ডেটা (নাম, লেভেল, লাইক, র‍্যাঙ্ক, ব্যানার, অ্যাভাটার ইত্যাদি) ফেচ করে দেয়।

---

## ১. লোকালি কীভাবে টেস্ট করবেন (Local Testing)

১. টার্মিনালে `ff-api` ফোল্ডারে ঢুকুন:
```bash
cd c:\Users\user\Desktop\FFBIO\ff-api
```

২. ডিপেন্ডেন্সি ইনস্টল করুন:
```bash
npm install
```

৩. সার্ভার চালু করুন:
```bash
node server.js
```
সার্ভারটি `http://localhost:3000`-এ চালু হবে।

৪. ব্রাউজারে টেস্ট করুন:
```
http://localhost:3000/api/player-info?uid=3000391898
```

---

## ২. Vercel-এ ফ্রিতে ডিপ্লয় করার নিয়ম (Free Vercel Deployment)

### পদ্ধতি A: GitHub দিয়ে (সবচেয়ে সহজ)
1. **GitHub Repository তৈরি করুন**:
   - [github.com](https://github.com)-এ গিয়ে একটি নতুন Repository তৈরি করুন (যেমন: `my-ff-api`)।
   - `ff-api` ফোল্ডারের কোডটুকু সেখানে পুশ করুন:
     ```bash
     cd c:\Users\user\Desktop\FFBIO\ff-api
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/my-ff-api.git
     git push -u origin main
     ```
2. **Vercel-এ ডিপ্লয় করুন**:
   - [vercel.com](https://vercel.com)-এ গিয়ে আপনার GitHub একাউন্ট দিয়ে লগইন করুন।
   - **"Add New..."** ➔ **"Project"**-এ ক্লিক করুন।
   - আপনার `my-ff-api` রিপোজিটরিটি সিলেক্ট করে **"Deploy"** বাটনে ক্লিক করুন।
3. **লাইভ URL পাওয়া**:
   - Vercel আপনাকে একটি ফ্রি লিঙ্ক দেবে, যেমন:
     `https://my-ff-api.vercel.app/api/player-info?uid=3000391898`

---

## ৩. আপনার PHP ওয়েবসাইটে এই API কানেক্ট করা

আপনার ওয়েবসাইটের `index.php` ফাইলের শুরুতে `$apiBase` লাইনে আপনার নতুন Vercel লিংকটি বসিয়ে দিন:

```php
$apiBase = "https://my-ff-api.vercel.app/api/player-info";
```
এখন আপনার ওয়েবসাইট সম্পূর্ণ আপনার নিজস্ব Vercel API থেকে আনলিমিটেড স্পিডে চলবে!
