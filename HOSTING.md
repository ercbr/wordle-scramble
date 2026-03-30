# Hosting Wordle Scramble

## Local Development (LAN Play)

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
npm install
```

### Running
Start both servers in separate terminals:

```bash
# Terminal 1: Vite dev server (frontend)
npm run dev

# Terminal 2: PartyKit dev server (multiplayer backend)
npm run dev:partykit
```

### Accessing from other devices on your network

The app is available at:
- **This machine:** http://localhost:5173
- **Other devices:** http://<YOUR_IP>:5173

Find your IP:
```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr IPv4
```

### macOS Firewall

If other devices can't connect, the macOS firewall may be blocking Node.js:

```bash
# Allow Node.js through the firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

The `vite.config.js` already binds to `0.0.0.0` so Vite listens on all interfaces. The PartyKit dev server does this by default.

---

## Production Deployment

The app has two parts that deploy separately:

| Component | Platform | Purpose |
|-----------|----------|---------|
| Frontend (React) | Vercel | Serves the UI |
| Backend (PartyKit) | PartyKit Cloud (Cloudflare) | WebSocket multiplayer server |

### 1. Deploy PartyKit Server

```bash
npx partykit deploy
```

This deploys to `https://wordle-scramble.<your-username>.partykit.dev`. Note this URL.

### 2. Deploy Frontend to Vercel

```bash
npm i -g vercel
vercel
```

When prompted, or in the Vercel dashboard, set the environment variable:

```
VITE_PARTYKIT_HOST=wordle-scramble.<your-username>.partykit.dev
```

Build settings (auto-detected by Vercel for Vite):
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

### 3. Verify

- Open the Vercel URL
- Click "Play Online" > "Create Room"
- Open the same URL on another device and join with the room code

---

## Alternative Hosting

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify, or connect your Git repo
```
Set `VITE_PARTYKIT_HOST` as an environment variable.

### Cloudflare Pages
- Connect your repo
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_PARTYKIT_HOST` env var

### Self-hosted (any static server)
```bash
npm run build
# Serve the dist/ folder with nginx, caddy, etc.
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_PARTYKIT_HOST` | Production only | `<window.location.hostname>:1999` | PartyKit server host for WebSocket connections |

In development, the app automatically connects to the PartyKit dev server on the same hostname the browser loaded from (so LAN play works without configuration).

---

## Architecture

```
Browser ──HTTP──> Vercel (static files)
Browser ──WebSocket──> PartyKit (game state)
```

- **Local play** works entirely client-side (no server needed)
- **Online play** requires the PartyKit server for room creation and state sync
- Game history is stored in the browser's `localStorage`
