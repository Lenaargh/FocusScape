<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FocusScape

AI-powered soundscapes for neurodivergent minds. Mix background noise, binaural beats, and AI-generated synths to build your perfect focus environment.

## Getting Started

Users need a free **Gemini API key** to use the AI features. You can get one at [Google AI Studio](https://aistudio.google.com/apikey). When you open FocusScape, you'll be prompted to paste your key — it's stored locally in your browser and never sent anywhere except directly to the Gemini API.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000) and paste your Gemini API key when prompted.

> **Private mode:** If you set `GEMINI_API_KEY` in a `.env.local` file, the app will use that key automatically and skip the setup prompt. This is useful for personal deployments.

## Deploy

The app supports two modes:

- **BYOK (default):** Deploy without setting `GEMINI_API_KEY`. Users enter their own key in the browser. No server-side secrets needed — just host the static files.
- **Private / built-in key:** Set `GEMINI_API_KEY` at build time. The key is embedded in the JS bundle and used automatically. Only use this for personal/private deployments.

### Vercel

Deployment settings are pre-configured in [`vercel.json`](vercel.json).

1. Push your code to a GitHub repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Click **Deploy** — no environment variables needed (users provide their own key).

### Netlify

Deployment settings are pre-configured in [`netlify.toml`](netlify.toml).

1. Push your code to a GitHub repository.
2. Import the repository at [app.netlify.com](https://app.netlify.com) and choose **Add new site → Import an existing project**.
3. Click **Deploy site** — no environment variables needed.

### Self-hosting / Static Hosting

1. Build the production bundle:
   ```sh
   npm run build
   ```
2. The static files are generated in the `dist/` directory.
3. Serve the `dist/` folder with any static file server (nginx, Apache, Caddy, `serve`, etc.).
