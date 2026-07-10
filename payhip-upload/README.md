# Payhip Upload Pack

Everything needed to list the TIP worksheets as products on **Payhip**. Payhip
has no API for creating products, so this pack does all the prep — the only
manual step left is attaching files and pasting copy in the Payhip dashboard.

## What's here
- **`UPLOAD-CHECKLIST.md`** — start here. Step-by-step upload flow + a tracker.
- **`LISTINGS.md`** — paste-ready titles, descriptions, and suggested pricing.
- **`products/`** — the actual files to upload:
  - 4 class bundles (`.zip`, each with a branded `Start-Here.html` index)
  - 5 standalone tools (`.html`, delivered as-is)
- **`build-products.py`** — regenerates everything from the source worksheets.

## 9 products
| Type | Product | File |
|---|---|---|
| Bundle | Book Marketing: Beyond BookBub | `products/book-marketing-beyond-bookbub.zip` |
| Bundle | Amazon Ads for Authors | `products/amazon-ads-for-authors.zip` |
| Bundle | Edit Like a Boss | `products/edit-like-a-boss.zip` |
| Bundle | Make AI Sound Like You | `products/make-ai-sound-like-you.zip` |
| Tool | Story Studio | `products/Story-Studio.html` |
| Tool | Series Read-Through Calculator | `products/Series-Read-Through-Calculator.html` |
| Tool | Your Style Sheet | `products/Your-Style-Sheet.html` |
| Tool | AI Banned Words Tool | `products/AI-Banned-Words-Tool.html` |
| Tool | Copyright Page Template | `products/Copyright-Page-Template.html` |

## Rebuild
```
python3 payhip-upload/build-products.py
```
