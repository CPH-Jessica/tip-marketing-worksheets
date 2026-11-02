#!/usr/bin/env python3
"""
Build Payhip-ready product files from the TIP worksheet repo.

- Class bundles  -> a .zip containing the worksheet HTML files + a branded
                    "Start-Here.html" index that links to them locally.
- Standalone tools -> the single self-contained HTML file, copied with a clean
                    customer-facing filename (Payhip accepts any file type, and a
                    lone self-contained HTML is friendlier delivered un-zipped).

Re-run this any time the source worksheets change:  python3 build-products.py
Outputs land in  payhip-upload/products/
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "payhip-upload", "products")

# TIP brand palette (matches the worksheets)
CORAL, NAVY, CREAM, GOLD = "#E8735A", "#1B2A4A", "#FFF8F0", "#D4A853"

# ---- Class bundles: (product slug, display name, blurb, [(relpath, title), ...]) ----
BUNDLES = [
    (
        "book-marketing-beyond-bookbub",
        "Book Marketing: Beyond BookBub",
        "Every way to market your book — 5 interactive worksheets.",
        [
            ("book-marketing/01-marketing-channel-audit.html", "Marketing Channel Audit"),
            ("book-marketing/02-promo-site-planner.html", "Promo Site Planner"),
            ("book-marketing/03-swap-strategy-builder.html", "Swap Strategy Builder"),
            ("book-marketing/04-review-launch-planner.html", "Review Launch Planner"),
            ("book-marketing/05-content-marketing-calendar.html", "Content Marketing Calendar"),
        ],
    ),
    (
        "amazon-ads-for-authors",
        "Amazon Ads for Authors (AMS Demystified)",
        "Set up and scale Amazon ads — 4 interactive worksheets.",
        [
            ("amazon-ads/01-ads-readiness-checklist.html", "Ads Readiness Checklist"),
            ("amazon-ads/02-keyword-research-workbook.html", "Keyword Research Workbook"),
            ("amazon-ads/03-campaign-builder.html", "Campaign Builder Worksheet"),
            ("amazon-ads/04-ad-performance-tracker.html", "Ad Performance Tracker"),
        ],
    ),
    (
        "edit-like-a-boss",
        "Edit Like a Boss: The 9-Pass AI Editing System",
        "The complete self-paced editing course — 19 interactive worksheets across 3 parts.",
        [
            ("edit-like-a-boss/part-1-editing-system/lesson-01-intro.html", "Part 1 · Editing Readiness Checklist"),
            ("edit-like-a-boss/part-1-editing-system/lesson-02-quality-check.html", "Part 1 · Quality Check Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-03-plot-holes.html", "Part 1 · Pass 2 — Plot Hole Checker"),
            ("edit-like-a-boss/part-1-editing-system/lesson-04-timeline.html", "Part 1 · Pass 3 — Timeline Consistency"),
            ("edit-like-a-boss/part-1-editing-system/lesson-05-line-edit.html", "Part 1 · Line Edit Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-06-dialogue.html", "Part 1 · Dialogue Polish Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-07-heat-scene.html", "Part 1 · Heat Scene Edit Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-08-dev-edit.html", "Part 1 · Developmental Edit Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-09-voice-audit.html", "Part 1 · Voice Audit Worksheet"),
            ("edit-like-a-boss/part-1-editing-system/lesson-10-conclusion.html", "Part 1 · Full Manuscript Audit Tracker"),
            ("edit-like-a-boss/part-1-editing-system/lesson-11-human-pass.html", "Part 1 · Pass 9 — The Human Pass"),
            ("edit-like-a-boss/part-2-building-your-team/lesson-01-beta-bestie.html", "Part 2 · Beta Bestie Builder"),
            ("edit-like-a-boss/part-2-building-your-team/lesson-02-creating-skills.html", "Part 2 · Creating Your Own Skills"),
            ("edit-like-a-boss/part-2-building-your-team/lesson-03-style-guide.html", "Part 2 · Pen Name Style Guide Builder"),
            ("edit-like-a-boss/part-2-building-your-team/lesson-04-writing-system.html", "Part 2 · Writing System Audit"),
            ("edit-like-a-boss/part-3-expanding-your-reach/lesson-01-what-each-ai-does-best.html", "Part 3 · What Each AI Does Best"),
            ("edit-like-a-boss/part-3-expanding-your-reach/lesson-02-setting-up-chatgpt-gpts.html", "Part 3 · Setting Up ChatGPT Custom GPTs"),
            ("edit-like-a-boss/part-3-expanding-your-reach/lesson-03-setting-up-gemini-grok.html", "Part 3 · Setting Up Gemini Gems + Grok Agents"),
            ("edit-like-a-boss/part-3-expanding-your-reach/lesson-04-multi-tool-workflow.html", "Part 3 · The Multi-Tool Editing Workflow"),
        ],
    ),
    (
        "make-ai-sound-like-you",
        "Make AI Sound Like You",
        "The class + the interactive Voice Kit Builder, so any AI writes in your voice.",
        [
            ("make-ai-sound-like-you/class.html", "The Class — Make AI Sound Like You"),
            ("make-ai-sound-like-you/voice-kit-builder.html", "Voice Kit Builder (interactive)"),
            ("make-ai-sound-like-you/you-always-had-the-ideas.html", "Bonus Essay — You Always Had the Ideas"),
        ],
    ),
]

# ---- Standalone tools: (product slug, clean filename, source relpath) ----
STANDALONE = [
    ("story-studio", "Story-Studio.html", "tools/story-studio.html"),
    ("series-read-through-calculator", "Series-Read-Through-Calculator.html", "tools/series-read-through-calculator.html"),
    ("your-style-sheet", "Your-Style-Sheet.html", "tools/your-style-sheet.html"),
    ("ai-banned-words", "AI-Banned-Words-Tool.html", "tools/ai-banned-words.html"),
    ("copyright-page-template", "Copyright-Page-Template.html", "tools/copyright-page-template.html"),
]


def start_here_html(name, blurb, items):
    rows = "\n".join(
        f'      <li><a href="{os.path.basename(rel)}"><span class="num">{i:02d}</span>'
        f'<span class="t">{title}</span></a></li>'
        for i, (rel, title) in enumerate(items, 1)
    )
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name} — Start Here</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:Georgia,serif;background:{CREAM};color:#2D2D2D;line-height:1.6}}
.header{{background:{NAVY};color:#fff;padding:2.5rem 2rem;text-align:center}}
.header h1{{font-size:1.8rem;margin-bottom:.4rem}}
.header .sub{{color:{CORAL};font-style:italic}}
.header .brand{{color:{GOLD};font-size:.8rem;margin-top:.6rem;letter-spacing:1px;text-transform:uppercase}}
.wrap{{max-width:760px;margin:0 auto;padding:2.5rem 2rem 4rem}}
.note{{background:#fff;border-left:4px solid {CORAL};padding:1.25rem 1.5rem;border-radius:0 8px 8px 0;margin-bottom:2rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}}
ul{{list-style:none;background:#fff;border-radius:8px;padding:.5rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,.06)}}
li{{border-bottom:1px solid #F0EDE8}} li:last-child{{border-bottom:none}}
a{{display:flex;gap:.9rem;align-items:baseline;padding:.8rem .25rem;text-decoration:none;color:#2D2D2D;transition:.15s}}
a:hover{{background:{CREAM};padding-left:.6rem;color:{NAVY}}}
.num{{color:{CORAL};font-weight:bold;min-width:1.8rem}}
.t{{flex:1}} a:hover .t{{text-decoration:underline}}
.foot{{text-align:center;color:#888;font-size:.85rem;padding:2rem}}
</style></head><body>
<div class="header"><h1>{name}</h1><div class="sub">{blurb}</div><div class="brand">The Invisible Pen</div></div>
<div class="wrap">
  <div class="note"><strong>Welcome — and thank you!</strong> Each worksheet below is a self-contained file. Click any title to open it in your browser, fill it in, and print or save your results. Nothing is uploaded anywhere — everything runs privately on your own device. Keep this folder together so the links work.</div>
  <ul>
{rows}
  </ul>
</div>
<div class="foot">The Invisible Pen · Clark Publishing House LLC<br>For your personal use. Not for redistribution.</div>
</body></html>
"""


def build_bundles():
    made = []
    for slug, name, blurb, items in BUNDLES:
        staging = os.path.join(OUT, f"_stage_{slug}")
        if os.path.exists(staging):
            shutil.rmtree(staging)
        os.makedirs(staging)
        for rel, _ in items:
            src = os.path.join(ROOT, rel)
            shutil.copy2(src, os.path.join(staging, os.path.basename(rel)))
        with open(os.path.join(staging, "Start-Here.html"), "w", encoding="utf-8") as f:
            f.write(start_here_html(name, blurb, items))
        zip_path = os.path.join(OUT, f"{slug}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            # Start-Here first so it sorts to the top
            z.write(os.path.join(staging, "Start-Here.html"), "Start-Here.html")
            for rel, _ in items:
                base = os.path.basename(rel)
                z.write(os.path.join(staging, base), base)
        shutil.rmtree(staging)
        made.append((f"{slug}.zip", len(items) + 1))
    return made


def build_standalone():
    made = []
    for slug, clean, rel in STANDALONE:
        shutil.copy2(os.path.join(ROOT, rel), os.path.join(OUT, clean))
        made.append((clean,))
    return made


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    b = build_bundles()
    s = build_standalone()
    print("Bundles (.zip):")
    for fn, n in b:
        print(f"  {fn}  ({n} files inc. Start-Here)")
    print("Standalone tools (.html):")
    for (fn,) in s:
        print(f"  {fn}")
