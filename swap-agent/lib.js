// Shared helpers for the CPH swap agent.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PROFILE_DIR = path.join(__dirname, ".browser-profile");
const OUT_DIR = path.join(__dirname, "output");
const SNAP_DIR = path.join(__dirname, "snapshots");

function ensureDirs() {
  for (const d of [OUT_DIR, SNAP_DIR]) fs.mkdirSync(d, { recursive: true });
}

// One persistent, headed browser profile: log in once, sessions stick around.
async function launchBrowser({ headless = false } = {}) {
  ensureDirs();
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1380, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

async function snapshot(page, name) {
  const base = path.join(SNAP_DIR, `${stamp()}-${name}`);
  try {
    fs.writeFileSync(`${base}.html`, await page.content());
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    log(`  snapshot saved: snapshots/${path.basename(base)}.html/.png`);
  } catch (e) {
    log(`  snapshot failed for ${name}: ${e.message}`);
  }
}

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(OUT_DIR, "agent.log"), line + "\n");
}

async function isLoggedOut(page) {
  const url = page.url().toLowerCase();
  if (/login|sign[-_]?in|session/.test(url)) return true;
  const pw = await page.locator('input[type="password"]').count();
  return pw > 0;
}

// Heuristic swap-card extraction. Dashboards change; instead of brittle CSS
// selectors, walk the DOM for elements that look like a swap entry: contain a
// book cover image and/or a bookfunnel/amazon link, near a date. Always pair
// with a snapshot so selectors can be tightened when a site changes.
async function extractSwapCards(page) {
  return page.evaluate(() => {
    const linkRe = /(bookfunnel\.com|amzn\.to|amazon\.com|books2read|geni\.us)/i;
    const dateRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/i;
    const seen = new Set();
    const cards = [];
    const candidates = document.querySelectorAll("tr, li, [class*=card], [class*=swap], [class*=booking], [class*=row]");
    for (const el of candidates) {
      const text = (el.innerText || "").trim();
      if (!text || text.length > 1200) continue; // skip empties and page-level containers
      const links = [...el.querySelectorAll("a[href]")].map(a => a.href);
      const promo = links.find(h => linkRe.test(h));
      const img = el.querySelector("img[src*=cover], img[src*=bookfunnel], img[src*=media-amazon], img[src*=images]");
      if (!promo && !img) continue;
      const key = text.slice(0, 140);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({
        text: text.replace(/\s+/g, " ").slice(0, 600),
        date: (text.match(dateRe) || [null])[0],
        promoLink: promo || null,
        cover: img ? img.src : null,
        allLinks: links.slice(0, 12),
      });
    }
    return cards;
  });
}

// Attribute a scraped card to a pen name by matching list names, then genre keywords.
function attribute(card, penNames) {
  const t = card.text.toLowerCase();
  for (const [key, p] of Object.entries(penNames)) {
    for (const name of [p.label, p.bookclickerList, p.bookswappyList].filter(Boolean)) {
      if (t.includes(name.toLowerCase())) return key;
    }
  }
  let best = null, bestScore = 0;
  for (const [key, p] of Object.entries(penNames)) {
    const score = (p.genresInclude || []).filter(g => t.includes(g)).length
                - (p.genresExclude || []).filter(g => t.includes(g)).length * 2;
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best; // may be null → shows up as "unassigned" for human review
}

function looksPaid(text) {
  return /\$\s?\d|paid|price/i.test(text);
}

module.exports = { launchBrowser, extractSwapCards, attribute, looksPaid, isLoggedOut, snapshot, log, stamp, OUT_DIR };
