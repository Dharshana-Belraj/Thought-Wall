Setup for GitHub + Vercel

1) Local dev (quick):
- Copy `.env.example` to `.env` and fill your Supabase values.
- Run `node build-config.js` (or `npm run build`) to generate `site/config.js` from env vars.
- Open `site/index.html` in your browser (double-click) to test locally.

2) Prepare for GitHub / Vercel:
- Commit everything except `.env` and `site/config.js` (they are in `.gitignore`).
- On Vercel, set the project env vars `SUPABASE_URL` and `SUPABASE_KEY` (Project Settings → Environment Variables).
- In Vercel's project settings set the Build Command to:

  npm run build

- Set the Output Directory to:

  site

Vercel will run `npm run build` during build, which generates `site/config.js` from the environment variables and then deploy the `site` folder as a static site.

Security note:
- Keep `SUPABASE_KEY` as the public/anon key if you use it from client-side code. Do NOT commit private service keys.
