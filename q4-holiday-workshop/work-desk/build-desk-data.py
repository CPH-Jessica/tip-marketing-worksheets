#!/usr/bin/env python3
# Run from q4-holiday-workshop/:  python3 work-desk/build-desk-data.py .
"""Build work-desk/desk-data.js from the committed prompt pack + student workbook.

Prompt text is taken verbatim from holiday-novella-prompts.html. Worksheet slots
([paste], [___], etc.) are rewritten as {{key|fallback}} tokens so the desk can
fill them from the student's own workbook answers. Fallback = the original
bracket text, so an empty field still reads exactly like the prompt pack.
"""
import html, json, re, sys
from pathlib import Path

ROOT = Path(sys.argv[1])  # q4-holiday-workshop/
pack = (ROOT / 'holiday-novella-prompts.html').read_text()
wb = (ROOT / 'student-workbook.html').read_text()

def clean(s):
    s = re.sub(r'<br\s*/?>', ' ', s)
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()

# ---------- workbook fields ----------
controls = []  # every data-answer control, in DOM order (needed to write a valid workbook save)
for m in re.finditer(r'<(textarea|input)\b([^>]*)\bdata-answer\b([^>]*)>', wb):
    attrs = m.group(2) + m.group(3)
    cid = re.search(r'id="([^"]+)"', attrs).group(1)
    is_cb = 'type="checkbox"' in attrs
    ml = re.search(r'maxlength="(\d+)"', attrs)
    controls.append({'id': cid, 'cb': is_cb, 'max': int(ml.group(1)) if ml else 0})
assert len(controls) == 128, len(controls)

labels = {}
for m in re.finditer(r'<label for="([^"]+)">(.*?)</label>', wb, re.S):
    labels[m.group(1)] = clean(m.group(2))
# checkbox labels sit after the input
for m in re.finditer(r'<input type="checkbox" id="([^"]+)"[^>]*>\s*(?:<span[^>]*>)?(.*?)</(?:label|span)>', wb, re.S):
    labels.setdefault(m.group(1), clean(m.group(2)))

worksheets = {}
for sec in re.finditer(r'<section class="worksheet" id="page-(\d+)".*?</section>', wb, re.S):
    n = int(sec.group(1)); body = sec.group(0)
    title = clean(re.search(r'<h2[^>]*>(.*?)</h2>', body, re.S).group(1))
    ids = [c['id'] for c in controls if re.match(r'p%d-' % n, c['id'])]
    worksheets[n] = {'n': n, 'title': title, 'ids': ids}

# fill any missing labels for table cells (log, runway, marketing)
LOG_COLS = {'c1': 'Date / minutes', 'c2': 'My small target', 'c3': 'What changed', 'c4': 'Next starting point'}
RUNWAY_ROWS = ['Finish draft', 'Structural revision', 'Editing', 'Proofreading', 'Cover / book details', 'Formatting / file checks', 'Platform review / buffer']
MKT_ROWS = ['Before release', 'Release week', 'After release']
for c in controls:
    cid = c['id']
    m = re.match(r'p14-t1-r(\d)-(c\d)', cid)
    if m: labels[cid] = 'Block %s · %s' % (m.group(1), LOG_COLS[m.group(2)])
    m = re.match(r'p16-t1-r(\d)-c(\d)', cid)
    if m: labels[cid] = '%s · %s' % (RUNWAY_ROWS[int(m.group(1)) - 1], 'Task / what "done" means' if m.group(2) == '2' else 'Target date')
    m = re.match(r'p17-t1-r(\d)-c(\d)', cid)
    if m: labels[cid] = '%s · %s' % (MKT_ROWS[int(m.group(1)) - 1], 'One useful action' if m.group(2) == '2' else 'Ready when...')
for c in controls:
    c['label'] = labels.get(c['id'], c['id'])
    assert c['label'] != c['id'], 'no label for ' + c['id']

# worksheet intro/help text (first paragraph + hints) for display
for n, w in worksheets.items():
    body = re.search(r'<section class="worksheet" id="page-%d".*?</section>' % n, wb, re.S).group(0)
    paras = [clean(p) for p in re.findall(r'<p(?: class="[^"]*")?>(.*?)</p>', body, re.S)]
    paras = [p for p in paras if p and 'Back to workbook controls' not in p and not p.startswith('CLASS ')]
    w['notes'] = paras[:4]
    cd = re.search(r'<p class="class-date">(.*?)</p>', body, re.S)
    w['classDate'] = clean(cd.group(1)) if cd else ''
    blocks = [clean(b) for b in re.findall(r'<p class="writing-block">(.*?)</p>', body, re.S)]
    w['blocks'] = blocks

# ---------- prompt pack ----------
pages = re.findall(r'<div class="page" id="([^"]+)">(.*?)(?=<div class="page" id=|</main>)', pack, re.S)
sections = []
for pid, body in pages:
    for sec in re.finditer(r'<section class="worksheet[^"]*"[^>]*aria-labelledby="heading-([^"]+)">(.*?)</section>', body, re.S):
        sid, sb = sec.groups()
        eyebrow = re.search(r'<div class="eyebrow">(.*?)</div>', sb, re.S)
        title = clean(re.search(r'<h2[^>]*>(.*?)</h2>', sb, re.S).group(1))
        meta = re.search(r'<p class="meta">(.*?)</p>', sb, re.S)
        sb_np = re.sub(r'<div class="prompt-block">.*?</pre></div>', '', sb, flags=re.S)
        paras = [clean(p) for p in re.findall(r'<p>(.*?)</p>', sb_np, re.S)]
        prompts = []
        for m in re.finditer(r'<span class="prompt-label">(.*?)</span>.*?<pre class="prompt" id="([^"]+)"[^>]*>(.*?)</pre>', sb, re.S):
            prompts.append({'id': m.group(2), 'label': clean(m.group(1)), 'text': html.unescape(m.group(3))})
        sections.append({'page': pid, 'id': sid, 'eyebrow': clean(eyebrow.group(1)) if eyebrow else '',
                         'title': title, 'meta': clean(meta.group(1)) if meta else '', 'paras': paras, 'prompts': prompts})

P = {p['id']: p for s in sections for p in s['prompts']}

def sub(pid, old, new, count=1):
    t = P[pid]['text']
    assert t.count(old) >= count, (pid, old, t.count(old))
    P[pid]['text'] = t.replace(old, new, count)

def tok(key, fallback):
    return '{{%s|%s}}' % (key, fallback)

def seq_paste(pid, keys, marker='[paste]'):
    # fill the Nth occurrence with the Nth key; a sentinel stops later passes matching earlier fallbacks
    SENT = '\x00SLOT\x00'
    for k in keys:
        sub(pid, marker, tok(k, SENT))
    P[pid]['text'] = P[pid]['text'].replace(SENT, marker)

# house rules
sub('house-rules-block', '[YOUR BANNED NAMES]', tok('d:banned', '[YOUR BANNED NAMES]'))
sub('house-rules-block', '[YOUR LIMITS]', tok('d:limits', '[YOUR LIMITS]'))
# 01
sub('p01-a', '[new idea / partial draft / complete draft to revise]', tok('d:start', '[new idea / partial draft / complete draft to revise]'))
# 02 (class context)
sub('p02-a', '[1/2/3/4/5]', tok('c:n', '[1/2/3/4/5]'))
sub('p02-a', '[paste the one-line goal from the class worksheet]', tok('c:goal', '[paste the one-line goal from the class worksheet]'))
sub('p02-a', '[paste the "Leave with" line]', tok('c:leave', '[paste the "Leave with" line]'))
# fast lane
sub('the-fast-lane-a', '[paste what you have; blank lines are allowed]', tok('x:ws34', '[paste what you have; blank lines are allowed]'))
sub('the-fast-lane-a', '[new idea / partial draft / revising a complete draft]', tok('d:start', '[new idea / partial draft / revising a complete draft]'))
seq_paste('the-fast-lane-b', ['p5-f1', 'p5-f2', 'p5-f3', 'p5-f4', 'p5-f5', 'p5-f6', 'p6-f1'])
# 03-06
seq_paste('p03-a', ['p3-f1', 'p3-f2', 'p3-f3', 'p3-f4', 'p3-f5'])
seq_paste('p04-a', ['p4-f1', 'p4-f2', 'p4-f3', 'x:tropes', 'p4-f5', 'p4-f6'])
seq_paste('p05-a', ['p5-f1', 'p5-f2', 'p5-f3', 'p5-f4', 'p5-f5', 'p5-f6'])
seq_paste('p06-a', ['p6-f1'])
sub('p06-a', '[paste number and length]', tok('p6-f2', '[paste number and length]'))
# 07B: what exists now
# 08
old8 = '[Character] wants [___]; obstacle [___]; holiday pressure [___]; resulting choice [___].'
sub('p08-a', old8, tok('p8-f1', old8))
# 09
old9 = 'Because [___] happened, my character chooses [___], so [___] follows.'
sub('p09-a', old9, tok('p9-f1', old9))
old9b = '[paste the transition, gap, or scene; or describe the missing connection]'
sub('p09-a', old9b, tok('p9-f2', old9b))
# 10
sub('p10-a', '[paste your Worksheet 10 answer]', tok('p10-f1', '[paste your Worksheet 10 answer]'))
sub('p10-a', '[complete / these scenes still missing: ___]', tok('p10-f4', '[complete / these scenes still missing: ___]'))
# 15
sub('p15-a', '[still drafting / revising / editing / production]', tok('p15-f1', '[still drafting / revising / editing / production]'))
sub('p15-a', 'My available blocks: [___]', 'My available blocks: ' + tok('p15-f5', '[___]'))
# 12
sub('p12-a', '[paste from Worksheet 12]', tok('p12-f2', '[paste from Worksheet 12]'))
sub('p12-a', 'My one specific question or sticking point: [paste]', 'My one specific question or sticking point: ' + tok('p12-f3', '[paste]'))
sub('p12-a', 'Passage (short): [paste]', 'Passage (short): ' + tok('p12-f1', '[paste]'))
# 13A uses the stuck worksheet choice? (no matching fields) -- leave
# 14 (selected log row)
sub('p14-a', 'Date / minutes: [___]', 'Date / minutes: ' + tok('log:c1', '[___]'))
sub('p14-a', 'My small target was: [___]', 'My small target was: ' + tok('log:c2', '[___]'))
sub('p14-a', '[words written, passage revised, decision made, or cut]', tok('log:c3', '[words written, passage revised, decision made, or cut]'))
sub('p14-a', '[___ or "you tell me"]', tok('log:c4', '[___ or "you tell me"]'))
# 16
sub('p16-a', 'decide by: [___]', 'decide by: ' + tok('p16-f1', '[___]'))
sub('p16-a', 'formatter): [___]', 'formatter): ' + tok('p16-f2', '[___]'))
# 17
sub('p17-a', '[time and budget limit from Worksheet 17]', tok('p17-f4', '[time and budget limit from Worksheet 17]'))
# 18
sub('p18-a', 'Scene and target: [___]', 'Scene and target: ' + tok('p18-f1', '[___]'))
sub('p18-a', 'Want + obstacle + choice or turn: [___]', 'Want + obstacle + choice or turn: ' + tok('p18-f2', '[___]'))

# brackets that are instructions to Claude, not blanks for the student
CLAUDE_TAGS = ['[PLACEHOLDER]', '[CHECK]', '[PLOT HOLE]', '[SETUP LOGGED]', '[PAYOFF CHECK]', '[WATCH]',
               '[WOULD, CONFIRM]', '[WOULD — CONFIRM]', '[RESEARCH]', '[BRACKETED PLACEHOLDER]', '[Name]']
P17_TEMPLATE = ['[Shelf]', '[Wrapper]', '[core tropes]', '[lead]', '[shelf]', '[the Christmas deadline]',
                '[what drops them into it]', '[what the season makes happen]', '[what they must decide or fix]', '[wrapper]',
                '[a kiss worth waiting for / slow-burn heat / plenty of spice]', '[___]']
for p in P.values():
    p['claude'] = list(CLAUDE_TAGS) + (P17_TEMPLATE if p['id'] == 'p17-a' else [])

# ---------- pipeline stage per prompt (which of Jessica's skills it follows) ----------
STAGE = {
    'house-rules-block': ('Setup', 'All three skills'),
    'p01-a': ('Setup', 'Book Project'), 'p02-a': ('Check-in', 'Every class'),
    'the-holiday-trope-stack-a': ('Plan', 'Planner · Phase 1'), 'the-holiday-trope-stack-b': ('Plan', 'Planner · Phase 1'),
    'the-fast-lane-a': ('Plan', 'Planner · Phases 1–2'), 'the-fast-lane-b': ('Plan', 'Planner · Phases 3–5'),
    'the-fast-lane-c': ('Draft', 'Ghostwriter · co-write'),
    'p03-a': ('Plan', 'Planner · first contact'), 'p04-a': ('Plan', 'Planner · Phases 1–2'),
    'p05-a': ('Plan', 'Planner · Phase 3 Codex'), 'p06-a': ('Plan', 'Planner · Phases 4–5'),
    'p07-a': ('Draft', 'Ghostwriter · ghostwriter mode'), 'p07-b': ('Draft', 'Ghostwriter · co-write mode'),
    'p07-c': ('Edit', 'Editing · Pass 1 QC'), 'p07-d': ('Draft', 'Ghostwriter · batch mode'),
    'p08-a': ('Draft', 'Ghostwriter · engagement loop'), 'p09-a': ('Check', 'Ledger · Does-It-Fit · Passes 2–3'),
    'p10-a': ('Draft', 'Ghostwriter · ending + Pass 1'), 'p11-a': ('Edit', 'Editing · full sequence'),
    'p11-b': ('Edit', 'Editing · Pass 10 arc'), 'p11-c': ('Edit', 'Editing · manuscript audit'),
    'p15-a': ('Next', 'Tracker + Ledger'), 'p12-a': ('Feedback', 'Ghostwriter · feedback mode'),
    'p13-a': ('Unstick', 'Ghostwriter · co-write'), 'p13-b': ('Unstick', 'Ledger + Codex'),
    'p13-c': ('Unstick', 'Editing · line pass'), 'p13-d': ('Unstick', 'Chapter prompt + Ledger'),
    'p13-e': ('Unstick', 'Tracker'), 'p14-a': ('Log', 'Progress tracker'),
    'p16-a': ('Release', 'After the draft'), 'p17-a': ('Market', 'Trope stack → keywords'),
    'p18-a': ('Any block', 'Ghostwriter · any mode'),
}
for pid, p in P.items():
    st = STAGE.get(pid)
    assert st, 'no stage for ' + pid
    p['stage'], p['skill'] = st

# ---------- trope stack lists ----------
wrappers = [{'v': html.unescape(a), 's': html.unescape(b)} for a, b in re.findall(r'data-group="wrapper" data-value="([^"]+)" data-search="([^"]+)"', pack)]
tropes = [html.unescape(a) for a in re.findall(r'data-group="trope" data-value="([^"]+)"', pack)]
def opts(sel_id):
    m = re.search(r'<select id="%s">(.*?)</select>' % sel_id, pack, re.S)
    return [{'v': html.unescape(v), 't': clean(t)} for v, t in re.findall(r'<option value="([^"]*)">(.*?)</option>', m.group(1))]
costume = [clean(x) for x in re.findall(r'<input type="checkbox" data-costume="\d">\s*<span>(.*?)</span>', pack, re.S)]

# ---------- class pages ----------
PAGES = [
    {'id': 'start-here', 'tab': 'Start here', 'class': 0, 'ws': [1, 2], 'extra': ['the-house-rules']},
    {'id': 'class-1', 'tab': 'Class 1', 'class': 1, 'date': 'Thu Oct 8', 'ws': [3, 4, 5, 6, 7], 'extra': ['the-holiday-trope-stack', 'the-fast-lane']},
    {'id': 'class-2', 'tab': 'Class 2', 'class': 2, 'date': 'Thu Oct 15', 'ws': [8]},
    {'id': 'class-3', 'tab': 'Class 3', 'class': 3, 'date': 'Thu Oct 22', 'ws': [9]},
    {'id': 'class-4', 'tab': 'Class 4', 'class': 4, 'date': 'Thu Oct 29', 'ws': [10]},
    {'id': 'class-5', 'tab': 'Class 5', 'class': 5, 'date': 'Thu Nov 5', 'ws': [11, 15]},
    {'id': 'any-time', 'tab': 'Any time', 'class': 0, 'ws': [12, 13, 14, 16, 17, 18]},
]
secmap = {s['id']: s for s in sections}
for pg in PAGES:
    intro = secmap[pg['id']]
    pg['eyebrow'] = intro['eyebrow']; pg['title'] = intro['title']; pg['paras'] = intro['paras']
    if pg['class']:
        lw = next((x for x in intro['paras'] if x.startswith('Leave with:')), '')
        pg['leave'] = lw.replace('Leave with:', '').strip()
        goal = next((x for x in worksheets[6 + pg['class']]['notes']), '')
        pg['goal'] = goal

# assemble stations: one per worksheet (prompt section prompt-NN) + extras
def section_for_ws(n):
    return secmap.get('prompt-%02d' % n)
stations = []
for pg in PAGES:
    order = []
    if pg['id'] == 'class-1':
        order = [('extra', 'the-holiday-trope-stack'), ('extra', 'the-fast-lane')] + [('ws', n) for n in pg['ws']]
    elif pg['id'] == 'start-here':
        order = [('extra', 'the-house-rules'), ('ws', 1), ('ws', 2)]
    else:
        order = [('ws', n) for n in pg['ws']]
    for kind, key in order:
        if kind == 'ws':
            s = section_for_ws(key); w = worksheets[key]
            stations.append({'page': pg['id'], 'id': 'ws%02d' % key, 'ws': key, 'eyebrow': 'Worksheet %02d / 18' % key,
                             'title': w['title'], 'meta': s['meta'] if s else '', 'paras': s['paras'] if s else [],
                             'fields': w['ids'], 'notes': w['notes'], 'blocks': w['blocks'],
                             'prompts': [p['id'] for p in (s['prompts'] if s else [])]})
        else:
            s = secmap[key]
            stations.append({'page': pg['id'], 'id': key, 'ws': 0, 'eyebrow': s['eyebrow'], 'title': s['title'],
                             'meta': s['meta'], 'paras': s['paras'], 'fields': [], 'notes': [], 'blocks': [],
                             'prompts': [p['id'] for p in s['prompts']]})

# every prompt must be placed exactly once
for pid, p in P.items():
    for m in re.finditer(r'\{\{[^|}]+\|', p['text']):
        rest = p['text'][m.end():]
        assert rest.find('{{') == -1 or rest.find('}}') < rest.find('{{'), 'nested token in ' + pid

placed = [pid for st in stations for pid in st['prompts']]
assert sorted(placed) == sorted(P), set(P) ^ set(placed)

data = {
    'built': 'from holiday-novella-prompts.html + student-workbook.html',
    'pages': PAGES, 'stations': stations,
    'prompts': {pid: {k: p[k] for k in ('label', 'text', 'claude', 'stage', 'skill')} for pid, p in P.items()},
    'controls': controls,
    'wrappers': wrappers, 'tropes': tropes, 'genres': opts('s-genre'), 'heatbands': opts('s-heatband'),
    'heats': opts('d-heat'), 'povs': opts('d-pov'), 'costume': costume,
}
out = ROOT / 'work-desk' / 'desk-data.js'
out.parent.mkdir(exist_ok=True)
out.write_text('/* Generated from holiday-novella-prompts.html and student-workbook.html. Edit those, then rebuild. */\n'
               'window.DESK_DATA = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
print('ok', out, len(stations), 'stations', len(P), 'prompts', len(wrappers), 'wrappers', len(tropes), 'tropes', len(costume), 'costume')
for st in stations: print(' ', st['page'], st['id'], st['title'], st['prompts'], len(st['fields']))
