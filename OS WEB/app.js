/* Studio OS — core: state, dashboard, CRUD views, scripts, settings, export */

var STORE_KEY = 'studio-os-v7';
var state;
var syncEnabled = false;

function defaultState(){
  return {
    leads: [], clients: [], invoices: [], demos: [], proposals: [], timeEntries: [], lostDeals: [],
    scripts: JSON.parse(JSON.stringify(DEFAULT_SCRIPTS)),
    outreach: JSON.parse(JSON.stringify(DEFAULT_OUTREACH)),
    ui: { theme:'light', view:'today', lastBackup: today(), lastSync: null },
    settings: {
      name:'', email:'', brand:'', phone:'', location:'', payoneer:'',
      priceBasic:1500, priceStd:2000, pricePrem:2800, retainer:100, hourly:75, depositPct:50,
      followUpDays:3, retainerBillingDay:1, staleDays:7, overdueDays:14,
      syncUrl:'', syncCode:'',
      terms:'50% deposit to begin. Balance due at launch.\n2 rounds of revisions. Written feedback only.\n30 days of bug fixes after launch.\nAfter 30 days, changes are $75/hour or a $100/month retainer.'
    }
  };
}

function loadState(){
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    return mergeDeep(defaultState(), JSON.parse(raw));
  } catch(e) { return defaultState(); }
}

function mergeDeep(base, override){
  if (!override || typeof override !== 'object') return base;
  var out = Array.isArray(base) ? base.slice() : {};
  if (!Array.isArray(base)) for (var k in base) if (base.hasOwnProperty(k)) out[k] = base[k];
  for (var k2 in override) if (override.hasOwnProperty(k2)) {
    var bv = out[k2], ov = override[k2];
    if (Array.isArray(ov)) out[k2] = ov.slice();
    else if (ov && typeof ov === 'object' && bv && typeof bv === 'object' && !Array.isArray(bv)) out[k2] = mergeDeep(bv, ov);
    else out[k2] = ov;
  }
  return out;
}

function saveState(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e){}
  if (syncEnabled && typeof window.scheduleSync === 'function') window.scheduleSync();
}

function uid(){ return Math.random().toString(36).slice(2,10); }
function today(){ return new Date().toISOString().slice(0,10); }
function fmt$(n){ n = Number(n)||0; return '$' + n.toLocaleString('en-US',{maximumFractionDigits:0}); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
function daysBetween(a,b){ return Math.floor((new Date(b) - new Date(a)) / 86400000); }
function addDays(d,n){ var t = new Date(d); t.setDate(t.getDate()+n); return t.toISOString().slice(0,10); }
function findById(arr,id){ if (!arr) return null; for (var i=0;i<arr.length;i++) if (arr[i].id===id) return arr[i]; return null; }
function $(id){ return document.getElementById(id); }
function val(id){ var el = $(id); return el ? el.value.trim() : ''; }

var toastTimer;
function toast(msg, kind){
  var t = $('toast'); if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2400);
}

function toggleTheme(){ state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark'; saveState(); applyTheme(); }
function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.ui.theme || 'light');
  var l = $('themeLabel'); if (l) l.textContent = state.ui.theme === 'dark' ? 'Light mode' : 'Dark mode';
}

function showView(name){
  if (!name) name = 'today';
  var views = document.querySelectorAll('.view');
  for (var i=0;i<views.length;i++) views[i].classList.toggle('active', views[i].id === 'view-' + name);
  var navs = document.querySelectorAll('.nav-item[data-view]');
  for (var j=0;j<navs.length;j++) navs[j].classList.toggle('active', navs[j].getAttribute('data-view') === name);
  state.ui.view = name; saveState(); window.scrollTo(0,0);
}

function openModal(title, body, foot){
  $('modalTitle').textContent = title; $('modalBody').innerHTML = body; $('modalFoot').innerHTML = foot || '';
  $('modalBack').classList.add('open');
}
function closeModal(){ $('modalBack').classList.remove('open'); }

/* ===== DASHBOARD ===== */
function renderDashboard(){
  var year = new Date().getFullYear();
  var paid=0, pending=0;
  state.invoices.forEach(function(i){
    var amt = Number(i.amount)||0;
    if (i.status==='Paid' && i.date && i.date.slice(0,4)===String(year)) paid += amt;
    if (i.status==='Pending') pending += amt;
  });
  var openLeads = state.leads.filter(function(l){ return l.stage !== 'Signed'; });
  var raw=0, weighted=0;
  openLeads.forEach(function(l){
    var v = Number(l.value) || state.settings.priceStd;
    raw += v; weighted += v * (STAGE_PROB[l.stage] || 0.1);
  });
  var activeClients = state.clients.filter(function(c){ return c.stage !== 'Done'; }).length;
  var onRetainer = state.clients.filter(function(c){ return c.retainer; }).length;
  var now = today();
  var dueWeek = openLeads.filter(function(l){ return l.nextActionDate && l.nextActionDate <= addDays(now,7); });

  var e;
  e = $('sRevenue'); if (e) e.textContent = fmt$(paid);
  e = $('sRevenuePending'); if (e) e.textContent = fmt$(pending) + ' pending';
  e = $('sPipeline'); if (e) e.textContent = fmt$(Math.round(weighted));
  e = $('sPipelineRaw'); if (e) e.textContent = fmt$(raw) + ' raw';
  e = $('sClients'); if (e) e.textContent = activeClients;
  e = $('sRetainers'); if (e) e.textContent = onRetainer + ' on retainer';
  e = $('sLeads'); if (e) e.textContent = openLeads.length;
  e = $('sLeadsDue'); if (e) e.textContent = dueWeek.length + ' due this week';

  var stageEl = $('leadStageTable');
  if (stageEl) {
    var counts = {}, values = {};
    STAGES.forEach(function(s){ counts[s] = 0; values[s] = 0; });
    state.leads.forEach(function(l){ if (counts[l.stage] !== undefined) { counts[l.stage]++; values[l.stage] += Number(l.value)||0; } });
    var maxCount = 1;
    STAGES.forEach(function(s){ if (counts[s] > maxCount) maxCount = counts[s]; });
    stageEl.innerHTML = STAGES.map(function(s){
      var pct = Math.round((counts[s]/maxCount) * 100);
      return '<div class="stage-row"><div class="sn">' + s + '</div><div class="sc">' + counts[s] + '</div><div class="sbar"><div style="width:' + pct + '%"></div></div><div class="sv">' + fmt$(values[s]) + '</div></div>';
    }).join('');
  }

  var dueEl = $('dueThisWeek');
  if (dueEl) {
    if (dueWeek.length === 0) dueEl.innerHTML = '<div class="empty">Nothing scheduled. Set a "Next action" on a lead.</div>';
    else {
      dueWeek.sort(function(a,b){ return a.nextActionDate.localeCompare(b.nextActionDate); });
      dueEl.innerHTML = dueWeek.map(function(l){
        var over = l.nextActionDate < now;
        return '<div class="sr-item" onclick="openLeadForm(\'' + l.id + '\')"><div class="t">' + (over?'! ':'') + esc(l.business||l.name) + ' <span class="pill ' + (over?'danger':'info') + '">' + l.nextActionDate + '</span></div><div class="m">' + esc(l.nextActionNote||'(no note)') + ' - ' + esc(l.stage) + '</div></div>';
      }).join('');
    }
  }

  var att = [];
  var staleDays = state.settings.staleDays || 7;
  openLeads.forEach(function(l){
    if (!l.lastContact) return;
    var d = daysBetween(l.lastContact, now);
    if (d >= staleDays) att.push({type:'warn', text:'Lead stale ' + d + 'd - ' + esc(l.business||l.name), action:"showView('leads')"});
  });
  state.invoices.forEach(function(i){ if (i.status==='Pending') att.push({type:'', text:'Invoice pending ' + fmt$(i.amount) + ' - ' + esc(i.clientName||''), action:"showView('invoices')"}); });
  state.clients.forEach(function(c){ if (c.stage==='Content' && !c.contentReceived) att.push({type:'warn', text:'Awaiting content - ' + esc(c.business||c.name), action:"showView('clients')"}); });
  if (state.ui.lastBackup && daysBetween(state.ui.lastBackup, now) >= 7) att.unshift({type:'danger', text:'Backup overdue - click to export', action:'exportBackup()'});
  var attEl = $('attentionList');
  if (attEl) {
    if (att.length === 0) attEl.innerHTML = '<div class="empty">All clear.</div>';
    else attEl.innerHTML = att.slice(0,12).map(function(a){ return '<div class="sr-item" onclick="' + a.action + '"><span class="pill ' + (a.type||'') + '">' + (a.type||'info') + '</span> ' + a.text + '</div>'; }).join('');
  }

  var recent = [];
  state.leads.forEach(function(l){ (l.log||[]).forEach(function(ev){ recent.push({date:ev.date, text:ev.text, who:l.business||l.name, kind:'Lead'}); }); });
  state.clients.forEach(function(c){ (c.log||[]).forEach(function(ev){ recent.push({date:ev.date, text:ev.text, who:c.business||c.name, kind:'Client'}); }); });
  recent.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  var recEl = $('recentActivity');
  if (recEl) {
    if (recent.length === 0) recEl.innerHTML = '<div class="empty">No activity yet.</div>';
    else recEl.innerHTML = '<div class="timeline">' + recent.slice(0,8).map(function(r){ return '<div class="ev"><div class="d">' + esc(r.date) + ' - ' + esc(r.kind) + ' - ' + esc(r.who) + '</div>' + esc(r.text) + '</div>'; }).join('') + '</div>';
  }

  var months = []; var dnow = new Date();
  for (var i=11;i>=0;i--){ var d = new Date(dnow.getFullYear(), dnow.getMonth()-i, 1); months.push({y:d.getFullYear(), m:d.getMonth(), label:d.toLocaleString('en-US',{month:'short'})}); }
  var byMonth = months.map(function(mo){
    var sum = 0;
    state.invoices.forEach(function(inv){
      if (inv.status !== 'Paid' || !inv.date) return;
      var dd = new Date(inv.date);
      if (dd.getFullYear() === mo.y && dd.getMonth() === mo.m) sum += Number(inv.amount)||0;
    });
    return sum;
  });
  var maxV = 1; byMonth.forEach(function(v){ if (v > maxV) maxV = v; });
  var rC = $('revenueChart');
  if (rC) rC.innerHTML = '<div class="bar-chart">' + byMonth.map(function(v,i){
    var h = Math.max(2, Math.round(v/maxV * 130));
    return '<div class="bar" style="height:' + h + 'px"><span class="lbl">' + (v>0?fmt$(v).replace('$',''):'') + '</span><span class="x">' + months[i].label + '</span></div>';
  }).join('') + '</div>';

  var bySource = {};
  state.leads.forEach(function(l){ var s = l.source || 'Unknown'; if (!bySource[s]) bySource[s] = 0; bySource[s]++; });
  var sC = $('sourceChart');
  if (sC) {
    var keys = Object.keys(bySource).sort(function(a,b){ return bySource[b] - bySource[a]; });
    if (keys.length === 0) sC.innerHTML = '<div class="empty">No leads yet.</div>';
    else {
      var maxS = bySource[keys[0]];
      sC.innerHTML = keys.map(function(k){
        var pct = Math.round((bySource[k]/maxS) * 100);
        return '<div style="margin-bottom:8px"><div class="row-between"><span class="label">' + esc(k) + '</span><span class="label">' + bySource[k] + '</span></div><div style="border:1.5px solid var(--line);height:10px"><div style="height:100%;width:' + pct + '%;background:var(--accent)"></div></div></div>';
      }).join('');
    }
  }
}

/* ===== LEADS ===== */
function renderLeads(){
  var kb = $('kanban'); if (!kb) return;
  var html = '';
  STAGES.forEach(function(stage){
    var items = state.leads.filter(function(l){ return l.stage === stage; });
    html += '<div class="kcol"><div class="kcol-head">' + stage + '<span class="c">' + items.length + '</span></div>';
    items.forEach(function(l){ html += leadCard(l); });
    html += '</div>';
  });
  kb.innerHTML = html;
  var lc = $('leadCount'); if (lc) lc.textContent = state.leads.filter(function(l){ return l.stage !== 'Signed'; }).length;
  var cc = $('clientCount'); if (cc) cc.textContent = state.clients.length;
}

function leadCard(l){
  var now = today();
  var staleDays = state.settings.staleDays || 7;
  var stale = l.lastContact && daysBetween(l.lastContact, now) >= staleDays;
  var overdue = l.nextActionDate && l.nextActionDate < now;
  var due = l.nextActionDate && l.nextActionDate <= addDays(now,7);
  var tags = '';
  if (l.value) tags += '<span class="tag">' + fmt$(l.value) + '</span>';
  if (overdue) tags += '<span class="tag danger">DUE ' + l.nextActionDate + '</span>';
  else if (due) tags += '<span class="tag info">DUE ' + l.nextActionDate + '</span>';
  if (stale && !due) tags += '<span class="tag warn">STALE ' + daysBetween(l.lastContact, now) + 'd</span>';
  if (l.demoUrl) tags += '<span class="tag ok">DEMO</span>';
  var outreach = '';
  if (l.email) outreach += '<button class="kact" onclick="event.stopPropagation();outreachEmail(\'' + l.id + '\')">Mail</button>';
  if (l.phone) outreach += '<button class="kact" onclick="event.stopPropagation();outreachText(\'' + l.id + '\')">SMS</button>';
  if (l.phone) outreach += '<button class="kact" onclick="event.stopPropagation();outreachWhatsApp(\'' + l.id + '\')">WA</button>';
  return '<div class="kcard" onclick="openLeadForm(\'' + l.id + '\')"><div class="biz">' + esc(l.business || l.name || 'Untitled') + '</div><div class="meta">' + esc(l.industry||'') + (l.city ? ' - ' + esc(l.city) : '') + '</div>' + (l.nextActionNote ? '<div class="meta" style="margin-top:4px">' + esc(l.nextActionNote) + '</div>' : '') + '<div class="tags">' + tags + '</div>' + (outreach ? '<div class="kcard-actions">' + outreach + '</div>' : '') + '</div>';
}

function openLeadForm(id){
  var lead = id ? findById(state.leads, id) : null;
  var html =
    '<div class="field-row"><div class="field"><label>Business name</label><input id="f_business" value="' + esc(lead?lead.business:'') + '"></div><div class="field"><label>Owner / contact</label><input id="f_name" value="' + esc(lead?lead.name:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Industry</label><input id="f_industry" value="' + esc(lead?lead.industry:'') + '"></div><div class="field"><label>City</label><input id="f_city" value="' + esc(lead?lead.city:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Phone</label><input id="f_phone" value="' + esc(lead?lead.phone:'') + '"></div><div class="field"><label>Email</label><input id="f_email" value="' + esc(lead?lead.email:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Source</label><select id="f_source">' + ['Google Maps','Facebook','Walk-in','Referral','Cold email','LinkedIn','Other'].map(function(s){ return '<option ' + (lead&&lead.source===s?'selected':'') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label>Estimated value ($)</label><input type="number" id="f_value" value="' + ((lead&&lead.value) || state.settings.priceStd) + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Stage</label><select id="f_stage">' + STAGES.map(function(s){ return '<option ' + (lead&&lead.stage===s?'selected':'') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label>Demo URL</label><input id="f_demoUrl" value="' + esc(lead?lead.demoUrl:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Next action date</label><input type="date" id="f_nextActionDate" value="' + esc(lead?lead.nextActionDate:'') + '"></div><div class="field"><label>Next action note</label><input id="f_nextActionNote" value="' + esc(lead?lead.nextActionNote:'') + '"></div></div>' +
    '<div class="field"><label>Notes</label><textarea id="f_notes">' + esc(lead?lead.notes:'') + '</textarea></div>';

  if (lead) {
    html += '<div class="panel-head mt"><h2>Quick outreach</h2></div><div class="row" style="flex-wrap:wrap">';
    if (lead.email) html += '<button class="btn btn-sm" onclick="outreachEmail(\'' + lead.id + '\');closeModal()">Email</button>';
    if (lead.phone) html += '<button class="btn btn-sm" onclick="outreachText(\'' + lead.id + '\');closeModal()">Text</button>';
    if (lead.phone) html += '<button class="btn btn-sm" onclick="outreachWhatsApp(\'' + lead.id + '\');closeModal()">WhatsApp</button>';
    html += '</div>';
    html += '<div class="panel-head mt"><h2>Activity log</h2></div><div class="timeline">';
    var log = (lead.log||[]).slice().reverse();
    if (log.length === 0) html += '<div class="empty">No activity yet</div>';
    else log.forEach(function(e2){ html += '<div class="ev"><div class="d">' + esc(e2.date) + (e2.type && e2.type !== 'note' ? ' - ' + esc(e2.type) : '') + '</div>' + esc(e2.text) + '</div>'; });
    html += '</div>';
    html += '<div class="chip-row">' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'call\',\'Left voicemail\')">Left voicemail</span>' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'call\',\'No answer\')">No answer</span>' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'call\',\'Spoke on phone\')">Spoke</span>' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'email\',\'Sent cold email\')">Cold email</span>' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'text\',\'Sent text\')">Text</span>' +
      '<span class="chip" onclick="quickLog(\'' + lead.id + '\',\'meeting\',\'Discovery call\')">Discovery</span>' +
      '</div>' +
      '<div class="row mt"><input id="f_log" placeholder="Custom log entry..." style="flex:1;padding:8px 10px;border:2px solid var(--line);background:var(--surface);font-size:12px"><button class="btn btn-sm" onclick="addLog(\'' + lead.id + '\')">+ Add</button></div>' +
      '<div class="row mt" style="flex-wrap:wrap"><button class="btn btn-sm" onclick="convertLeadToClient(\'' + lead.id + '\')">Convert to client</button><button class="btn btn-sm" onclick="openProposalForm(null,\'' + lead.id + '\')">Create proposal</button><button class="btn btn-sm" onclick="markLeadLost(\'' + lead.id + '\')">Mark lost</button></div>';
  }
  var foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  if (lead) foot += '<button class="btn" onclick="deleteLead(\'' + lead.id + '\')">Delete</button>';
  foot += '<button class="btn btn-primary" onclick="saveLead(\'' + (id||'') + '\')">Save</button>';
  openModal(lead ? 'Edit Lead' : 'New Lead', html, foot);
}

function saveLead(id){
  var data = {
    business: val('f_business'), name: val('f_name'), industry: val('f_industry'), city: val('f_city'),
    phone: val('f_phone'), email: val('f_email'), source: val('f_source'),
    value: Number(val('f_value'))||0, stage: val('f_stage'), demoUrl: val('f_demoUrl'),
    nextActionDate: val('f_nextActionDate'), nextActionNote: val('f_nextActionNote'), notes: val('f_notes')
  };
  if (id) {
    var l = findById(state.leads, id);
    if (l) { for (var k in data) if (data.hasOwnProperty(k)) l[k] = data[k]; l.lastContact = today(); }
  } else {
    var dup = checkDuplicates(data);
    if (dup && !confirm('Possible duplicate: "' + dup + '". Add anyway?')) return;
    var n = {id:uid(), createdAt:today(), lastContact:today(), log:[]};
    for (var k2 in data) if (data.hasOwnProperty(k2)) n[k2] = data[k2];
    state.leads.unshift(n);
  }
  saveState(); closeModal(); renderAll(); toast('Lead saved','ok');
}

function deleteLead(id){ if (!confirm('Delete this lead?')) return; state.leads = state.leads.filter(function(l){ return l.id !== id; }); saveState(); closeModal(); renderAll(); toast('Lead deleted','warn'); }

function quickLog(id, type, text){
  var l = findById(state.leads, id); if (!l) return;
  if (!l.log) l.log = [];
  l.log.push({date:today(), type:type, text:text});
  l.lastContact = today();
  saveState(); renderAll(); openLeadForm(id);
}

function addLog(id){
  var inp = $('f_log'); if (!inp) return;
  var text = inp.value.trim(); if (!text) return;
  var l = findById(state.leads, id); if (!l) return;
  if (!l.log) l.log = [];
  l.log.push({date:today(), type:'note', text:text});
  l.lastContact = today();
  saveState(); renderAll(); openLeadForm(id);
}

function convertLeadToClient(leadId){
  var l = findById(state.leads, leadId); if (!l) return;
  if (!confirm('Convert to client?')) return;
  var c = {id:uid(), business:l.business, name:l.name, phone:l.phone, email:l.email, industry:l.industry, city:l.city, package:'Standard', price:l.value || state.settings.priceStd, stage:'Content', launchDate:'', contentReceived:false, retainer:false, retainerAmount:state.settings.retainer, retainerBillingDay:state.settings.retainerBillingDay||1, liveUrl:l.demoUrl||'', notes:l.notes, checklist:{}, checkins:{}, feedback:{}, createdAt:today(), log:(l.log||[]).slice()};
  c.log.push({date:today(), type:'note', text:'Converted from lead.'});
  state.clients.unshift(c);
  state.leads = state.leads.filter(function(x){ return x.id !== leadId; });
  saveState(); closeModal(); renderAll(); showView('clients'); toast('Client created','ok');
}

function checkDuplicates(data){
  var phone = (data.phone||'').replace(/\D/g,'');
  var email = (data.email||'').toLowerCase().trim();
  var biz = (data.business||'').toLowerCase().trim();
  var all = state.leads.concat(state.clients);
  for (var i=0;i<all.length;i++){
    var x = all[i];
    if (phone && (x.phone||'').replace(/\D/g,'') === phone && phone.length >= 6) return x.business||x.name;
    if (email && (x.email||'').toLowerCase().trim() === email) return x.business||x.name;
    if (biz.length > 4 && (x.business||'').toLowerCase().trim() === biz) return x.business||x.name;
  }
  return null;
}

/* ===== OUTREACH ===== */
function fillTemplate(tpl, l){
  var s = state.settings;
  var demoLine = l.demoUrl ? 'Preview: ' + l.demoUrl : '';
  var cityClause = l.city ? ' in ' + l.city : '';
  var demoClause = l.demoUrl ? 'has a preview I put together' : 'does not have a modern website';
  return String(tpl)
    .replace(/\{business\}/g, l.business || 'your business')
    .replace(/\{name\}/g, l.name || 'there')
    .replace(/\{industry\}/g, l.industry || 'businesses')
    .replace(/\{city\}/g, l.city || '')
    .replace(/\{demo\}/g, l.demoUrl || '')
    .replace(/\{demo_line\}/g, demoLine)
    .replace(/\{demo_clause\}/g, demoClause)
    .replace(/\{city_clause\}/g, cityClause)
    .replace(/\{me_name\}/g, s.name || '[your name]')
    .replace(/\{me_phone\}/g, s.phone || '')
    .replace(/\{me_email\}/g, s.email || '')
    .replace(/\{me_brand\}/g, s.brand || 'Studio')
    .replace(/\{price\}/g, fmt$(s.priceStd))
    .replace(/\{retainer\}/g, fmt$(s.retainer))
    .replace(/\{hourly\}/g, fmt$(s.hourly));
}

function outreachEmail(id){
  var l = findById(state.leads, id); if (!l) return;
  if (!l.email) { toast('No email','warn'); return; }
  var sub = fillTemplate(state.outreach.email.subject, l);
  var body = fillTemplate(state.outreach.email.body, l);
  window.location.href = 'mailto:' + encodeURIComponent(l.email) + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
  logOutreach(id, 'email');
}
function outreachText(id){
  var l = findById(state.leads, id); if (!l) return;
  if (!l.phone) { toast('No phone','warn'); return; }
  var body = fillTemplate(state.outreach.text.body, l);
  window.location.href = 'sms:' + String(l.phone).replace(/[^\d+]/g,'') + '?body=' + encodeURIComponent(body);
  logOutreach(id, 'text');
}
function outreachWhatsApp(id){
  var l = findById(state.leads, id); if (!l) return;
  if (!l.phone) { toast('No phone','warn'); return; }
  var body = fillTemplate(state.outreach.wa.body, l);
  window.open('https://wa.me/' + String(l.phone).replace(/[^\d]/g,'') + '?text=' + encodeURIComponent(body), '_blank');
  logOutreach(id, 'wa');
}
function logOutreach(id, channel){
  var l = findById(state.leads, id); if (!l) return;
  if (!l.log) l.log = [];
  l.log.push({date:today(), type:channel, text:'Outreach via ' + channel});
  l.lastContact = today();
  if (l.stage === 'Found') l.stage = 'Contacted';
  var days = state.settings.followUpDays || 3;
  l.nextActionDate = addDays(today(), days);
  l.nextActionNote = 'Follow up - no reply yet';
  saveState(); renderAll();
}

/* ===== CLIENTS ===== */
function renderClients(){
  var el = $('clientsList'); if (!el) return;
  if (state.clients.length === 0) { el.innerHTML = '<div class="empty">No clients yet.</div>'; return; }
  var rows = state.clients.map(function(c){
    var cl = c.checklist || {};
    var done = DEFAULT_CHECKLIST.filter(function(x){ return cl[x]; }).length;
    var total = DEFAULT_CHECKLIST.length;
    var pct = Math.round(done/total*100);
    return '<tr onclick="openClientForm(\'' + c.id + '\')" style="cursor:pointer"><td><strong>' + esc(c.business||c.name) + '</strong><div style="font-size:10px;color:var(--muted)">' + esc(c.industry||'') + '</div></td><td><span class="pill">' + esc(c.stage||'Content') + '</span></td><td>' + (c.contentReceived ? '<span class="pill ok">Yes</span>' : '<span class="pill warn">Pending</span>') + '</td><td>' + fmt$(c.price) + '</td><td>' + (c.retainer ? '<span class="pill ok">$' + c.retainerAmount + '/mo</span>' : '-') + '</td><td>' + (c.launchDate||'-') + '</td><td><div style="font-size:10px">' + done + '/' + total + ' (' + pct + '%)</div><div style="border:1.5px solid var(--line);height:6px;margin-top:2px"><div style="height:100%;width:' + pct + '%;background:var(--accent)"></div></div></td></tr>';
  }).join('');
  el.innerHTML = '<table class="tbl"><thead><tr><th>Business</th><th>Stage</th><th>Content</th><th>Value</th><th>Retainer</th><th>Launch</th><th>Checklist</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openClientForm(id){
  var c = id ? findById(state.clients, id) : null;
  var html =
    '<div class="field-row"><div class="field"><label>Business name</label><input id="f_business" value="' + esc(c?c.business:'') + '"></div><div class="field"><label>Contact</label><input id="f_name" value="' + esc(c?c.name:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Phone</label><input id="f_phone" value="' + esc(c?c.phone:'') + '"></div><div class="field"><label>Email</label><input id="f_email" value="' + esc(c?c.email:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Industry</label><input id="f_industry" value="' + esc(c?c.industry:'') + '"></div><div class="field"><label>City</label><input id="f_city" value="' + esc(c?c.city:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Package</label><select id="f_package">' + ['Basic','Standard','Premium'].map(function(p){ return '<option ' + (c&&c.package===p?'selected':'') + '>' + p + '</option>'; }).join('') + '</select></div><div class="field"><label>Price ($)</label><input type="number" id="f_price" value="' + ((c&&c.price) || state.settings.priceStd) + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Stage</label><select id="f_stage">' + CLIENT_STAGES.map(function(s){ return '<option ' + (c&&c.stage===s?'selected':'') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label>Launch date</label><input type="date" id="f_launchDate" value="' + esc(c?c.launchDate:'') + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Content received?</label><select id="f_contentReceived"><option value="">No</option><option value="1" ' + (c&&c.contentReceived?'selected':'') + '>Yes</option></select></div><div class="field"><label>On retainer?</label><select id="f_retainer"><option value="">No</option><option value="1" ' + (c&&c.retainer?'selected':'') + '>Yes</option></select></div></div>' +
    '<div class="field-row"><div class="field"><label>Retainer ($/mo)</label><input type="number" id="f_retainerAmount" value="' + ((c&&c.retainerAmount) || state.settings.retainer) + '"></div><div class="field"><label>Billing day (1-28)</label><input type="number" id="f_retainerBillingDay" min="1" max="28" value="' + ((c&&c.retainerBillingDay) || state.settings.retainerBillingDay || 1) + '"></div></div>' +
    '<div class="field"><label>Live URL</label><input id="f_liveUrl" value="' + esc(c?c.liveUrl:'') + '"></div>' +
    '<div class="field"><label>Notes</label><textarea id="f_notes">' + esc(c?c.notes:'') + '</textarea></div>';
  if (c) {
    var checklist = c.checklist || {};
    html += '<div class="panel-head mt"><h2>Launch checklist</h2></div><div class="checklist">';
    DEFAULT_CHECKLIST.forEach(function(item, idx){
      html += '<label class="' + (checklist[item]?'done':'') + '"><input type="checkbox" ' + (checklist[item]?'checked':'') + ' onchange="toggleChecklist(\'' + c.id + '\',' + idx + ',this.checked)"><span>' + esc(item) + '</span></label>';
    });
    html += '</div>';
    html += '<div class="row mt" style="flex-wrap:wrap"><button class="btn btn-sm" onclick="generateInvoice(\'' + c.id + '\',\'Deposit\')">+ Deposit invoice</button><button class="btn btn-sm" onclick="generateInvoice(\'' + c.id + '\',\'Final\')">+ Final invoice</button><button class="btn btn-sm" onclick="openTimeForm(\'' + c.id + '\')">+ Log time</button><button class="btn btn-sm" onclick="invoiceFromTime(\'' + c.id + '\')">Invoice from time</button></div>';
  }
  var foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  if (c) foot += '<button class="btn" onclick="deleteClient(\'' + c.id + '\')">Delete</button>';
  foot += '<button class="btn btn-primary" onclick="saveClient(\'' + (id||'') + '\')">Save</button>';
  openModal(c ? 'Edit Client' : 'New Client', html, foot);
}

function toggleChecklist(clientId, index, checked){
  var c = findById(state.clients, clientId); if (!c) return;
  if (!c.checklist) c.checklist = {};
  c.checklist[DEFAULT_CHECKLIST[index]] = checked;
  saveState(); renderClients();
}

function saveClient(id){
  var data = {business:val('f_business'), name:val('f_name'), phone:val('f_phone'), email:val('f_email'), industry:val('f_industry'), city:val('f_city'), package:val('f_package'), price:Number(val('f_price'))||0, stage:val('f_stage'), launchDate:val('f_launchDate'), contentReceived:!!val('f_contentReceived'), retainer:!!val('f_retainer'), retainerAmount:Number(val('f_retainerAmount'))||0, retainerBillingDay:Number(val('f_retainerBillingDay'))||1, liveUrl:val('f_liveUrl'), notes:val('f_notes')};
  if (id) { var c = findById(state.clients, id); if (c) for (var k in data) if (data.hasOwnProperty(k)) c[k] = data[k]; }
  else { var n = {id:uid(), createdAt:today(), log:[], checklist:{}, checkins:{}, feedback:{}}; for (var k2 in data) if (data.hasOwnProperty(k2)) n[k2] = data[k2]; state.clients.unshift(n); }
  saveState(); closeModal(); renderAll(); toast('Client saved','ok');
}

function deleteClient(id){ if (!confirm('Delete this client?')) return; state.clients = state.clients.filter(function(c){ return c.id !== id; }); saveState(); closeModal(); renderAll(); toast('Client deleted','warn'); }

function generateInvoice(clientId, type){
  var c = findById(state.clients, clientId); if (!c) return;
  var pct = state.settings.depositPct || 50;
  var amount = type === 'Deposit' ? Math.round((c.price||0)*pct/100) : Math.round((c.price||0)*(100-pct)/100);
  state.invoices.unshift({id:uid(), clientId:clientId, clientName:c.business || c.name, type:type, amount:amount, status:'Pending', date:today(), payoneerRef:(state.settings.payoneer||'PAY-') + uid().toUpperCase(), notes:type + ' - ' + (c.package||'Standard')});
  saveState(); renderAll(); toast(type + ' invoice generated','ok'); closeModal();
}

/* ===== INVOICES ===== */
function renderInvoices(){
  var el = $('invoicesList'); if (!el) return;
  var paid=0, pending=0, overdue=0;
  var now = today();
  state.invoices.forEach(function(i){
    var amt = Number(i.amount)||0;
    if (i.status === 'Paid') paid += amt;
    if (i.status === 'Pending') pending += amt;
    if (i.status !== 'Paid' && i.status !== 'Cancelled' && i.date && daysBetween(i.date, now) > (state.settings.overdueDays||14)) overdue += amt;
  });
  var e;
  e = $('invPaid'); if (e) e.textContent = fmt$(paid);
  e = $('invPending'); if (e) e.textContent = fmt$(pending);
  e = $('invOverdue'); if (e) e.textContent = fmt$(overdue);
  if (state.invoices.length === 0) { el.innerHTML = '<div class="empty">No invoices yet.</div>'; return; }
  var rows = state.invoices.map(function(i){
    return '<tr><td>' + esc(i.clientName||'-') + '</td><td>' + esc(i.type) + '</td><td><strong>' + fmt$(i.amount) + '</strong></td><td><select onchange="setInvoiceStatus(\'' + i.id + '\',this.value)" style="padding:2px 4px;border:1.5px solid var(--line);background:var(--surface);font-size:11px">' + ['Pending','Paid','Overdue','Cancelled'].map(function(s){ return '<option ' + (i.status===s?'selected':'') + '>' + s + '</option>'; }).join('') + '</select></td><td>' + esc(i.date) + '</td><td style="font-size:10px">' + esc(i.payoneerRef||'') + '</td><td class="acts"><button class="btn btn-sm" onclick="deleteInvoice(\'' + i.id + '\')">Delete</button></td></tr>';
  }).join('');
  el.innerHTML = '<table class="tbl"><thead><tr><th>Client</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Ref</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function setInvoiceStatus(id, status){ var inv = findById(state.invoices, id); if (inv) { inv.status = status; saveState(); renderAll(); toast('Invoice ' + status.toLowerCase(),'ok'); } }
function deleteInvoice(id){ if (!confirm('Delete this invoice?')) return; state.invoices = state.invoices.filter(function(x){ return x.id !== id; }); saveState(); renderAll(); toast('Deleted','warn'); }

function openInvoiceForm(){
  var clientOpts = '<option value="">(none)</option>' + state.clients.map(function(c){ return '<option value="' + c.id + '">' + esc(c.business||c.name) + '</option>'; }).join('');
  var html = '<div class="field"><label>Client</label><select id="f_client">' + clientOpts + '</select></div>' +
    '<div class="field-row"><div class="field"><label>Type</label><select id="f_type"><option>Deposit</option><option>Final</option><option>Retainer</option><option>Custom</option></select></div><div class="field"><label>Amount ($)</label><input type="number" id="f_amount" value="' + state.settings.priceStd + '"></div></div>' +
    '<div class="field-row"><div class="field"><label>Date</label><input type="date" id="f_date" value="' + today() + '"></div><div class="field"><label>Status</label><select id="f_status"><option>Pending</option><option>Paid</option></select></div></div>' +
    '<div class="field"><label>Payoneer reference</label><input id="f_payoneerRef" value="' + ((state.settings.payoneer||'PAY-') + uid().toUpperCase()) + '"></div>' +
    '<div class="field"><label>Notes</label><input id="f_notes"></div>';
  openModal('New Invoice', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveInvoice()">Save</button>');
}

function saveInvoice(){
  var clientId = val('f_client');
  var client = clientId ? findById(state.clients, clientId) : null;
  state.invoices.unshift({id:uid(), clientId:clientId||null, clientName:client ? (client.business||client.name) : '', type:val('f_type'), amount:Number(val('f_amount'))||0, status:val('f_status'), date:val('f_date'), payoneerRef:val('f_payoneerRef'), notes:val('f_notes')});
  saveState(); closeModal(); renderAll(); toast('Invoice created','ok');
}

/* ===== DEMOS ===== */
function renderDemos(){
  var el = $('demosList'); if (!el) return;
  if (state.demos.length === 0) { el.innerHTML = '<div class="empty">No demos tracked.</div>'; return; }
  var now = today();
  var rows = state.demos.map(function(d){
    var age = d.createdAt ? daysBetween(d.createdAt, now) : 0;
    var stale = age > 60;
    return '<tr><td>' + esc(d.business) + '</td><td><a href="' + esc(d.url) + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline">' + esc(d.url) + '</a></td><td>' + esc(d.createdAt||'') + ' (' + age + 'd)</td><td>' + (stale ? '<span class="pill danger">Cleanup</span>' : '<span class="pill ok">Active</span>') + '</td><td class="acts"><button class="btn btn-sm" onclick="deleteDemo(\'' + d.id + '\')">Delete</button></td></tr>';
  }).join('');
  el.innerHTML = '<table class="tbl"><thead><tr><th>Business</th><th>URL</th><th>Deployed</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openDemoForm(){
  openModal('New Demo', '<div class="field"><label>Business name</label><input id="f_business"></div><div class="field"><label>Demo URL</label><input id="f_url" placeholder="https://demo.pages.dev"></div>', '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveDemo()">Save</button>');
}

function saveDemo(){
  var business = val('f_business'); var url = val('f_url');
  if (!business || !url) { toast('Fill both fields','warn'); return; }
  state.demos.unshift({id:uid(), business:business, url:url, createdAt:today()});
  saveState(); closeModal(); renderAll(); toast('Demo added','ok');
}

function deleteDemo(id){ state.demos = state.demos.filter(function(d){ return d.id !== id; }); saveState(); renderAll(); toast('Removed','warn'); }

/* ===== TIME ===== */
function renderTime(){
  var el = $('timeList'); if (!el) return;
  var now = today();
  var thisMonth = now.slice(0,7);
  var monthMin = state.timeEntries.filter(function(t){ return t.date && t.date.slice(0,7) === thisMonth; }).reduce(function(a,t){ return a + (t.minutes||0); }, 0);
  var unbilled = state.timeEntries.filter(function(t){ return !t.invoiced; });
  var unbilledMin = unbilled.reduce(function(a,t){ return a + (t.minutes||0); }, 0);
  var unbilledValue = (unbilledMin/60) * (state.settings.hourly||75);
  var e;
  e = $('timeMonth'); if (e) e.textContent = (monthMin/60).toFixed(1) + 'h';
  e = $('timeUnbilled'); if (e) e.textContent = (unbilledMin/60).toFixed(1) + 'h';
  e = $('timeValue'); if (e) e.textContent = fmt$(Math.round(unbilledValue));
  if (state.timeEntries.length === 0) { el.innerHTML = '<div class="empty">No time logged yet.</div>'; return; }
  var sorted = state.timeEntries.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var rows = sorted.slice(0,100).map(function(t){
    var c = t.clientId ? findById(state.clients, t.clientId) : null;
    return '<tr><td>' + esc(t.date) + '</td><td>' + (c ? esc(c.business||c.name) : '-') + '</td><td>' + ((t.minutes||0)/60).toFixed(2) + 'h</td><td>' + esc(t.note||'') + '</td><td>' + (t.invoiced ? '<span class="pill ok">Billed</span>' : '<span class="pill warn">Unbilled</span>') + '</td><td class="acts"><button class="btn btn-sm" onclick="deleteTime(\'' + t.id + '\')">Delete</button></td></tr>';
  }).join('');
  el.innerHTML = '<table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Hours</th><th>Note</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function openTimeForm(preClientId){
  var clientOpts = '<option value="">(none)</option>' + state.clients.map(function(c){ return '<option value="' + c.id + '" ' + (preClientId===c.id?'selected':'') + '>' + esc(c.business||c.name) + '</option>'; }).join('');
  var html = '<div class="field"><label>Client</label><select id="f_clientId">' + clientOpts + '</select></div>' +
    '<div class="field-row"><div class="field"><label>Date</label><input type="date" id="f_date" value="' + today() + '"></div><div class="field"><label>Hours (e.g. 1.5)</label><input type="number" step="0.25" id="f_hours" value="1"></div></div>' +
    '<div class="field"><label>What did you do?</label><input id="f_note" placeholder="Fixed form, added photos"></div>';
  openModal('Log time', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveTime()">Save</button>');
}

function saveTime(){
  var hours = Number(val('f_hours'))||0;
  if (hours <= 0) { toast('Hours must be > 0','warn'); return; }
  state.timeEntries.unshift({id:uid(), clientId:val('f_clientId')||null, date:val('f_date')||today(), minutes:Math.round(hours*60), note:val('f_note'), invoiced:false});
  saveState(); closeModal(); renderAll(); toast('Time logged','ok');
}

function deleteTime(id){ if (!confirm('Delete this entry?')) return; state.timeEntries = state.timeEntries.filter(function(t){ return t.id !== id; }); saveState(); renderAll(); }

function invoiceFromTime(clientId){
  var unbilled = state.timeEntries.filter(function(t){ return !t.invoiced && t.clientId === clientId; });
  if (unbilled.length === 0) { toast('No unbilled time for this client','warn'); return; }
  var totalMin = unbilled.reduce(function(a,t){ return a + (t.minutes||0); }, 0);
  var total = Math.round((totalMin/60) * (state.settings.hourly||75));
  if (!confirm('Create invoice for ' + (totalMin/60).toFixed(2) + 'h ($' + total + ')?')) return;
  var c = findById(state.clients, clientId);
  state.invoices.unshift({id:uid(), clientId:clientId, clientName:c ? (c.business||c.name) : '', type:'Time', amount:total, status:'Pending', date:today(), payoneerRef:(state.settings.payoneer||'PAY-') + uid().toUpperCase(), notes:(totalMin/60).toFixed(2) + 'h @ ' + fmt$(state.settings.hourly) + '/hr'});
  unbilled.forEach(function(t){ t.invoiced = true; });
  saveState(); closeModal(); renderAll(); toast('Invoice created','ok');
}

/* ===== SCRIPTS ===== */
function renderScripts(){
  var el = $('scriptsList'); if (!el) return;
  var showDeleted = $('showDeletedScripts') && $('showDeletedScripts').checked;
  var visible = state.scripts.filter(function(s){ return showDeleted ? true : !s.deleted; });
  if (visible.length === 0) { el.innerHTML = '<div class="empty">No scripts. Click "+ New" to add.</div>'; return; }
  var groups = {};
  visible.forEach(function(s){ var cat = s.category || 'general'; if (!groups[cat]) groups[cat] = []; groups[cat].push(s); });
  var labels = {outreach:'Outreach', calls:'Calls', proposals:'Proposals', 'post-launch':'Post-launch', admin:'Admin', general:'General'};
  var html = '';
  for (var cat in groups) {
    if (!groups.hasOwnProperty(cat)) continue;
    html += '<div class="panel"><div class="panel-head"><h2>' + esc(labels[cat]||cat) + '</h2></div>';
    groups[cat].forEach(function(s){
      var btnHtml = s.deleted
        ? '<button class="btn btn-sm" onclick="restoreScript(\'' + s.id + '\')">Restore</button><button class="btn btn-sm" onclick="purgeScript(\'' + s.id + '\')">Delete forever</button>'
        : '<button class="btn btn-sm" onclick="copyScript(\'' + s.id + '\',this)">Copy</button><button class="btn btn-sm" onclick="deleteScript(\'' + s.id + '\')">Delete</button>';
      html += '<div class="script' + (s.deleted?' deleted':'') + '"><div class="script-head"><span class="script-cat">' + esc(s.category||'general') + '</span><h3 contenteditable="true" onblur="editScriptTitle(\'' + s.id + '\',this.textContent)">' + esc(s.title) + '</h3><div class="row">' + btnHtml + '</div></div><div class="script-body" contenteditable="true" onblur="editScriptBody(\'' + s.id + '\',this.textContent)">' + esc(s.body) + '</div></div>';
    });
    html += '</div>';
  }
  el.innerHTML = html;
}
function editScriptTitle(id, text){ var s = findById(state.scripts, id); if (!s) return; s.title = text.trim() || 'Untitled'; saveState(); toast('Saved','ok'); }
function editScriptBody(id, text){ var s = findById(state.scripts, id); if (!s) return; s.body = text; saveState(); toast('Saved','ok'); }
function copyScript(id, btn){
  var s = findById(state.scripts, id); if (!s) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(s.body).then(function(){
      var orig = btn.textContent; btn.textContent = 'Copied';
      setTimeout(function(){ btn.textContent = orig; }, 1500);
    }).catch(function(){ toast('Copy failed','warn'); });
  } else toast('Clipboard unavailable','warn');
}
function addScript(){ state.scripts.push({id:uid(), category:'general', title:'New script', body:'Write here', deleted:false}); saveState(); renderScripts(); toast('Script added','ok'); }
function deleteScript(id){ var s = findById(state.scripts, id); if (!s) return; s.deleted = true; s.deletedAt = today(); saveState(); renderScripts(); toast('Moved to deleted - toggle "Show deleted"','warn'); }
function restoreScript(id){ var s = findById(state.scripts, id); if (!s) return; s.deleted = false; s.deletedAt = null; saveState(); renderScripts(); toast('Script restored','ok'); }
function purgeScript(id){ if (!confirm('Permanently delete?')) return; state.scripts = state.scripts.filter(function(x){ return x.id !== id; }); saveState(); renderScripts(); toast('Deleted forever','warn'); }

/* ===== PLAYBOOK ===== */
function renderPlaybook(){
  var el = $('playbookContent'); if (!el) return;
  el.innerHTML = PLAYBOOK.map(function(p, i){
    return '<details class="pb-group" ' + (i===0?'open':'') + '><summary>' + esc(p.title) + '</summary><div class="pb-body">' + p.body + '</div></details>';
  }).join('');
}

/* ===== SETTINGS ===== */
function renderSettingsForm(){
  var s = state.settings;
  function set(id, v){ var el = $(id); if (el) el.value = v == null ? '' : v; }
  set('setSyncUrl', s.syncUrl); set('setSyncCode', s.syncCode);
  set('setName', s.name); set('setEmail', s.email); set('setBrand', s.brand);
  set('setPhone', s.phone); set('setLocation', s.location); set('setPayoneer', s.payoneer);
  set('setPriceBasic', s.priceBasic); set('setPriceStd', s.priceStd); set('setPricePrem', s.pricePrem);
  set('setRetainer', s.retainer); set('setHourly', s.hourly); set('setDepositPct', s.depositPct);
  set('setFollowUpDays', s.followUpDays); set('setRetainerBillingDay', s.retainerBillingDay);
  set('setStaleDays', s.staleDays); set('setOverdueDays', s.overdueDays);
  set('setTerms', s.terms);
}
function saveSetting(key, value){ state.settings[key] = value; saveState(); }

/* ===== EXPORT / IMPORT / CSV ===== */
function exportBackup(){
  state.ui.lastBackup = today(); saveState();
  var blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'studio-os-backup-' + today() + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('Backup exported','ok'); renderDashboard();
}
function handleImport(e){
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    try {
      var data = JSON.parse(ev.target.result);
      if (!confirm('Replace all current data?')) return;
      state = mergeDeep(defaultState(), data);
      saveState(); renderAll(); applyTheme(); toast('Data imported','ok');
    } catch(err){ toast('Invalid JSON','warn'); }
  };
  reader.readAsText(file); e.target.value = '';
}
function resetAllData(){
  if (!confirm('DELETE ALL DATA?')) return;
  if (!confirm('Really sure?')) return;
  state = defaultState(); saveState(); renderAll(); applyTheme(); toast('All data reset','warn');
}
function exportCSV(kind){
  var headers = [], rows = [];
  if (kind === 'leads') { headers = ['business','contact','phone','email','industry','city','source','stage','value','demoUrl','notes','createdAt']; rows = state.leads.map(function(l){ return [l.business,l.name,l.phone,l.email,l.industry,l.city,l.source,l.stage,l.value,l.demoUrl,l.notes,l.createdAt]; }); }
  else if (kind === 'clients') { headers = ['business','contact','phone','email','industry','city','package','price','stage','launchDate','contentReceived','retainer','retainerAmount','liveUrl','notes','createdAt']; rows = state.clients.map(function(c){ return [c.business,c.name,c.phone,c.email,c.industry,c.city,c.package,c.price,c.stage,c.launchDate,c.contentReceived,c.retainer,c.retainerAmount,c.liveUrl,c.notes,c.createdAt]; }); }
  else if (kind === 'invoices') { headers = ['clientName','type','amount','status','date','payoneerRef','notes']; rows = state.invoices.map(function(i){ return [i.clientName,i.type,i.amount,i.status,i.date,i.payoneerRef,i.notes]; }); }
  else if (kind === 'time') { headers = ['date','client','hours','note','invoiced']; rows = state.timeEntries.map(function(t){ var c = t.clientId ? findById(state.clients, t.clientId) : null; return [t.date, c?(c.business||c.name):'', ((t.minutes||0)/60).toFixed(2), t.note, t.invoiced]; }); }
  else if (kind === 'lost') { headers = ['date','business','amount','reason','notes']; rows = state.lostDeals.map(function(l){ return [l.date,l.business,l.amount,l.reason,l.notes]; }); }
  else return;
  function cc(v){ if (v == null) return ''; var s = String(v).replace(/"/g,'""'); if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) return '"' + s + '"'; return s; }
  var csv = headers.join(',') + '\r\n' + rows.map(function(r){ return r.map(cc).join(','); }).join('\r\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'studio-os-' + kind + '-' + today() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast(kind + '.csv exported','ok');
}

/* ===== SEARCH ===== */
function doSearch(q){
  var res = $('searchResults'); if (!res) return;
  q = (q||'').trim().toLowerCase();
  if (!q || q.length < 2) { res.classList.remove('open'); return; }
  var hits = [];
  state.leads.forEach(function(l){ var hay = ((l.business||'') + ' ' + (l.name||'') + ' ' + (l.industry||'') + ' ' + (l.city||'')).toLowerCase(); if (hay.indexOf(q) !== -1) hits.push({type:'Lead', title:l.business||l.name, meta:l.stage, action:"showView('leads');setTimeout(function(){openLeadForm('" + l.id + "')},100)"}); });
  state.clients.forEach(function(c){ var hay = ((c.business||'') + ' ' + (c.name||'') + ' ' + (c.industry||'')).toLowerCase(); if (hay.indexOf(q) !== -1) hits.push({type:'Client', title:c.business||c.name, meta:c.stage, action:"showView('clients');setTimeout(function(){openClientForm('" + c.id + "')},100)"}); });
  state.invoices.forEach(function(i){ var hay = ((i.clientName||'') + ' ' + (i.payoneerRef||'')).toLowerCase(); if (hay.indexOf(q) !== -1) hits.push({type:'Invoice', title:(i.clientName||'') + ' ' + fmt$(i.amount), meta:i.status, action:"showView('invoices')"}); });
  if (hits.length === 0) res.innerHTML = '<div class="sr-item"><div class="m">No results</div></div>';
  else res.innerHTML = hits.slice(0,10).map(function(h){ return '<div class="sr-item" onclick="' + h.action + ';document.getElementById(\'searchResults\').classList.remove(\'open\');document.getElementById(\'searchInput\').value=\'\'"><div class="t">[' + h.type + '] ' + esc(h.title) + '</div><div class="m">' + esc(h.meta||'') + '</div></div>'; }).join('');
  res.classList.add('open');
}

/* ===== QUICK ADD ===== */
function quickAddMenu(){
  var html = '<div style="display:flex;flex-direction:column;gap:8px">' +
    '<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="closeModal();openLeadForm()">+ New Lead</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="closeModal();openClientForm()">+ New Client</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="closeModal();openProposalForm()">+ New Proposal</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="closeModal();openInvoiceForm()">+ New Invoice</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="closeModal();openDemoForm()">+ New Demo</button>' +
    '<button class="btn" style="width:100%;justify-content:center" onclick="closeModal();openTimeForm()">+ Log Time</button>' +
    '</div>';
  openModal('Quick Add', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>');
}

/* ===== CLOCK ===== */
function tickClock(){
  var el = $('topClock'); if (!el) return;
  var d = new Date();
  el.textContent = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'}) + ' - ' + d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
}

/* ===== RENDER ALL ===== */
function renderAll(){
  var fns = [renderDashboard, renderLeads, renderClients, renderInvoices, renderDemos, renderTime, renderScripts, renderPlaybook, renderSettingsForm];
  fns.forEach(function(fn){ try { fn(); } catch(e){ if (window.console) console.error('[Studio OS]', fn.name, e); } });
  if (typeof window.renderProposals === 'function') { try { window.renderProposals(); } catch(e){} }
  if (typeof window.renderToday === 'function') { try { window.renderToday(); } catch(e){} }
  if (typeof window.updateBadges === 'function') { try { window.updateBadges(); } catch(e){} }
}

/* ===== EXPOSE ===== */
window.showView = showView;
window.openLeadForm = openLeadForm; window.openClientForm = openClientForm;
window.openInvoiceForm = openInvoiceForm; window.openDemoForm = openDemoForm; window.openTimeForm = openTimeForm;
window.openModal = openModal; window.closeModal = closeModal;
window.saveLead = saveLead; window.saveClient = saveClient; window.saveInvoice = saveInvoice;
window.saveDemo = saveDemo; window.saveTime = saveTime;
window.deleteLead = deleteLead; window.deleteClient = deleteClient;
window.deleteInvoice = deleteInvoice; window.deleteDemo = deleteDemo; window.deleteTime = deleteTime;
window.toggleChecklist = toggleChecklist; window.quickLog = quickLog; window.addLog = addLog;
window.convertLeadToClient = convertLeadToClient;
window.outreachEmail = outreachEmail; window.outreachText = outreachText; window.outreachWhatsApp = outreachWhatsApp;
window.generateInvoice = generateInvoice; window.setInvoiceStatus = setInvoiceStatus;
window.invoiceFromTime = invoiceFromTime;
window.toggleTheme = toggleTheme; window.exportBackup = exportBackup; window.handleImport = handleImport;
window.resetAllData = resetAllData; window.doSearch = doSearch; window.quickAddMenu = quickAddMenu;
window.exportCSV = exportCSV;
window.addScript = addScript; window.deleteScript = deleteScript; window.restoreScript = restoreScript;
window.purgeScript = purgeScript; window.copyScript = copyScript;
window.editScriptTitle = editScriptTitle; window.editScriptBody = editScriptBody;
window.saveSetting = saveSetting; window.toast = toast;
window.renderScripts = renderScripts; window.renderAll = renderAll;
window.uid = uid; window.today = today; window.fmt$ = fmt$; window.esc = esc;
window.daysBetween = daysBetween; window.addDays = addDays; window.findById = findById;
window.saveState = saveState; window.defaultState = defaultState; window.mergeDeep = mergeDeep;

/* ===== KEYBOARD ===== */
document.addEventListener('keydown', function(e){
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && !document.activeElement.isContentEditable) {
    e.preventDefault(); var inp = $('searchInput'); if (inp) inp.focus();
  }
  if (e.key === 'Escape') { closeModal(); var res = $('searchResults'); if (res) res.classList.remove('open'); }
});
document.addEventListener('click', function(e){
  if (!e.target.closest('.search')) { var res = $('searchResults'); if (res) res.classList.remove('open'); }
});

/* ===== INIT ===== */
function initStudioOS(){
  state = loadState();
  applyTheme();
  if (typeof window.runRecurringRetainers === 'function') { try { window.runRecurringRetainers(); } catch(e){} }
  renderAll();
  showView(state.ui.view || 'today');
  tickClock(); setInterval(tickClock, 30000);
  if (typeof window.initSync === 'function') { try { window.initSync(); } catch(e){} }
  if (state.leads.length === 0 && state.clients.length === 0) {
    setTimeout(function(){ toast('Welcome. Add a lead or read the Playbook.','ok'); }, 800);
  }
  if (window.console) console.log('[Studio OS] Ready. Leads:', state.leads.length, 'Sync:', syncEnabled);
}
window.initStudioOS = initStudioOS;
