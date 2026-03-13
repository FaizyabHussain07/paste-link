# 📋 PasteLink Pro
> **Share any text, securely.** Minimal, fast, and auto-deleting text sharing platform.

PasteLink is a modern, production-ready text sharing application built with privacy and speed in mind. It uses **Upstash Redis** for high-performance temporary storage and **Vercel Serverless Functions** for secure backend operations.

---

## ✨ Features
- 🔒 **Zero-Knowledge Security**: Passwords are hashed in the browser (SHA-256).
- 🔥 **Burn After Read**: Content self-destructs immediately after the first view.
- ⏱️ **Live Countdown**: Real-time per-second countdown on the viewer page.
- 📱 **QR Code Sharing**: Instant link sharing via scan-to-mobile modal.
- 🌑 **Premium UI**: Minimalist glassmorphism design with dark mode support.
- 🚀 **Performance**: Powered by global Redis with TTL (Time-To-Live) auto-deletion.

---

## 🛠️ Production Setup (Vercel)

Follow these steps to deploy your own instance securely:

### 1. Database Setup (Upstash)
1. Sign up at [Upstash.com](https://upstash.com/).
2. Create a new **Redis** database (Free Tier).
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the database dashboard.

### 2. Deployment
Click the button below or use the CLI:

1. Push this code to a **GitHub/GitLab** repository.
2. Import the project into **Vercel**.
3. In **Settings > Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL`: *[Your URL]*
   - `UPSTASH_REDIS_REST_TOKEN`: *[Your Token]*
4. Deploy! 🎉

---

## 📁 File Structure
```
├── index.html       # Homepage (Editor & Link Generation)
├── view.html        # Viewer Page (Password Gate & Content)
├── style.css        # Modern Design System
├── script.js        # Core frontend logic
├── view.js          # Viewer logic & countdown
├── db.js            # Secure API wrapper
└── api/             # Serverless Functions (Secure Backend)
    ├── save.js      # Handles SET operation
    ├── get.js       # Handles GET operation
    └── delete.js    # Handles DEL operation
```

---

## 🔒 Security Architecture
- **Tokens are Hidden**: The Upstash token is stored as a Vercel Environment Variable. It is never exposed to the user's browser.
- **Backend Proxy**: Browser → Vercel Function → Redis. This prevents unauthorized database access.
- **XSS Protection**: All content is rendered using `textContent` to prevent script injection.
- **Rate Limiting**: Upstash free tier includes built-in protection.

---

## 📈 SEO Optimized
- Semantic HTML5 structure.
- OpenGraph & Twitter Card support for rich social media previews.
- Dynamic SVG Favicon for modern browser support.
- Optimized keyword distribution for "text share" and "pastebin" queries.

---
© 2026 PasteLink Project. No tracking. No ads. Just sharing.
