# Kitchen Studio

Commercial kitchen design for operators. A static web app (vanilla JS, no framework) with accounts, saved kitchens, share links and an AI proxy on Supabase.

```
src/            head.html (markup + CSS), app.js, cat.js (catalogue), symbols.js, view3d.js, cloud.js (Supabase layer)
site/           landing page
vendor/         three r128, jsPDF, svg2pdf, pdf.js (served from /app/vendor)
public/         favicon, robots, screenshots, sample floor plan
supabase/       migrations/0001_init.sql, functions/ai (edge function)
tests/          Playwright end-to-end test with a mock backend, static server
build.mjs       builds dist/ (site), dist-artifact/ (claude.ai artifact), dist-standalone/ (single offline file)
```

## Build

```
npm install
npm run build            # dist/  → landing at /, app at /app, share links at /k/<id>
npm run build:standalone # one offline HTML file
npm test                 # builds nothing; run `npm run build` first
```

Environment variables read at build time (all optional; without them the app runs local-only, saving in the browser):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | the `anon public` key (safe in the browser; row-level security does the protecting) |
| `SITE_URL` | the public site, e.g. `https://kitchenstudio.design` (sign-in redirects, share links) |

## Deploy (once)

1. **Supabase**: create a project. Open SQL Editor, paste `supabase/migrations/0001_init.sql`, Run. Authentication → URL Configuration: set Site URL to the site and add `https://<site>/app/` (and the `*.pages.dev` preview URL) to Redirect URLs. Email sign-in is on by default; enable Google under Providers if wanted.
2. **Cloudflare Pages**: Workers & Pages → Create → Pages → Connect to Git → this repo. Build command `npm run build`, output directory `dist`. Add the three environment variables above. Every push to `main` deploys.
3. **Domain**: Pages → Custom domains → add it. Cloudflare handles DNS and HTTPS.
4. **AI (optional)**: needs an Anthropic API key. `npm i -g supabase && supabase login && supabase link --project-ref <ref>`, then `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` and `supabase functions deploy ai`. Optional secrets: `AI_MODEL` (default `claude-sonnet-4-5`), `AI_DAILY_LIMIT` (default 40 calls per user per day). Until this is done, the AI brief and model lookup show "didn't work" and everything else runs.

## How it fits together

- The browser talks to Supabase directly with the anon key; row-level security restricts every table to the signed-in owner. Share links go through the `shared_project(pid)` function, which returns only name and data of a project whose `is_public` is on.
- A kitchen is one row in `projects` with the app's JSON in `data` (same JSON as the "Save project file" export, with a `v` version for migrations). Floor-plan images over 1.5 MB stay on the device only.
- Without a backend (`KS_backend` null) the app saves to `localStorage`, exactly as the offline file does. The claude.ai artifact build uses the artifact `db` capability instead.
- The edge function is the only place an Anthropic key exists. It checks the user's JWT, counts calls in `ai_usage`, and returns parsed JSON.

## Conventions

Single-file modules, no bundler, no framework. `KS_ui` exposes a few functions for tests and the reel recorder. Colours come from CSS tokens in `head.html`; the plan and PDF read them into literal values so exports keep them. Keep everything working in the offline file: any feature that needs the network must degrade to a sentence, not an error.
