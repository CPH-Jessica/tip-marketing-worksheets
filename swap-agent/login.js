// One-time setup: opens a real Chrome window on all three swap platforms so
// you can log in manually. Sessions persist in .browser-profile/ — after this,
// pull-swaps.js and book-swaps.js reuse the logins. Re-run whenever a site
// logs you out.
//
//   node login.js
const { launchBrowser, log } = require("./lib");
const config = require("./config");

(async () => {
  const ctx = await launchBrowser({ headless: false });
  const pages = [];
  for (const [name, p] of Object.entries(config.platforms)) {
    const page = await ctx.newPage();
    await page.goto(p.base, { waitUntil: "domcontentloaded" }).catch(() => {});
    pages.push(name);
    log(`Opened ${name} — log in with Jessica's account in that tab.`);
  }
  log("");
  log("Log in to all three tabs (BookClicker, BookSwappy, BookFunnel).");
  log("When you're done, just close the browser window. Sessions are saved.");
  // Keep the process alive until the user closes the window.
  ctx.on("close", () => process.exit(0));
})();
