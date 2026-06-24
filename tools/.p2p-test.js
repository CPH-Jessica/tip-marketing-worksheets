/* Headless smoke test for prompt-2-publication.html
   Run: node tools/.p2p-test.js   (requires jsdom; falls back to logic-only checks) */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'prompt-2-publication.html');
const html = fs.readFileSync(file, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }

console.log('\n== Static checks ==');
const scriptBody = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/init\(\);\s*$/,'');
let parseOk = true;
try { new Function(scriptBody); } catch(e){ parseOk = false; console.log('   parse error: ' + e.message); }
ok('script parses', parseOk);
ok('18 phases defined', (html.match(/n:\d+, key:/g)||[]).length === 18);
ok('series is phase 1', /n:1, key:'series'/.test(html));
ok('ghostwriter has a prompt toolkit', /key:'ghostwriter'[\s\S]*?prompts:\[/.test(html));
ok('no "standalone" framing left', !/standalone/i.test(html.replace(/placeholder="[^"]*"/g,'')));

let jsdom;
try { jsdom = require('jsdom'); } catch(e){ jsdom = null; }
if(!jsdom){
  console.log('\n(jsdom not installed — skipping DOM run. `npm i jsdom` to enable the full smoke test.)');
  console.log('\nResult: ' + pass + ' passed, ' + fail + ' failed (static only)');
  process.exit(fail ? 1 : 0);
}

console.log('\n== DOM run (jsdom) ==');
const { JSDOM } = jsdom;
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' });
const win = dom.window, doc = win.document;

// jsdom lacks clipboard/Blob URL bits used only on click; stub what init touches.
ok('app initialized (book selector populated)', doc.getElementById('bookSel').options.length >= 1);
ok('rail rendered all 18 phase buttons', doc.querySelectorAll('.phase-btn').length === 18);
ok('rail shows phase groups', doc.querySelectorAll('.railgroup').length >= 4);
ok('panel shows phase 1 (Series Builder)', /Series Builder/.test(doc.getElementById('panel').textContent));

// Navigate to Ghostwriter (phase 11) and check the prompt picker.
const ghostBtn = [...doc.querySelectorAll('.phase-btn')].find(b => /Ghostwriter/.test(b.textContent));
ok('found Ghostwriter phase button', !!ghostBtn);
ghostBtn && ghostBtn.click();
const pickers = doc.querySelectorAll('.pp-btn');
ok('ghostwriter shows a multi-prompt picker', pickers.length >= 6);
ok('ghostwriter prompt box renders book context', /Title:/.test(doc.getElementById('promptText').textContent));
// click a different prompt and confirm the box changes
const before = doc.getElementById('promptText').textContent;
pickers[3] && pickers[3].click();
ok('switching prompt changes the prompt box', doc.getElementById('promptText').textContent !== before);

// Exercise the EPUB builder end-to-end by driving the real UI.
const w = win;
const fire = (el, type='input') => el.dispatchEvent(new w.Event(type, { bubbles:true }));
// set the title via the meta box input
const titleInput = doc.querySelector('[data-meta="title"]');
titleInput.value = 'Test Book'; fire(titleInput);
// capture the blob the download would receive
let epubBlob = null;
w.URL.createObjectURL = (b)=>{ epubBlob = b; return 'blob:fake'; };
w.URL.revokeObjectURL = ()=>{};
// stub the anchor click so jsdom doesn't try to navigate
const origCreate = doc.createElement.bind(doc);
doc.createElement = (tag)=>{ const el = origCreate(tag); if(tag==='a') el.click = ()=>{}; return el; };
// go to Compile phase, set author, add a chapter with text, generate
const compileBtn = [...doc.querySelectorAll('.phase-btn')].find(b => /Compile/.test(b.textContent));
ok('found Compile phase button', !!compileBtn);
compileBtn && compileBtn.click();
const author = doc.getElementById('cAuthor'); author.value = 'Jane Test'; fire(author);
doc.getElementById('btnAddChap').click();
const chapTa = doc.querySelector('#chapWrap textarea');
chapTa.value = 'Hello world.\n\nSecond para.'; fire(chapTa);
try { doc.getElementById('btnEpub').click(); } catch(e){ console.log('   buildEpub threw: '+e.message); }
ok('buildEpub produced a Blob', epubBlob && typeof epubBlob.size === 'number' && epubBlob.size > 0);
ok('blob mime is epub', epubBlob && epubBlob.type === 'application/epub+zip');

// Validate the zip bytes look like a real epub (PK header + stored mimetype first).
(async () => {
  if(epubBlob && epubBlob.arrayBuffer){
    const buf = Buffer.from(await epubBlob.arrayBuffer());
    ok('zip starts with PK\\x03\\x04', buf[0]===0x50 && buf[1]===0x4b && buf[2]===0x03 && buf[3]===0x04);
    ok('first entry is "mimetype"', buf.slice(30,38).toString('latin1') === 'mimetype');
    ok('mimetype content correct', buf.slice(38,38+20).toString('latin1') === 'application/epub+zip');
    fs.writeFileSync(path.join(__dirname,'.p2p-test.epub'), buf);
    console.log('   (wrote tools/.p2p-test.epub for manual unzip -t)');
  }
  console.log('\nResult: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
