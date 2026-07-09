// THE HARVESTER — browses the swap marketplaces and signs your pen names up
// for FREE mention swaps that match each pen name's genre rules (from the
// swap-*.md playbooks: free only, no erotica/LGBTQ, 1 swap per author,
// genre + heat compatibility).
//
// SAFE BY DEFAULT: without --book it only *finds and lists* matches (dry run).
// With --book it opens each match, fills the form, and pauses for you to click
// Send Offer yourself unless you also pass --yes.
//
//   node book-swaps.js --pen sage                 dry run: list matches for Sage
//   node book-swaps.js --pen marjorie --book      book, confirming each in the terminal
//   node book-swaps.js --pen nora --book --yes    fully automatic (use once trusted)
//
// Booking forms differ per site and change over time. This script handles the
// find-and-filter half deterministically; the form-fill half runs HEADED and
// highlights the target so you can watch every submission. If a site's form
// changes, snapshots land in snapshots/ for recalibration.

const readline = require("readline");
const config = require("./config");
const { launchBrowser, looksPaid, isLoggedOut, snapshot, log } = require("./lib");

const args = process.argv.slice(2);
const PEN = (args[args.indexOf("--pen") + 1] || "").toLowerCase();
const BOOK = args.includes("--book");
const YES = args.includes("--yes");

const pen = config.penNames[PEN];
if (!pen) {
  console.log("Usage: node book-swaps.js --pen <connie|ruthie|sage|marjorie|kelsey|nora> [--book] [--yes]");
  process.exit(1);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a.trim().toLowerCase()); }));
}

function genreOk(text) {
  const t = text.toLowerCase();
  if (config.globalRules.excludeAlways.some(g => t.includes(g))) return false;
  if ((pen.genresExclude || []).some(g => t.includes(g))) return false;
  return (pen.genresInclude || []).some(g => t.includes(g));
}

async function findListings(page, platformName) {
  await page.waitForTimeout(3500);
  if (await isLoggedOut(page)) {
    log(`${platformName}: not logged in — run "node login.js" first.`);
    return [];
  }
  // Collect marketplace listing cards: text + a "book"/"calendar"/profile link.
  const listings = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("tr, li, [class*=card], [class*=listing], [class*=result], [class*=row]")) {
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 30 || text.length > 900) continue;
      const link = [...el.querySelectorAll("a[href], button")].map(a => a.href || "").find(h => h);
      const key = text.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text, link: link || null });
    }
    return out;
  });
  return listings.filter(l => genreOk(l.text) && !looksPaid(l.text));
}

(async () => {
  log(`Harvester for ${pen.label} — magnet: ${pen.magnets[0] || "(none set!)"} — mode: ${BOOK ? (YES ? "AUTO-BOOK" : "book w/ confirm") : "DRY RUN"}`);
  if (!pen.magnets.length) { log("No reader magnet configured for this pen name — set it in config.js first."); process.exit(1); }

  const ctx = await launchBrowser({ headless: false }); // always headed: watch it work
  const matches = [];

  for (const [name, plat] of Object.entries({ bookclicker: config.platforms.bookclicker, bookswappy: config.platforms.bookswappy })) {
    const page = await ctx.newPage();
    log(`${name}: opening marketplace…`);
    try {
      await page.goto(plat.marketplaceUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      const found = await findListings(page, name);
      log(`${name}: ${found.length} genre-matched free listings`);
      if (!found.length) await snapshot(page, `${name}-marketplace`);
      for (const f of found) matches.push({ ...f, platform: name });
    } catch (e) {
      log(`${name}: ERROR ${e.message}`);
    }
    await page.close();
  }

  log("");
  log(`=== ${matches.length} candidate partners for ${pen.label} ===`);
  matches.forEach((m, i) => log(`${String(i + 1).padStart(2)}. [${m.platform}] ${m.text.slice(0, 130)}`));

  if (!BOOK) {
    log("");
    log("Dry run complete. Re-run with --book to open each match and submit the swap");
    log(`offer (book: "${pen.magnets[0]}", list: "${pen.bookclickerList}", Mention, free).`);
    await ctx.close();
    return;
  }

  // Booking pass: open each candidate headed; auto-fill what we can recognize,
  // and either wait for terminal confirmation or (--yes) submit.
  let booked = 0;
  for (const m of matches) {
    if (!m.link) continue;
    const page = await ctx.newPage();
    try {
      await page.goto(m.link, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      // Try to open a Mention slot and fill the standard fields.
      const mention = page.getByText(/mention/i).first();
      if (await mention.count()) await mention.click({ timeout: 3000 }).catch(() => {});
      for (const sel of await page.locator("select").all()) {
        const options = await sel.locator("option").allInnerTexts().catch(() => []);
        const magnetIdx = options.findIndex(o => o.toLowerCase().includes(pen.magnets[0].toLowerCase().slice(0, 18)));
        const listIdx = options.findIndex(o => o.toLowerCase().includes(pen.bookclickerList.toLowerCase().slice(0, 12)));
        if (magnetIdx >= 0) await sel.selectOption({ index: magnetIdx }).catch(() => {});
        else if (listIdx >= 0) await sel.selectOption({ index: listIdx }).catch(() => {});
      }
      log(`Prepared: [${m.platform}] ${m.text.slice(0, 90)}`);
      let go = true;
      if (!YES) {
        const a = await ask("  Submit this swap offer? (y/n/stop) ");
        if (a === "stop") { log("Stopped by user."); await page.close(); break; }
        go = a === "y";
      }
      if (go) {
        const send = page.getByRole("button", { name: /send offer|request swap|submit|send request/i }).first();
        if (await send.count()) { await send.click(); booked++; log("  → submitted ✔"); await page.waitForTimeout(2000); }
        else { log("  → couldn't find the submit button — snapshot saved for recalibration"); await snapshot(page, `${m.platform}-form`); }
      }
    } catch (e) {
      log(`  booking error: ${e.message}`);
    }
    await page.close().catch(() => {});
  }

  log("");
  log(`Booking pass done — ${booked} offers submitted for ${pen.label}.`);
  await ctx.close();
})();
