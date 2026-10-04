# 🚀 Swasthya Desktop Application (Electron)

Ye folder aapki Swasthya desktop application ke liye configure kiya gaya hai. Yahan se aap apni live link ko direct Windows Desktop App (`.exe`) me convert aur build kar sakte hain.

---

## 📌 Step 1: Apni Live / Vercel Link Kahan Daalni Hai?

Current link already set hai: `https://swasthya.tanmaymirgal.dev`

Agar aapko future me link change karni ho, toh 2 simple options hain:

### Option A: `.env` file me (Recommended)
`electron/.env` file kholein aur apni link paste karein:
```env
APP_URL=https://swasthya.tanmaymirgal.dev
```

### Option B: `electron.config.json` me
`electron/electron.config.json` file kholein:
```json
{
  "appUrl": "https://swasthya.tanmaymirgal.dev"
}
```

---

## 💻 Step 2: Install Dependencies (Sirf Pehli Baar)

Terminal me `electron` folder ke andar jaakar run karein:
```bash
cd electron
npm install
```

---

## 🏃 Step 3: Local Test Run Karna

Desktop app ko direct open karke check karne ke liye:
```bash
npm start
```
*(App turant khulegi aur aapki Vercel live website ko native desktop app me load karegi)*

---

## 📦 Step 4: Windows Desktop App (`.exe`) Build Karna

Apna standalone Windows installer aur portable `.exe` banane ke liye:
```bash
npm run dist
```

### Build Kahan Milega?
Command complete hone ke baad `electron/dist/` folder me aapko milenge:
1. **`Swasthya Setup 1.0.0.exe`** - Windows Installer
2. **`Swasthya 1.0.0.exe`** - Direct Portable run file (bina install kiye chalane ke liye)
3. **`win-unpacked/Swasthya.exe`** - Ready to run unpacked folder

---

## ✨ Features Included:
- ✅ **Auto Camera & Mic Permissions**: RehabLens ke MediaPipe AI pose tracking aur Doctor-Patient video call ke liye automatic camera/mic permissions granted hain (no browser popups).
- ✅ **Offline Screen**: Agar internet down ho ya Vercel link reachable na ho toh sleek dark-mode retry screen aayegi.
- ✅ **Keyboard Shortcuts**:
  - `F5` ya `Ctrl + R` -> Page reload
  - `Ctrl + Shift + I` -> Inspect / Developer Console
