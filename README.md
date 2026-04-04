# HYB Finance

Personal finance tracker — income, expenses, debts, goals, and budgets.
Cloud-backed via Supabase. Deployable as a static web app.

## Project Structure

```
HYB Finance/
├── index.html              # HTML shell — zero inline JS
├── config.js               # ⚠️  GITIGNORED — real credentials (copy from config.example.js)
├── config.example.js       # Committed template — fill in your values
├── supabase_schema.sql     # Run once in Supabase SQL Editor to set up all tables
├── .gitignore
├── css/
│   └── styles.css          # All styles
└── js/
    ├── constants.js        # Categories, colors, default limits, plan config
    ├── utils.js            # Pure utility functions (date, format, math)
    ├── state.js            # Global in-memory state + computed selectors
    ├── db.js               # All Supabase CRUD — single point of DB access
    ├── auth.js             # Authentication lifecycle (init, sign-in/up, sign-out)
    ├── charts.js           # Chart.js rendering (all 5 charts)
    ├── app.js              # Main orchestrator — renders everything, exposes window.App
    └── ui/
        ├── toast.js        # Toast notification display
        ├── kpi.js          # KPI cards + weekly progress bar
        ├── today.js        # Today's entries + calendar widget
        ├── budget.js       # Budget limits + weekly cash flow grid
        ├── debts.js        # Debt/receivable cards + actions
        ├── goals.js        # Goal cards + deposit/delete actions
        └── modals.js       # Transaction, debt, and goal modals + autocomplete
```

## First-Time Setup

### 1. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase_schema.sql`
3. Copy your **Project URL** and **Anon Key** from Settings → API

### 2. Configure credentials
```bash
cp config.example.js config.js
# Edit config.js — fill in your supabase.url and supabase.anonKey
```

### 3. Run locally
Because the app uses ES modules (`type="module"`), it must be served over HTTP — not opened as a file.

```bash
# Any of these work:
npx serve .
python3 -m http.server 3000
npx http-server .
```

Then open `http://localhost:3000` in your browser.

### 4. Deploy
- **Vercel:** `npx vercel` inside this folder
- **Netlify:** Drag-and-drop the folder at netlify.com/drop
- **GitHub Pages:** Push to GitHub, enable Pages in repository Settings

> ⚠️ Never commit `config.js`. Add it to Netlify/Vercel environment via their dashboard as `window.APP_CONFIG` injection, or use a build step.

## Architecture Principles

- **Zero bundler dependency** — runs natively in modern browsers via ES modules
- **Single source of truth** — all data lives in `state.js`; DB writes go through `db.js`
- **No hardcoded values** — all config in `config.js`, all categories/colors in `constants.js`
- **Separation of concerns** — each UI panel is its own module; `app.js` only orchestrates
