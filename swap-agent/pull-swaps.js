// THE CRAWLER — pulls confirmed swaps from BookClicker, BookSwappy, and
// BookFunnel and writes newsletter-ready output:
//
//   output/swaps-YYYY-MM-DD.json        raw scrape, everything found
//   output/composer-import.json         per-pen-name modules — import this
//                                       straight into the CPH Newsletter
//                                       Composer (Import swaps JSON button)
//   output/report-YYYY-MM-DD.html       human-readable report to eyeball
//
// Usage:
//   node pull-swaps.js                  headed (watch it work)
//   node pull-swaps.js --headless       silent (for Task Scheduler)
//
// First run is a calibration run: if a platform yields 0 swaps, a full-page
// snapshot lands in snapshots/ — send those to Claude and the extractor gets
// tightened for that site's exact markup.

const fs = require("fs");
const path = require("path");
const config = require("./config");
const { launchBrowser, extractSwapCards, attribute, looksPaid, isLoggedOut, snapshot, log, stamp, OUT_DIR } = require("./lib");

const HEADLESS = process.argv.includes("--headless");

async function scrape(ctx, platformKey, url) {
  const page = await ctx.newPage();
  log(`${platformKey}: opening ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500); // let SPA content render
    if (await isLoggedOut(page)) {
      log(`${platformKey}: NOT LOGGED IN — run "node login.js" first. Skipping.`);
      await snapshot(page, `${platformKey}-loggedout`);
      await page.close();
      return [];
    }
    const cards = await extractSwapCards(page);
    log(`${platformKey}: found ${cards.length} candidate swap entries`);
    if (cards.length === 0) await snapshot(page, `${platformKey}-empty`);
    await page.close();
    return cards.map(c => ({ ...c, platform: platformKey }));
  } catch (e) {
    log(`${platformKey}: ERROR ${e.message}`);
    await snapshot(page, `${platformKey}-error`).catch(() => {});
    await page.close().catch(() => {});
    return [];
  }
}

function toComposerModules(cards) {
  // Composer module shape: {cover, link, type, title, blurb}
  const byPen = {};
  for (const c of cards) {
    const pen = c.pen || "unassigned";
    byPen[pen] = byPen[pen] || [];
    byPen[pen].push({
      cover: c.cover || "",
      link: c.promoLink || (c.allLinks && c.allLinks[0]) || "",
      type: c.platform === "bookfunnel" && /group|promo|bundle/i.test(c.text) ? "banner" : "tile",
      title: c.text.slice(0, 80),
      blurb: "",
    });
  }
  return byPen;
}

function htmlReport(cards) {
  const rows = cards.map(c => `
    <tr>
      <td>${c.platform}</td><td>${c.pen || "<b style='color:#a00'>unassigned</b>"}</td>
      <td>${c.date || ""}</td>
      <td>${c.cover ? `<img src="${c.cover}" style="height:70px">` : ""}</td>
      <td style="max-width:420px">${c.text.slice(0, 220)}</td>
      <td>${c.promoLink ? `<a href="${c.promoLink}">link</a>` : "—"}</td>
      <td>${c.paid ? "<b style='color:#a00'>PAID?</b>" : "free"}</td>
    </tr>`).join("");
  return `<!DOCTYPE html><meta charset="utf-8"><title>CPH swap pull ${stamp()}</title>
  <body style="font-family:Segoe UI,Arial,sans-serif;padding:20px">
  <h2>Swap pull — ${stamp()}</h2>
  <p>${cards.length} entries. Anything "unassigned" needs a human eye. Import <code>composer-import.json</code> into the Newsletter Composer.</p>
  <table border="1" cellpadding="6" style="border-collapse:collapse;font-size:13px">
  <tr><th>Platform</th><th>Pen name</th><th>Date</th><th>Cover</th><th>Text</th><th>Promo</th><th>Cost</th></tr>${rows}</table></body>`;
}

(async () => {
  const ctx = await launchBrowser({ headless: HEADLESS });
  let all = [];
  all = all.concat(await scrape(ctx, "bookclicker", config.platforms.bookclicker.swapsUrl));
  all = all.concat(await scrape(ctx, "bookswappy", config.platforms.bookswappy.swapsUrl));
  all = all.concat(await scrape(ctx, "bookfunnel", config.platforms.bookfunnel.swapsUrl));
  await ctx.close();

  for (const c of all) {
    c.pen = attribute(c, config.penNames);
    c.paid = looksPaid(c.text);
  }
  const free = all.filter(c => !c.paid);

  fs.writeFileSync(path.join(OUT_DIR, `swaps-${stamp()}.json`), JSON.stringify(all, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, "composer-import.json"), JSON.stringify(toComposerModules(free), null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `report-${stamp()}.html`), htmlReport(all));

  log("");
  log(`DONE. ${all.length} entries (${free.length} free) → output/`);
  log(`  • report-${stamp()}.html — open this to review`);
  log(`  • composer-import.json — import into the CPH Newsletter Composer`);
  const un = all.filter(c => !c.pen).length;
  if (un) log(`  • ${un} entries need pen-name assignment — see the report`);
})();
