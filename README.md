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

### AI Studio (Recommended)

This app is built for [Google AI Studio](https://ai.google.dev/aistudio). Open the link below to view and redeploy it directly from AI Studio:

https://ai.studio/apps/cdfe12e8-77c2-4d49-a790-3dfe14091c11

AI Studio automatically injects the `GEMINI_API_KEY` and `APP_URL` secrets at runtime — no manual configuration needed.

### Vercel

1. Push your code to a GitHub repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Set the **Build Command** to `npm run build` and the **Output Directory** to `dist`.
4. Add the `GEMINI_API_KEY` environment variable in **Project Settings → Environment Variables**.
5. Click **Deploy**.

### Netlify

1. Push your code to a GitHub repository.
2. Import the repository at [app.netlify.com](https://app.netlify.com) and choose **Add new site → Import an existing project**.
3. Set the **Build Command** to `npm run build` and the **Publish Directory** to `dist`.
4. Add the `GEMINI_API_KEY` environment variable under **Site configuration → Environment variables**.
5. Click **Deploy site**.

### Self-hosting / Static Hosting

1. Build the production bundle:
   ```sh
   npm run build
   ```
2. The static files are generated in the `dist/` directory.
3. Serve the `dist/` folder with any static file server (nginx, Apache, Caddy, `serve`, etc.).
4. Make sure the `GEMINI_API_KEY` environment variable is available at **build time** (it is embedded into the bundle by Vite).

> **Security note:** Because Vite injects `GEMINI_API_KEY` directly into the client-side JavaScript bundle, anyone who downloads your app can extract the key. Use [API key restrictions](https://ai.google.dev/gemini-api/docs/api-key) in Google AI Studio to limit the key to specific HTTP referrers, and consider a short-lived or project-scoped key when self-hosting publicly.
