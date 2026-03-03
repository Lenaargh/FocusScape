<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cdfe12e8-77c2-4d49-a790-3dfe14091c11

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy

> **Important — API key exposure:** Vite embeds `GEMINI_API_KEY` into the client-side JavaScript bundle at build time. This means **anyone who visits your deployed app can extract the key** from the browser's JS source. On AI Studio this is handled for you, but for all other platforms you should:
> 1. [Restrict the key](https://ai.google.dev/gemini-api/docs/api-key) to specific HTTP referrers in Google AI Studio
> 2. Use a short-lived or project-scoped key
> 3. Set a usage quota / budget cap on the key

### AI Studio (Recommended)

This app is built for [Google AI Studio](https://ai.google.dev/aistudio). Open the link below to view and redeploy it directly from AI Studio:

https://ai.studio/apps/cdfe12e8-77c2-4d49-a790-3dfe14091c11

AI Studio automatically injects the `GEMINI_API_KEY` and `APP_URL` secrets at runtime — no manual configuration needed.

### Vercel

Deployment settings are pre-configured in [`vercel.json`](vercel.json).

1. Push your code to a GitHub repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add the `GEMINI_API_KEY` environment variable in **Project Settings → Environment Variables**.
4. Click **Deploy**.

### Netlify

Deployment settings are pre-configured in [`netlify.toml`](netlify.toml).

1. Push your code to a GitHub repository.
2. Import the repository at [app.netlify.com](https://app.netlify.com) and choose **Add new site → Import an existing project**.
3. Add the `GEMINI_API_KEY` environment variable under **Site configuration → Environment variables**.
4. Click **Deploy site**.

### Self-hosting / Static Hosting

1. Build the production bundle:
   ```sh
   npm run build
   ```
2. The static files are generated in the `dist/` directory.
3. Serve the `dist/` folder with any static file server (nginx, Apache, Caddy, `serve`, etc.).
4. Make sure the `GEMINI_API_KEY` environment variable is available at **build time** (it is embedded into the bundle by Vite).
