# Payhip Upload Checklist

Everything you need to add these 9 products to your Payhip store. Budget ~5 min
per product. All copy lives in **LISTINGS.md**; all files live in **products/**.

> **Why this is manual:** Payhip has no API for *creating* products — uploads
> happen in the dashboard. This pack does all the prep so each upload is just
> attach-file → paste-copy → set-price → publish.

---

## Before you start
- [ ] Log in at **payhip.com** → your store dashboard
- [ ] Download the contents of `payhip-upload/products/` to your computer
      (from the PR/branch, or the green **Code → Download ZIP** button on GitHub)
- [ ] Have **LISTINGS.md** open in another tab for copy/paste
- [ ] (Optional) Have a cover image ready for each product — Payhip shows a
      placeholder if you skip it, but a simple branded thumbnail converts better

## For EACH product (repeat 9×)
1. [ ] Dashboard → **Products** → **Add new product** → choose **Digital product**
2. [ ] **Product name** → copy from LISTINGS.md heading
3. [ ] **Upload file** → attach the matching file from `products/`:
       - bundles = the `.zip`
       - standalone tools = the `.html` file
4. [ ] **Price** → enter the suggested price (or your own)
5. [ ] **Description** → paste the **Full description** block (Payhip's editor
       accepts the formatting; the `>` quote marks are just for this doc — you
       can drop them)
6. [ ] **Product image** → upload a cover if you have one
7. [ ] (Optional) **Short/tagline** → use the "Short description" line
8. [ ] **Save / Publish**
9. [ ] Copy the live product URL into the tracker below

---

## Product tracker

| # | Product | File to upload | Price | Uploaded? | Live URL |
|---|---------|----------------|-------|-----------|----------|
| 1 | Book Marketing: Beyond BookBub | `book-marketing-beyond-bookbub.zip` | $24 | ☐ | |
| 2 | Amazon Ads for Authors | `amazon-ads-for-authors.zip` | $24 | ☐ | |
| 3 | Edit Like a Boss | `edit-like-a-boss.zip` | $39 | ☐ | |
| 4 | Make AI Sound Like You | `make-ai-sound-like-you.zip` | $19 | ☐ | |
| 5 | Story Studio | `Story-Studio.html` | $12 | ☐ | |
| 6 | Series Read-Through Calculator | `Series-Read-Through-Calculator.html` | $9 | ☐ | |
| 7 | Your Style Sheet | `Your-Style-Sheet.html` | $9 | ☐ | |
| 8 | AI Banned Words Tool | `AI-Banned-Words-Tool.html` | $7 | ☐ | |
| 9 | Copyright Page Template | `Copyright-Page-Template.html` | $5 | ☐ | |

---

## After uploading
- [ ] (Optional) Create a **"TIP Worksheet Vault"** bundle in Payhip combining all 9
- [ ] Add the live Payhip links back into your TIP Library page (`index.html`) so
      buyers can find them
- [ ] Test-buy one product yourself (Payhip has a test mode) to confirm the
      download works and `Start-Here.html` opens cleanly

## Not included here (intentionally)
These TIP Library classes link to your **other** repo (`cph-jessica/tip-tools`),
so their files aren't in this project and couldn't be packaged:
- **Foundations of Claude** (most lessons are hosted on tip-tools)
- **Pen Name Launcher** (self-paced class, hosted on tip-tools)
- A few external **Companion Tools** (Character Tracker, Pen Name Skill Builder,
  Author Day Planner)

If you want these as Payhip products too, point me at the `tip-tools` repo (or
add it to this session) and I'll build the same package for them.

---

## Regenerating the files
If you edit any worksheet, rebuild all product files with:

```
python3 payhip-upload/build-products.py
```

This re-zips the bundles (with a fresh `Start-Here.html`) and re-copies the
standalone tools into `payhip-upload/products/`.
