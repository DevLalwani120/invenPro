# 📦 InvenPro v2 — Setup Guide

## ▶️ Run the App

```bash
npm install
npm run dev
```
Open http://localhost:5173

---

## 🔥 Step 1 — Firebase Config

Open `src/firebase/config.js` and paste your Firebase project keys.

---

## 📧 Step 2 — GitHub Actions Email Alert Setup

### 2a. Get Gmail App Password
1. Go to myaccount.google.com
2. Search "App Passwords"
3. App: Mail · Device: Other → type "InvenPro" → Generate
4. Copy the 16-digit password

### 2b. Get Firebase Service Account Key
1. Firebase Console → Project Settings → Service Accounts tab
2. Click "Generate New Private Key" → downloads a JSON file
3. Open that JSON file — you need these 3 values:
   - `project_id`
   - `client_email`
   - `private_key` (the whole long string)

### 2c. Push to GitHub
```bash
git init
git add .
git commit -m "InvenPro v2"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2d. Add GitHub Secrets
Repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name            | Value                                          |
|------------------------|------------------------------------------------|
| FIREBASE_PROJECT_ID    | your project_id from service account JSON      |
| FIREBASE_CLIENT_EMAIL  | your client_email from service account JSON    |
| FIREBASE_PRIVATE_KEY   | your private_key from service account JSON     |
| GMAIL_USER             | yourname@gmail.com                             |
| GMAIL_APP_PASSWORD     | 16-digit app password from Step 2a             |
| ALERT_EMAILS           | Owner:you@gmail.com,Manager:mgr@gmail.com,Staff:staff@gmail.com |

### 2e. Test Immediately
Repo → Actions tab → "Daily Inventory Alert" → Run workflow → Run workflow

Email arrives within 1 minute ✅

---

## ✅ What Changed in v2

- ❌ HSN code removed from Item Master
- ✅ Navbar taller + subtitle added
- ✅ Main content stretches full height
- ✅ Supplier field in Batch Manager is now a dropdown
- ✅ Ledger Master added (manage suppliers & customers)
- ✅ "Other" option in supplier dropdown → saves directly to Ledger Master
- ✅ GitHub Actions sends email at 9 AM IST daily via your own Gmail
- ✅ Email includes supplier name from Ledger
