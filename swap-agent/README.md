# CPH Swap Agent — your PC's swap crawler & harvester

Two watchable robots that run on your Windows PC in a real Chrome window:

| Script | What it does |
|---|---|
| **`pull-swaps.js`** (the crawler) | Logs into BookClicker + BookSwappy + BookFunnel, grabs every swap you've signed up for, sorts them by pen name, and writes `composer-import.json` — which imports straight into the **CPH Newsletter Composer** with one click. Plus an HTML report you can eyeball. |
| **`book-swaps.js`** (the harvester) | Browses the marketplaces and signs a pen name up for **free mention swaps** matching her genre rules (from your swap playbooks: free only, no erotica/LGBTQ, 1 per author, genre + heat match). Dry-run by default; `--book` to submit, confirming each one; `--book --yes` for fully automatic. |

Unlike the Mac Cowork setup (which only runs when you paste a prompt), this one
is **yours to watch and schedule**: the browser is visible, every run writes a
log + report, and Task Scheduler can run the crawler automatically before each
send day.

---

## One-time setup (Windows PC)

1. Install **Node.js LTS** from https://nodejs.org (accept defaults).
2. Copy this `swap-agent` folder somewhere easy, e.g. `C:\CPH\swap-agent`.
3. Open **PowerShell** in that folder (Shift+Right-click → "Open PowerShell window here") and run:
   ```powershell
   npm install
   npx playwright install chromium
   node login.js
   ```
4. A Chrome window opens with three tabs — **log in to BookClicker, BookSwappy,
   and BookFunnel with Jessica's account**, then close the window.
   Logins are saved in `.browser-profile\` and reused from then on.

## Weekly use

```powershell
node pull-swaps.js          # watch it crawl; results land in output\
```
Then open `output\report-<date>.html` to review, and import
`output\composer-import.json` into the **CPH Newsletter Composer**
(`book-marketing/cph-swap-module-builder.html` → "Import swaps JSON").

Booking new swaps:
```powershell
node book-swaps.js --pen sage             # dry run — just lists matches
node book-swaps.js --pen marjorie --book  # books, asking y/n for each
node book-swaps.js --pen nora --book --yes  # fully automatic
```

## Run it on a schedule (so it IS "already doing the work")

Task Scheduler → Create Basic Task:
- **Name:** CPH swap pull
- **Trigger:** Weekly → Mon, Tue, Wed (before each send day), e.g. 7:00 AM
- **Action:** Start a program
  - Program: `C:\Program Files\nodejs\node.exe`
  - Arguments: `pull-swaps.js --headless`
  - Start in: `C:\CPH\swap-agent`

Each run appends to `output\agent.log` and drops a dated report, so you can
always see what it did and when.

## First-run calibration (important)

These dashboards are login-only, so the extractors use resilient heuristics
rather than exact selectors. On the first run, if any platform reports **0
swaps** (or the report looks wrong), grab the files it saved in `snapshots\`
and hand them to Claude — the selectors get tightened to that site's exact
markup in one pass. After calibration it's routine.

## Safety rails baked in

- **Free swaps only** — anything showing a price is filtered out and flagged.
- **Harvester never books silently** unless you explicitly pass `--yes`.
- Genre/heat rules per pen name live in `config.js` — edit there, not in code.
- Nothing is stored outside this folder; logins stay in the local browser profile.
