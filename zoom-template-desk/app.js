(() => {
  'use strict';
  const KEY = 'tip-zoom-template-desk-v1';
  const APP = 'tip-zoom-template-desk';
  const MAX_FILE = 10 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => 'desk-' + crypto.randomUUID();
  const seed = clone(window.ZOOM_DESK_SEED);
  let state = {app:APP, version:1, savedAt:new Date().toISOString(), activeId:seed.id, templates:[seed]};
  let lastRaw = null, locked = false, unsaved = false, pendingImport = null, presenting = false;
  const current = () => state.templates.find(t => t.id === state.activeId);
  const segment = t => t.segments.find(s => s.id === t.timer.segmentId);
  const remaining = t => t.timer.running ? Math.min(segment(t).minutes*60000, Math.max(0, t.timer.endAt - Date.now())) : t.timer.remainingMs;
  function text(node, value) { if (node.textContent !== value) node.textContent = value; }
  function message(value) { $('action-status').textContent = value; }
  function validUrl(value) { try { return !value || ['https:','http:'].includes(new URL(value).protocol); } catch (_) { return false; } }
  function validZone(value) { try { new Intl.DateTimeFormat('en-US',{timeZone:value}); return !!value; } catch (_) { return false; } }
  function object(value, keys) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== keys.slice().sort().join('|')) throw Error('Unexpected or missing backup fields.'); }
  function string(value, limit) { if (typeof value !== 'string' || value.length > limit) throw Error('A text field is invalid or too long.'); }
  function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw Error('A saved identifier is invalid.'); }
  function unique(items) { if (new Set(items.map(i=>i.id)).size !== items.length) throw Error('Duplicate identifiers in backup.'); }
  function validate(value) {
    object(value,['app','version','savedAt','activeId','templates']);
    if (value.app !== APP || value.version !== 1) throw Error('This is a different desk or an unsupported backup version.');
    string(value.savedAt,40); if (!Number.isFinite(Date.parse(value.savedAt))) throw Error('Invalid backup date.');
    if (!Array.isArray(value.templates) || value.templates.length < 1 || value.templates.length > 30) throw Error('A backup needs 1–30 classes.');
    unique(value.templates);
    for (const t of value.templates) {
      object(t,['id','name','date','startTime','timeZone','studentIntro','facilitatorNotes','meetingUrl','segments','resources','timer']);
      id(t.id); string(t.name,140); string(t.date,10); string(t.startTime,5); string(t.timeZone,80); string(t.studentIntro,6000); string(t.facilitatorNotes,16000); string(t.meetingUrl,2000);
      if (t.date && (!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) || new Date(t.date).toISOString().slice(0,10)!==t.date)) throw Error('Invalid class date.');
      if (t.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.startTime)) throw Error('Invalid class time.');
      if (!validZone(t.timeZone) || !validUrl(t.meetingUrl)) throw Error('Invalid time zone or meeting URL. Use http:// or https:// links.');
      if (!Array.isArray(t.segments) || t.segments.length<1 || t.segments.length>40) throw Error('Each class needs 1–40 agenda segments.');
      unique(t.segments);
      for (const s of t.segments) {
        object(s,['id','title','minutes','studentText','privateNotes']);id(s.id);string(s.title,200);string(s.studentText,6000);string(s.privateNotes,12000);
        if (!Number.isInteger(s.minutes) || s.minutes<1 || s.minutes>240) throw Error('Segment duration must be a whole number from 1 to 240 minutes.');
      }
      if (!Array.isArray(t.resources) || t.resources.length>30) throw Error('A class can have up to 30 resource links.');
      unique(t.resources);
      for (const r of t.resources) { object(r,['id','label','url','share']);id(r.id);string(r.label,200);string(r.url,2000);if(!validUrl(r.url)||typeof r.share!=='boolean')throw Error('Invalid resource link or sharing setting.'); }
      object(t.timer,['segmentId','remainingMs','running','endAt']);
      const selected=t.segments.find(s=>s.id===t.timer.segmentId);
      if (!selected || typeof t.timer.running!=='boolean' || !Number.isFinite(t.timer.remainingMs) || t.timer.remainingMs<0 || t.timer.remainingMs>selected.minutes*60000) throw Error('Invalid timer state.');
      if (t.timer.running ? !Number.isFinite(t.timer.endAt) || t.timer.endAt<=0 || t.timer.endAt>8640000000000000 : t.timer.endAt!==null) throw Error('Invalid timer deadline.');
    }
    if (!value.templates.some(t=>t.id===value.activeId)) throw Error('The selected class is missing.');
    return value;
  }
  function parse(raw) { if (typeof raw!=='string'||new Blob([raw]).size>MAX_FILE) throw Error('Backup is too large. The limit is 10 MB.'); return validate(JSON.parse(raw)); }
  function warn(value) { locked=true;unsaved=true;$('storage-warning').hidden=false;$('storage-message').textContent=value+' Saving is paused. Download the visible desk before choosing which copy to keep.';text($('save-status'),'Saving paused — your visible desk is still available for backup.'); }
  function persist(force=false) {
    unsaved=true;
    if(locked&&!force)return false;
    try {
      const stored=localStorage.getItem(KEY);
      if(!force&&stored!==lastRaw){warn('Stored data changed in another tab. This desk has not overwritten it.');return false;}
      state.savedAt=new Date().toISOString();
      const raw=JSON.stringify(state);
      if(new Blob([raw]).size>MAX_FILE)throw Error('size');
      localStorage.setItem(KEY,raw);lastRaw=raw;locked=false;unsaved=false;$('storage-warning').hidden=true;
      text($('save-status'),'Saved on this device · No cloud sync. Download backups to keep another copy.');return true;
    }catch(_){text($('save-status'),'NOT saved: browser storage is unavailable or full. Download a full backup before leaving.');return false;}
  }
  function pause(t) {t.timer.remainingMs=remaining(t);t.timer.running=false;t.timer.endAt=null;}
  function reset(t, segmentId=t.timer.segmentId) {const s=t.segments.find(s=>s.id===segmentId)||t.segments[0];t.timer={segmentId:s.id,remainingMs:s.minutes*60000,running:false,endAt:null};}
  function clock(ms) {const seconds=Math.ceil(ms/1000);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function total(t) {return t.segments.reduce((n,s)=>n+s.minutes,0);}
  function hour(minutes) {const h=Math.floor(minutes/60)%24,m=minutes%60;return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' a.m.':' p.m.');}
  function schedule(t) {
    const day=t.date?new Date(t.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):'Date to be chosen';
    let time='Start time to be chosen';
    if(t.startTime){const [h,m]=t.startTime.split(':').map(Number),start=h*60+m,end=start+total(t);time=hour(start)+'–'+hour(end)+(end>=1440?' (ends on a later day)':'');}
    return day+' · '+time+' · '+t.timeZone+' · '+total(t)+' minutes';
  }
  function node(tag, className='', content) {const n=document.createElement(tag);if(className)n.className=className;if(content!==undefined)n.textContent=content;return n;}
  function button(label, fn, className='secondary') {const b=node('button',className,label);b.type='button';b.addEventListener('click',fn);return b;}
  function field(container,labelText,identifier,value,kind,max,onEdit) {
    const wrap=node('div'),label=node('label','',labelText);label.htmlFor=identifier;
    const input=document.createElement(kind==='textarea'?'textarea':'input');input.id=identifier;
    if(kind!=='textarea')input.type=kind;else input.rows=3;
    if(max)input.maxLength=max;
    if(kind==='number'){input.min='1';input.max='240';input.step='1';}
    input.value=value;
    input.addEventListener(kind==='url'||kind==='number'?'change':'input',()=>onEdit(input));wrap.append(label,input);container.append(wrap);return input;
  }
  function validInput(input, okay, description) {input.setCustomValidity(okay?'':description);input.setAttribute('aria-invalid',String(!okay));if(!okay){input.reportValidity();message(description);}return okay;}
  function refreshOptions() {
    $('class-select').replaceChildren(...state.templates.map(t=>{const option=node('option','',t.name||'Untitled class');option.value=t.id;return option;}));$('class-select').value=state.activeId;
  }
  function updateTotal() {text($('agenda-total'),total(current())+' minutes');}
  function renderEditor() {
    const t=current();refreshOptions();
    document.querySelectorAll('[data-class]').forEach(input=>{input.value=t[input.dataset.class];input.setCustomValidity('');input.removeAttribute('aria-invalid');});
    $('delete-class').disabled=state.templates.length===1;
    $('new-class').disabled=$('duplicate').disabled=state.templates.length>=30;
    $('add-segment').disabled=t.segments.length>=40;$('add-resource').disabled=t.resources.length>=30;
    updateTotal();renderSegments();renderResources();renderMeeting();renderTimer();
  }
  function renderSegments() {
    const t=current();const list=$('agenda-editor');list.replaceChildren();
    t.segments.forEach((s,index)=>{
      const details=node('details','segment'+(s.id===t.timer.segmentId?' is-current':''));details.dataset.segmentId=s.id;
      const summary=node('summary');const title=node('span','',s.title||'Untitled segment'),minutes=node('span','segment-time',s.minutes+' min');summary.append(title,minutes);details.append(summary);
      const content=node('div','segment-content'),row=node('div','segment-fields');
      field(row,'Segment title','segment-'+s.id+'-title',s.title,'text',200,input=>{s.title=input.value;title.textContent=s.title||'Untitled segment';persist();renderTimer();});
      field(row,'Minutes','segment-'+s.id+'-minutes',s.minutes,'number',null,input=>{
        const value=Number(input.value);if(!validInput(input,Number.isInteger(value)&&value>=1&&value<=240,'Use 1–240 whole minutes.'))return;
        if(value===s.minutes)return;s.minutes=value;minutes.textContent=value+' min';
        if(t.timer.segmentId===s.id){reset(t);message('Duration changed. This segment’s clock is paused and reset to the new duration.');}
        persist();updateTotal();renderTimer();
      });content.append(row);
      field(content,'Student-facing prompt','segment-'+s.id+'-student',s.studentText,'textarea',6000,input=>{s.studentText=input.value;persist();});
      const privateBox=node('div','private-field');field(privateBox,'Private facilitator notes — never copied or presented','segment-'+s.id+'-private',s.privateNotes,'textarea',12000,input=>{s.privateNotes=input.value;persist();});content.append(privateBox);
      const actions=node('div','segment-actions');
      actions.append(button('Use this segment',()=>{
        if(t.timer.segmentId!==s.id&&t.timer.running&&!confirm('Pause the current clock and switch to this segment?'))return;
        if(t.timer.segmentId!==s.id)reset(t,s.id);persist();renderEditor();message('Selected segment: '+(s.title||'Untitled segment')+'. Press Start when ready.');
      }));
      const up=button('Move up',()=>moveSegment(index,-1));up.disabled=index===0;up.setAttribute('aria-label','Move segment '+(index+1)+' up');
      const down=button('Move down',()=>moveSegment(index,1));down.disabled=index===t.segments.length-1;down.setAttribute('aria-label','Move segment '+(index+1)+' down');
      const remove=button('Remove',()=>{if(!confirm('Remove this agenda segment and its notes?'))return;t.segments.splice(index,1);if(t.timer.segmentId===s.id)reset(t,t.segments[Math.min(index,t.segments.length-1)].id);persist();renderEditor();message('Segment removed.');},'text-button');remove.disabled=t.segments.length===1;remove.setAttribute('aria-label','Remove segment '+(index+1));
      actions.append(up,down,remove);content.append(actions);details.append(content);list.append(details);
    });
  }
  function moveSegment(index,direction) {const t=current();[t.segments[index],t.segments[index+direction]]=[t.segments[index+direction],t.segments[index]];persist();renderEditor();message('Agenda order updated. The selected segment’s clock is unchanged.');}
  function renderMeeting() {const url=current().meetingUrl;$('open-meeting').hidden=!url;if(url)$('open-meeting').href=url;else $('open-meeting').removeAttribute('href');}
  function renderResources() {
    const t=current(),list=$('resources-editor');list.replaceChildren();
    t.resources.forEach((r,index)=>{
      const wrap=node('div','resource');wrap.dataset.resourceId=r.id;
      field(wrap,'Resource label','resource-'+r.id+'-label',r.label,'text',200,input=>{r.label=input.value;persist();});
      field(wrap,'URL','resource-'+r.id+'-url',r.url,'url',2000,input=>{const value=input.value.trim();if(!validInput(input,validUrl(value),'Use a full http:// or https:// URL.'))return;r.url=value;input.value=value;persist();renderResourceLink(link,r);});
      const controls=node('div','resource-controls'),label=node('label','check'),check=document.createElement('input');check.type='checkbox';check.checked=r.share;check.id='resource-'+r.id+'-share';label.htmlFor=check.id;label.append(check,node('span','','Include in student view and copied agenda'));check.addEventListener('change',()=>{r.share=check.checked;persist();});
      const link=node('a','button-link secondary','Open ↗');link.target='_blank';link.rel='noopener noreferrer';renderResourceLink(link,r);
      const remove=button('Remove',()=>{if(!confirm('Remove this resource link?'))return;t.resources.splice(index,1);persist();renderEditor();},'text-button');remove.setAttribute('aria-label','Remove resource '+(index+1));controls.append(label,link,remove);wrap.append(controls);list.append(wrap);
    });
  }
  function renderResourceLink(link,r) {link.hidden=!r.url;if(r.url)link.href=r.url;else link.removeAttribute('href');}
  function renderTimer() {
    const t=current(),s=segment(t),index=t.segments.indexOf(s),left=remaining(t),next=t.segments[index+1];
    if(t.timer.running&&left===0){pause(t);persist();}
    text($('current-title'),s.title||'Untitled segment');text($('timer-display'),clock(left));
    const status=t.timer.running?'Running':left===0?'Time is up — choose the next segment when ready.':left===s.minutes*60000?'Ready':'Paused';
    text($('timer-state'),status);text($('timer-toggle'),t.timer.running?'Pause':left===0?'Restart':left===s.minutes*60000?'Start':'Resume');
    text($('next-title'),next?(next.title||'Untitled segment')+' · '+next.minutes+' min':'Final segment — no automatic restart.');$('timer-next').disabled=$('student-next-button').disabled=!next;
    if(presenting){text($('student-clock'),clock(left));text($('student-current'),s.title||'Untitled segment');text($('student-prompt'),s.studentText);text($('student-next'),next?'Next: '+(next.title||'Untitled segment')+' · '+next.minutes+' min':'Final segment');text($('student-pause'),t.timer.running?'Pause timer':left===0?'Restart timer':'Start / resume timer');}
  }
  function toggleTimer() {const t=current();if(t.timer.running)pause(t);else{if(remaining(t)===0)reset(t);t.timer.endAt=Date.now()+t.timer.remainingMs;t.timer.running=true;}persist();renderTimer();}
  function studentAgenda() {
    const t=current();return [t.name||'Untitled class',schedule(t),t.studentIntro,'AGENDA',...t.segments.map((s,i)=>(i+1)+'. '+(s.title||'Untitled segment')+' — '+s.minutes+' minutes'+(s.studentText?'\n'+s.studentText:'')),...(t.resources.some(r=>r.share&&r.url)?['CLASS RESOURCES',...t.resources.filter(r=>r.share&&r.url).map(r=>(r.label||'Resource')+': '+r.url)]:[])].filter(Boolean).join('\n\n');
  }
  function renderStudent() {
    const t=current();$('student-title').textContent=t.name||'Untitled class';$('student-schedule').textContent=schedule(t);$('student-overview').textContent=t.studentIntro;
    $('student-agenda').replaceChildren(...t.segments.map(s=>{const li=node('li');li.append(node('h3','',(s.title||'Untitled segment')+' · '+s.minutes+' minutes'),node('p','preserve-lines',s.studentText));return li;}));
    const resources=t.resources.filter(r=>r.share&&r.url);$('student-resources-section').hidden=resources.length===0;
    $('student-resources').replaceChildren(...resources.map(r=>{const li=node('li'),a=node('a','',r.label||r.url);a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);return li;}));
  }
  function present() {renderStudent();presenting=true;history.replaceState(null,'',location.pathname+location.search+'#student');$('instructor-view').hidden=true;$('student-view-panel').hidden=false;renderTimer();scrollTo(0,0);$('exit-student').focus();}
  function exitPresentation() {presenting=false;history.replaceState(null,'',location.pathname+location.search);$('student-view-panel').hidden=true;$('instructor-view').hidden=false;$('student-view').focus();}
  function download(raw,filename) {const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=node('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
  function exportBackup() {
    const backup=clone(state);for(const t of backup.templates)pause(t);backup.savedAt=new Date().toISOString();
    const raw=JSON.stringify(backup);
    try { parse(raw); }
    catch(error) { message('Backup not downloaded: '+error.message+' Keep this tab open. Copy any text you need elsewhere before reducing the desk or correcting its fields. Your visible desk is unchanged.'); return; }
    download(raw,'zoom-template-desk-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');message('Full backup download started. It includes private notes and meeting links. Keep it somewhere safe.');
  }
  try {
    lastRaw=localStorage.getItem(KEY);
    if(lastRaw!==null){try{state=parse(lastRaw);text($('save-status'),'Your saved desk is restored on this device.');}catch(_){warn('The stored desk cannot be read. It has been kept unchanged. Download stored data before replacing it, or import a valid backup.');}}
    else text($('save-status'),'Holiday Novella is ready. Your changes save on this device as you work.');
  }catch(_){unsaved=true;text($('save-status'),'Browser storage is unavailable. Download a backup before leaving; your changes will not survive a reload.');}
  renderEditor();
  if(location.hash==='#student')present();else $('instructor-view').hidden=false;
  document.querySelectorAll('[data-class]').forEach(input=>{
    const key=input.dataset.class;
    input.addEventListener(['meetingUrl','timeZone','date','startTime'].includes(key)?'change':'input',()=>{
      let value=input.value;
      if(key==='meetingUrl'){value=value.trim();if(!validInput(input,validUrl(value),'Use a full http:// or https:// meeting URL.'))return;}
      if(key==='timeZone'){value=value.trim();if(!validInput(input,validZone(value),'Use a valid IANA time zone, such as America/New_York.'))return;}
      current()[key]=value;input.value=value;persist();if(key==='name')refreshOptions();if(key==='meetingUrl')renderMeeting();
    });
  });
  $('class-select').addEventListener('change',()=>{pause(current());state.activeId=$('class-select').value;persist();renderEditor();message('Class opened. Its clock is paused and ready for you.');pause(current());persist();renderTimer();});
  $('duplicate').addEventListener('click',()=>{
    if(state.templates.length>=30)return;pause(current());const copy=clone(current());copy.id=uid();copy.name=(copy.name.slice(0,125)||'Untitled class')+' copy';copy.segments.forEach(s=>s.id=uid());copy.resources.forEach(r=>r.id=uid());reset(copy,copy.segments[0].id);state.templates.push(copy);state.activeId=copy.id;persist();renderEditor();$('class-name').focus();$('class-name').select();message('Independent copy created. Rename it, then update its date and agenda.');
  });
  $('new-class').addEventListener('click',()=>{
    if(state.templates.length>=30)return;pause(current());const s={id:uid(),title:'Welcome & today’s goal',minutes:10,studentText:'',privateNotes:''};const t={id:uid(),name:'New class',date:'',startTime:'13:00',timeZone:'America/New_York',studentIntro:'',facilitatorNotes:'',meetingUrl:'',segments:[s],resources:[],timer:{segmentId:s.id,remainingMs:600000,running:false,endAt:null}};state.templates.push(t);state.activeId=t.id;persist();renderEditor();$('class-name').focus();$('class-name').select();message('New class created. Add the agenda and resources you need.');
  });
  $('delete-class').addEventListener('click',()=>{if(state.templates.length<2||!confirm('Delete this class and all its notes, links, and timer? Download a full backup first if you need a copy.'))return;state.templates=state.templates.filter(t=>t.id!==state.activeId);state.activeId=state.templates[0].id;pause(current());persist();renderEditor();message('Class deleted.');});
  $('add-segment').addEventListener('click',()=>{const t=current();if(t.segments.length>=40)return;t.segments.push({id:uid(),title:'New segment',minutes:10,studentText:'',privateNotes:''});persist();renderEditor();const last=$('agenda-editor').lastElementChild;last.open=true;last.querySelector('input').focus();});
  $('add-resource').addEventListener('click',()=>{const t=current();if(t.resources.length>=30)return;t.resources.push({id:uid(),label:'New resource',url:'',share:false});persist();renderEditor();$('resources-editor').lastElementChild.querySelector('input').focus();});
  $('timer-toggle').addEventListener('click',toggleTimer);$('student-pause').addEventListener('click',toggleTimer);
  $('timer-reset').addEventListener('click',()=>{if(!confirm('Reset this segment’s timer to its full duration?'))return;reset(current());persist();renderTimer();});
  function nextSegment() {const t=current(),next=t.segments[t.segments.indexOf(segment(t))+1];if(!next)return;if(t.timer.running&&!confirm('Pause this clock and move to the next segment?'))return;reset(t,next.id);persist();renderEditor();message('Next segment ready. Press Start when ready.');}
  $('timer-next').addEventListener('click',nextSegment);$('student-next-button').addEventListener('click',nextSegment);
  $('student-view').addEventListener('click',present);$('exit-student').addEventListener('click',exitPresentation);
  $('copy-agenda').addEventListener('click',async()=>{const copy=studentAgenda();try{await navigator.clipboard.writeText(copy);message('Student agenda copied. Facilitator notes, private resources, and the meeting link are excluded.');}catch(_){$('copy-text').value=copy;$('copy-dialog').showModal();$('copy-text').select();}});
  $('close-copy').addEventListener('click',()=>$('copy-dialog').close());
  $('print-agenda').addEventListener('click',()=>{renderStudent();window.print();});window.addEventListener('beforeprint',renderStudent);
  $('export').addEventListener('click',exportBackup);$('backup-before-import').addEventListener('click',exportBackup);
  $('import').addEventListener('click',()=>{$('import-file').value='';$('import-file').click();});
  $('import-file').addEventListener('change',async()=>{
    const file=$('import-file').files[0];if(!file)return;
    try{if(file.size>MAX_FILE)throw Error('Backup is too large. The limit is 10 MB.');pendingImport=parse(await file.text());$('import-summary').textContent=file.name+' · '+pendingImport.templates.length+' classes · saved '+new Date(pendingImport.savedAt).toLocaleString();$('confirm-import').checked=false;$('apply-import').disabled=true;$('import-dialog').showModal();}
    catch(error){pendingImport=null;message('Backup not imported. '+(error instanceof SyntaxError?'The file is not valid JSON.':error.message)+' Your current desk is unchanged.');}
    finally{$('import-file').value='';}
  });
  $('confirm-import').addEventListener('change',()=>{$('apply-import').disabled=!$('confirm-import').checked;});
  $('cancel-import').addEventListener('click',()=>$('import-dialog').close());$('import-dialog').addEventListener('close',()=>{pendingImport=null;});
  $('apply-import').addEventListener('click',()=>{if(!pendingImport||!$('confirm-import').checked)return;state=clone(pendingImport);for(const t of state.templates)pause(t);const saved=persist(true);$('import-dialog').close();renderEditor();message(saved?'Backup imported. All imported clocks are paused.':'Backup loaded into this page, but NOT saved to browser storage. Download a backup before leaving.');});
  $('download-stored').addEventListener('click',()=>{try{const raw=localStorage.getItem(KEY);if(raw===null){message('No stored data is available. Download the visible desk instead.');return;}download(raw,'zoom-desk-stored-data-'+Date.now()+'.json');message('Stored data download started.');}catch(_){message('Stored data cannot be accessed. Download the visible desk instead.');}});
  $('reload-stored').addEventListener('click',()=>{if(!confirm('Replace this visible desk with the saved desk? Download a backup first to keep the visible version.'))return;try{const raw=localStorage.getItem(KEY);const next=raw===null?{app:APP,version:1,savedAt:new Date().toISOString(),activeId:seed.id,templates:[clone(seed)]}:parse(raw);state=next;lastRaw=raw;locked=false;unsaved=false;$('storage-warning').hidden=true;renderEditor();text($('save-status'),'Saved desk reloaded.');}catch(_){message('Saved data could not be loaded. It remains unchanged.');}});
  $('keep-current').addEventListener('click',()=>{if(confirm('Replace the stored desk with this visible desk? Download stored data first if you need to keep it.'))persist(true);});
  window.addEventListener('storage',event=>{if((event.key===KEY||event.key===null)&&event.newValue!==lastRaw)warn('The stored desk changed or was cleared in another tab. Your visible desk has not been replaced.');});
  window.addEventListener('beforeunload',event=>{if(unsaved){event.preventDefault();event.returnValue='';}});
  setInterval(renderTimer,250);
})();
