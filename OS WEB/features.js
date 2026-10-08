/* Studio OS — features: Today, Proposals, bulk import, retainers, JSONBin sync */

/* ===== TODAY VIEW ===== */
function renderToday(){
  var el = document.getElementById('todayContent'); if (!el) return;
  var now = today();
  var sections = [];

  var dueNow = [];
  state.leads.forEach(function(l){ if (l.stage === 'Signed') return; if (l.nextActionDate && l.nextActionDate <= now) dueNow.push({type:'lead', lead:l, overdue:l.nextActionDate < now}); });
  state.invoices.forEach(function(i){ if (i.status !== 'Paid' && i.status !== 'Cancelled' && i.date && daysBetween(i.date, now) > (state.settings.overdueDays||14)) dueNow.push({type:'invoice', invoice:i, overdue:true}); });
  if (dueNow.length) sections.push({title:'Overdue and due today', urgent:true, items:dueNow});

  var dueWeek = [];
  state.leads.forEach(function(l){ if (l.stage === 'Signed') return; if (l.nextActionDate && l.nextActionDate > now && l.nextActionDate <= addDays(now,7)) dueWeek.push({type:'lead', lead:l}); });
  if (dueWeek.length) sections.push({title:'Coming this week', items:dueWeek});

  var awaiting = state.proposals.filter(function(p){ return p.status === 'Sent' || p.status === 'Viewed'; });
  if (awaiting.length) sections.push({title:'Proposals awaiting reply', items:awaiting.map(function(p){ return {type:'proposal', proposal:p}; })});

  var thisMonth = now.slice(0,7);
  var retainersDue = [];
  state.clients.forEach(function(c){
    if (!c.retainer) return;
    var paid = state.invoices.some(function(i){ return i.clientId === c.id && i.type === 'Retainer' && i.date && i.date.slice(0,7) === thisMonth; });
    if (!paid) retainersDue.push({type:'client', client:c});
  });
  if (retainersDue.length) sections.push({title:'Retainers to bill', items:retainersDue});

  var checkinsDue = [];
  state.clients.forEach(function(c){
    if (!c.launchDate) return;
    var since = daysBetween(c.launchDate, now);
    [30,60,90].forEach(function(d){ if (since >= d && !(c.checkins && c.checkins[d])) checkinsDue.push({type:'checkin', client:c, days:d}); });
  });
  if (checkinsDue.length) sections.push({title:'Check-ins due', items:checkinsDue});

  var staleDays = state.settings.staleDays || 7;
  var stale = [];
  state.leads.forEach(function(l){ if (l.stage === 'Signed') return; if (!l.lastContact) return; var d = daysBetween(l.lastContact, now); if (d >= staleDays) stale.push({type:'lead-stale', lead:l, days:d}); });
  if (stale.length) sections.push({title:'Leads going cold', items:stale});

  var pendInv = state.invoices.filter(function(i){ return i.status === 'Pending'; });
  if (pendInv.length) sections.push({title:'Pending invoices', items:pendInv.map(function(i){ return {type:'invoice', invoice:i}; })});

  var oldDemos = state.demos.filter(function(d){ return d.createdAt && daysBetween(d.createdAt, now) > 60; });
  if (oldDemos.length) sections.push({title:'Demos to clean up', items:oldDemos.map(function(d){ return {type:'demo', demo:d}; })});

  if (sections.length === 0) el.innerHTML = '<div class="empty" style="padding:48px 20px">Nothing needs you right now.</div>';
  else el.innerHTML = sections.map(function(sec){
    return '<div class="today-section' + (sec.urgent?' urgent':'') + '"><h2>' + esc(sec.title) + '<span class="count">' + sec.items.length + '</span></h2>' + sec.items.map(renderTodayItem).join('') + '</div>';
  }).join('');
}

function renderTodayItem(item){
  var now = today();
  if (item.type === 'lead' || item.type === 'lead-stale'){
    var l = item.lead; var tag = '';
    if (item.overdue) tag = '<span class="ti-tag danger">Overdue</span>';
    else if (item.type === 'lead-stale') tag = '<span class="ti-tag warn">' + item.days + 'd stale</span>';
    else if (l.nextActionDate === now) tag = '<span class="ti-tag info">Today</span>';
    var actions = '';
    if (l.phone) actions += '<button onclick="event.stopPropagation();outreachText(\'' + l.id + '\')">SMS</button>';
    if (l.email) actions += '<button onclick="event.stopPropagation();outreachEmail(\'' + l.id + '\')">Mail</button>';
    if (l.phone) actions += '<button onclick="event.stopPropagation();outreachWhatsApp(\'' + l.id + '\')">WA</button>';
    return '<div class="today-item" onclick="openLeadForm(\'' + l.id + '\')"><div class="ti-main"><div class="ti-title">' + esc(l.business||l.name) + '</div><div class="ti-meta">' + esc(l.nextActionNote||l.stage||'') + (l.city ? ' - ' + esc(l.city) : '') + '</div></div>' + tag + '<div class="ti-actions">' + actions + '</div></div>';
  }
  if (item.type === 'invoice'){
    var i = item.invoice;
    return '<div class="today-item" onclick="showView(\'invoices\')"><div class="ti-main"><div class="ti-title">' + esc(i.clientName||'Invoice') + ' - ' + fmt$(i.amount) + '</div><div class="ti-meta">' + esc(i.type||'') + ' - ' + esc(i.date||'') + '</div></div>' + (item.overdue ? '<span class="ti-tag danger">Overdue</span>' : '<span class="ti-tag info">Pending</span>') + '</div>';
  }
  if (item.type === 'proposal'){
    var p = item.proposal;
    return '<div class="today-item" onclick="openProposalForm(\'' + p.id + '\')"><div class="ti-main"><div class="ti-title">' + esc(p.business||p.clientName||'Proposal') + ' - ' + fmt$(p.amount) + '</div><div class="ti-meta">Sent ' + esc(p.sentDate||p.createdAt) + ' - ' + esc(p.status) + '</div></div><span class="ti-tag info">' + esc(p.status) + '</span></div>';
  }
  if (item.type === 'client' || item.type === 'checkin'){
    var c = item.client; var tag2 = ''; var meta = '';
    if (item.type === 'client') { tag2 = '<span class="ti-tag ok">Retainer</span>'; meta = '$' + (c.retainerAmount||0) + '/mo'; }
    else { tag2 = '<span class="ti-tag info">' + item.days + '-day</span>'; meta = 'Launched ' + c.launchDate; }
    var extra = '';
    if (item.type === 'checkin') extra = '<button onclick="event.stopPropagation();markCheckin(\'' + c.id + '\',' + item.days + ')">Mark done</button>';
    return '<div class="today-item" onclick="openClientForm(\'' + c.id + '\')"><div class="ti-main"><div class="ti-title">' + esc(c.business||c.name) + '</div><div class="ti-meta">' + esc(meta) + '</div></div>' + tag2 + '<div class="ti-actions">' + extra + '</div></div>';
  }
  if (item.type === 'demo'){
    var d = item.demo;
    return '<div class="today-item" onclick="showView(\'demos\')"><div class="ti-main"><div class="ti-title">' + esc(d.business) + '</div><div class="ti-meta">Deployed ' + esc(d.createdAt) + '</div></div><span class="ti-tag warn">Cleanup</span></div>';
  }
  return '';
}

function markCheckin(clientId, days){
  var c = findById(state.clients, clientId); if (!c) return;
  if (!c.checkins) c.checkins = {};
  c.checkins[days] = today();
  if (!c.log) c.log = [];
  c.log.push({date:today(), type:'note', text:days + '-day check-in'});
  saveState(); renderAll(); toast(days + '-day logged','ok');
}

function updateBadges(){
  var now = today(); var count = 0;
  state.leads.forEach(function(l){ if (l.stage === 'Signed') return; if (l.nextActionDate && l.nextActionDate <= now) count++; });
  state.invoices.forEach(function(i){ if (i.status !== 'Paid' && i.status !== 'Cancelled' && i.date && daysBetween(i.date, now) > (state.settings.overdueDays||14)) count++; });
  var b = document.getElementById('todayCount'); if (b) b.textContent = count;
  var pb = document.getElementById('proposalCount');
  if (pb) pb.textContent = state.proposals.filter(function(p){ return p.status === 'Sent' || p.status === 'Viewed'; }).length;
}

/* ===== PROPOSALS ===== */
function renderProposals(){
  var el = document.getElementById('proposalsList'); if (!el) return;
  if (state.proposals.length === 0) { el.innerHTML = '<div class="empty">No proposals yet.</div>'; return; }
  var order = {Sent:0, Viewed:1, Draft:2, Accepted:3, Declined:4};
  var sorted = state.proposals.slice().sort(function(a,b){
    var oa = order[a.status]!==undefined?order[a.status]:5, ob = order[b.status]!==undefined?order[b.status]:5;
    if (oa !== ob) return oa - ob;
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });
  el.innerHTML = sorted.map(function(p){
    var actions = '';
    if (p.status === 'Draft') actions += '<button class="btn btn-sm" onclick="updateProposalStatus(\'' + p.id + '\',\'Sent\')">Mark sent</button>';
    if (p.status === 'Sent') actions += '<button class="btn btn-sm" onclick="updateProposalStatus(\'' + p.id + '\',\'Viewed\')">Viewed</button>';
    if (p.status === 'Sent' || p.status === 'Viewed') {
      actions += '<button class="btn btn-sm" style="background:var(--ok);color:#fff;border-color:var(--ok)" onclick="acceptProposal(\'' + p.id + '\')">Accepted</button>';
      actions += '<button class="btn btn-sm" style="background:var(--danger);color:#fff;border-color:var(--danger)" onclick="declineProposal(\'' + p.id + '\')">Declined</button>';
    }
    actions += '<button class="btn btn-sm" onclick="openProposalForm(\'' + p.id + '\')">Edit</button>';
    actions += '<button class="btn btn-sm" onclick="printProposal(\'' + p.id + '\')">Print</button>';
    actions += '<button class="btn btn-sm" onclick="deleteProposal(\'' + p.id + '\')">Delete</button>';
    return '<div class="prop-card"><div class="p-main"><div class="p-biz">' + esc(p.business||p.clientName||'Untitled') + '</div><div class="p-meta">' + esc(p.package||'Standard') + ' - Sent ' + esc(p.sentDate||'-') + (p.declineReason ? ' - ' + esc(p.declineReason) : '') + '</div><div class="p-actions">' + actions + '</div></div><div class="p-side"><div class="p-amount">' + fmt$(p.amount) + '</div><span class="prop-status ' + esc(p.status) + '">' + esc(p.status) + '</span></div></div>';
  }).join('');
}

function openProposalForm(id, leadId){
  var p = id ? findById(state.proposals, id) : null;
  var leadOptions = '<option value="">(none)</option>' + state.leads.map(function(l){
    return '<option value="' + l.id + '" ' + ((p&&p.leadId===l.id) || leadId===l.id ? 'selected' : '') + '>' + esc(l.business||l.name) + '</option>';
  }).join('');
  var prefill = (p&&p.amount) || (leadId && (findById(state.leads, leadId)||{}).value) || state.settings.priceStd;
  var html = '<div class="field"><label>Lead / client</label><select id="f_leadId">' + leadOptions + '</select></div>' +
    '<div class="field-row"><div class="field"><label>Amount ($)</label><input type="number" id="f_amount" value="' + prefill + '"></div><div class="field"><label>Package</label><select id="f_package">' + ['Basic','Standard','Premium','Custom'].map(function(x){ return '<option ' + (p&&p.package===x?'selected':'') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="field-row"><div class="field"><label>Status</label><select id="f_status">' + ['Draft','Sent','Viewed','Accepted','Declined'].map(function(x){ return '<option ' + (p&&p.status===x?'selected':'') + '>' + x + '</option>'; }).join('') + '</select></div><div class="field"><label>Sent date</label><input type="date" id="f_sentDate" value="' + ((p&&p.sentDate)||'') + '"></div></div>' +
    '<div class="field"><label>Scope / notes</label><textarea id="f_scope">' + esc(p?p.scope:'') + '</textarea></div>';
  var foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>';
  if (p) foot += '<button class="btn" onclick="printProposal(\'' + p.id + '\')">Print</button>';
  foot += '<button class="btn btn-primary" onclick="saveProposal(\'' + (id||'') + '\')">Save</button>';
  openModal(p ? 'Edit Proposal' : 'New Proposal', html, foot);
}

function saveProposal(id){
  var leadId = val('f_leadId');
  var lead = leadId ? findById(state.leads, leadId) : null;
  var data = {leadId: leadId||null, business: lead ? (lead.business||lead.name) : (id && (findById(state.proposals,id)||{}).business) || 'Untitled', clientName: lead ? (lead.business||lead.name) : '', amount:Number(val('f_amount'))||0, package:val('f_package'), status:val('f_status'), sentDate:val('f_sentDate'), scope:val('f_scope')};
  if (id) { var p = findById(state.proposals, id); if (p) for (var k in data) if (data.hasOwnProperty(k)) p[k] = data[k]; }
  else {
    data.id = uid(); data.createdAt = today();
    state.proposals.unshift(data);
    if (lead && lead.stage !== 'Signed') {
      lead.stage = 'Proposal';
      if (!lead.log) lead.log = [];
      lead.log.push({date:today(), type:'note', text:'Proposal created: ' + fmt$(data.amount)});
    }
  }
  saveState(); closeModal(); renderAll(); toast('Proposal saved','ok');
}

function updateProposalStatus(id, status){
  var p = findById(state.proposals, id); if (!p) return;
  p.status = status;
  if (status === 'Sent' && !p.sentDate) p.sentDate = today();
  saveState(); renderAll(); toast('Proposal: ' + status,'ok');
}

function acceptProposal(id){
  var p = findById(state.proposals, id); if (!p) return;
  p.status = 'Accepted'; p.respondedDate = today();
  if (p.leadId) {
    var l = findById(state.leads, p.leadId);
    if (l && confirm('Mark "' + (l.business||l.name) + '" as a client now?')) { saveState(); convertLeadToClient(p.leadId); return; }
  }
  saveState(); renderAll(); toast('Proposal accepted','ok');
}

function declineProposal(id){
  var html = '<div class="field"><label>Why was it declined?</label><select id="f_reason">' + LOST_REASONS.map(function(r){ return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div><div class="field"><label>Notes</label><textarea id="f_notes"></textarea></div>';
  openModal('Mark proposal declined', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmDecline(\'' + id + '\')">Confirm</button>');
}

function confirmDecline(id){
  var p = findById(state.proposals, id); if (!p) return;
  var reason = document.getElementById('f_reason').value; var notes = val('f_notes');
  p.status = 'Declined'; p.declineReason = reason; p.respondedDate = today();
  state.lostDeals.push({id:uid(), business:p.business, amount:p.amount, reason:reason, notes:notes, date:today()});
  if (p.leadId) {
    var l = findById(state.leads, p.leadId);
    if (l) { if (!l.log) l.log = []; l.log.push({date:today(), type:'note', text:'Proposal declined: ' + reason}); }
  }
  saveState(); closeModal(); renderAll(); toast('Declined - reason logged','warn');
}

function deleteProposal(id){ if (!confirm('Delete this proposal?')) return; state.proposals = state.proposals.filter(function(p){ return p.id !== id; }); saveState(); renderAll(); toast('Deleted','warn'); }

function printProposal(id){
  var p = findById(state.proposals, id); if (!p) return;
  var s = state.settings;
  var html = '<html><head><title>Proposal - ' + esc(p.business) + '</title><style>body{font-family:"Courier New",monospace;padding:40px;max-width:700px;margin:0 auto;color:#000;line-height:1.7}h1{font-family:Arial;font-size:24px;margin:0 0 4px}h3{font-family:Arial;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 8px}.muted{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.1em}.price{font-family:Arial;font-size:22px;color:#ff3300;font-weight:bold}@media print{body{padding:20px}}</style></head><body><h1>PROPOSAL</h1><div class="muted" style="margin-bottom:24px">' + esc(s.brand||'Studio') + ' - ' + esc(today()) + '</div><h3>Client</h3><div>' + esc(p.business) + '</div><h3>Scope</h3><div>' + (esc(p.scope) || 'Custom website - 6 pages, responsive.') + '</div><h3>Package</h3><div>' + esc(p.package) + '</div><h3>Price</h3><div class="price">' + fmt$(p.amount) + '</div><h3>Terms</h3><div style="white-space:pre-wrap;font-size:12px">' + esc(s.terms) + '</div><h3>Payment</h3><div style="font-size:12px">' + s.depositPct + '% deposit to begin. Balance due at launch.</div><h3>Sign-off</h3><div style="margin-top:30px;font-size:12px">Client: __________________________ Date: __________</div><div style="margin-top:20px;font-size:12px">You: __________________________ Date: __________</div></body></html>';
  var w = window.open('', '_blank'); w.document.write(html); w.document.close();
  setTimeout(function(){ w.print(); }, 400);
}

function markLeadLost(id){
  var html = '<div class="field"><label>Why lost?</label><select id="f_reason">' + LOST_REASONS.map(function(r){ return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div><div class="field"><label>Notes</label><textarea id="f_notes"></textarea></div>';
  openModal('Mark lost', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmLeadLost(\'' + id + '\')">Confirm</button>');
}

function confirmLeadLost(id){
  var l = findById(state.leads, id); if (!l) return;
  var reason = document.getElementById('f_reason').value; var notes = val('f_notes');
  state.lostDeals.push({id:uid(), business:l.business||l.name, amount:l.value||0, reason:reason, notes:notes, date:today()});
  state.leads = state.leads.filter(function(x){ return x.id !== id; });
  saveState(); closeModal(); renderAll(); toast('Marked lost','warn');
}

/* ===== BULK IMPORT ===== */
function openBulkImport(){
  var html = '<p style="font-size:12px;margin-bottom:12px">One business per line.<br>Format: <code style="background:var(--bg);padding:2px 6px">Business, Phone, City, Industry</code></p>' +
    '<div class="field"><label>Paste</label><textarea id="f_bulk" style="min-height:200px;font-family:var(--mono);font-size:12px"></textarea></div>' +
    '<div class="field"><label>Source</label><select id="f_bulkSource"><option>Google Maps</option><option>Facebook</option><option>Walk-in</option><option>Referral</option><option>Other</option></select></div>' +
    '<div class="field-row"><div class="field"><label>Default city</label><input id="f_defaultCity" placeholder="Miami"></div><div class="field"><label>Default stage</label><select id="f_defaultStage">' + STAGES.map(function(x){ return '<option>' + x + '</option>'; }).join('') + '</select></div></div>';
  openModal('Bulk import leads', html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="confirmBulkImport()">Import</button>');
}

function confirmBulkImport(){
  var raw = document.getElementById('f_bulk').value;
  var source = document.getElementById('f_bulkSource').value;
  var defaultCity = val('f_defaultCity');
  var defaultStage = document.getElementById('f_defaultStage').value;
  var lines = raw.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  if (lines.length === 0) { toast('Nothing to import','warn'); return; }
  var added = 0;
  lines.forEach(function(line){
    var parts = line.split(/\t|,(?![^(]*\))/).map(function(p){ return p.trim(); });
    var business = parts[0]; if (!business) return;
    state.leads.unshift({id:uid(), business:business, name:'', industry:parts[3]||'business', city:parts[2]||defaultCity, phone:parts[1]||'', email:'', source:source, value:state.settings.priceStd, stage:defaultStage, demoUrl:'', nextActionDate:'', nextActionNote:'', notes:'Imported ' + today(), createdAt:today(), lastContact:today(), log:[{date:today(), type:'note', text:'Imported'}]});
    added++;
  });
  saveState(); closeModal(); renderAll(); toast('Imported ' + added,'ok');
}

/* ===== RECURRING RETAINERS ===== */
function runRecurringRetainers(){
  var now = today();
  var day = new Date().getDate();
  var thisMonth = now.slice(0,7);
  var created = 0;
  state.clients.forEach(function(c){
    if (!c.retainer) return;
    var billDay = c.retainerBillingDay || state.settings.retainerBillingDay || 1;
    if (day < billDay) return;
    var exists = state.invoices.some(function(i){ return i.clientId === c.id && i.type === 'Retainer' && i.date && i.date.slice(0,7) === thisMonth; });
    if (exists) return;
    state.invoices.unshift({id:uid(), clientId:c.id, clientName:c.business||c.name, type:'Retainer', amount:c.retainerAmount || state.settings.retainer || 0, status:'Pending', date:now, payoneerRef:(state.settings.payoneer||'PAY-') + uid().toUpperCase(), notes:'Monthly retainer - ' + thisMonth});
    created++;
  });
  if (created > 0) { saveState(); toast(created + ' retainer invoice' + (created>1?'s':'') + ' created','ok'); }
}

/* ===== JSONBIN SYNC =====
   Uses JSONBin.io free tier. Get a master key at jsonbin.io after free signup
   (email only, no verification required). The bin is created automatically on
   first Enable; copy the bin ID to your second device to share the same bin.
*/
var syncTimer = null, syncPoll = null;
var JSONBIN_API = 'https://api.jsonbin.io/v3/b';

function jsonbinHeaders(){
  return {'Content-Type':'application/json', 'X-Master-Key': (state.settings.syncUrl||'').trim()};
}
function updateSyncLabel(){
  var el = document.getElementById('syncStatus'), elLong = document.getElementById('syncStatusLong');
  var txt = syncEnabled ? ('Synced ' + (state.ui.lastSync ? state.ui.lastSync.slice(11,16) : '...')) : 'Local only';
  if (el) el.textContent = txt;
  if (elLong) elLong.textContent = 'Status: ' + (syncEnabled
    ? 'cloud sync active — bin ' + ((state.settings.syncCode||'').slice(0,10)) + '… — last ' + (state.ui.lastSync||'never')
    : 'local only');
}

function enableSync(){
  var key = (state.settings.syncUrl || '').trim();
  var binId = (state.settings.syncCode || '').trim();
  if (!key) { toast('Paste your JSONBin Master Key first','warn'); return; }
  if (!binId) { createNewBin(key); return; }
  // Bin exists — connect
  syncEnabled = true;
  startPoll();
  syncNow(true);
  updateSyncLabel();
  toast('Sync enabled','ok');
}

function createNewBin(key){
  toast('Creating new cloud bin...','ok');
  var payload = JSON.stringify({state:state, updatedAt:new Date().toISOString()});
  fetch(JSONBIN_API, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-Master-Key':key,'X-Bin-Name':'studio-os','X-Bin-Private':'true'},
    body: payload
  }).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data){
      var id = data.metadata && data.metadata.id;
      if (!id) throw new Error('No bin ID returned');
      state.settings.syncCode = id;
      saveState();
      syncEnabled = true;
      startPoll();
      updateSyncLabel();
      var el = document.getElementById('setSyncCode'); if (el) el.value = id;
      toast('Sync enabled. Bin ID: ' + id + ' — copy this to your other device.','ok');
      if (window.console) console.log('[Studio OS] JSONBin created — bin ID:', id);
    })
    .catch(function(e){ toast('Sync setup failed: ' + e.message,'warn'); if (window.console) console.error(e); });
}

function disableSync(){
  syncEnabled = false;
  if (syncPoll) { clearInterval(syncPoll); syncPoll = null; }
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
  updateSyncLabel();
  toast('Sync disabled — still saving locally','warn');
}

function scheduleSync(){
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 1500);
}

function startPoll(){
  if (syncPoll) clearInterval(syncPoll);
  syncPoll = setInterval(pullSync, 15000);
}

function pushSync(){
  if (!syncEnabled) return;
  var key = (state.settings.syncUrl||'').trim();
  var binId = (state.settings.syncCode||'').trim();
  if (!key || !binId) return;
  var payload = JSON.stringify({state:state, updatedAt:new Date().toISOString()});
  fetch(JSONBIN_API + '/' + binId, {method:'PUT', headers:jsonbinHeaders(), body:payload})
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(){ state.ui.lastSync = new Date().toISOString(); try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e){} updateSyncLabel(); })
    .catch(function(e){ if (window.console) console.warn('Push failed', e); });
}

function pullSync(){
  if (!syncEnabled) return;
  var key = (state.settings.syncUrl||'').trim();
  var binId = (state.settings.syncCode||'').trim();
  if (!key || !binId) return;
  fetch(JSONBIN_API + '/' + binId + '/latest', {headers:jsonbinHeaders()})
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data){
      if (!data || !data.record || !data.record.state) return;
      var remote = data.record;
      var remoteUpdated = remote.updatedAt || '';
      var localUpdated = state.ui.lastSync || '';
      if (remoteUpdated > localUpdated) {
        var view = state.ui.view;
        state = mergeDeep(defaultState(), remote.state);
        state.ui.view = view;
        state.ui.lastSync = remoteUpdated;
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e){}
        renderAll(); applyTheme(); updateSyncLabel();
        toast('Synced from cloud','ok');
      }
    })
    .catch(function(e){ if (window.console) console.warn('Pull failed', e); });
}

function syncNow(silent){
  var key = (state.settings.syncUrl||'').trim();
  var binId = (state.settings.syncCode||'').trim();
  if (!key) { if (!silent) toast('Set your Master Key first','warn'); return; }
  if (!binId) { createNewBin(key); return; }
  syncEnabled = true;
  pushSync();
  if (!silent) toast('Syncing...','ok');
}

function initSync(){
  var key = (state.settings.syncUrl||'').trim();
  var binId = (state.settings.syncCode||'').trim();
  if (key && binId) {
    syncEnabled = true;
    pullSync();
    startPoll();
    updateSyncLabel();
  }
}

/* Relabel the sync fields for JSONBin (works without touching index.html) */
function relabelSyncUI(){
  var urlInput = document.getElementById('setSyncUrl');
  var codeInput = document.getElementById('setSyncCode');
  if (urlInput) {
    urlInput.placeholder = '$2b$10$...paste your JSONBin Master Key';
    var l1 = urlInput.parentElement.querySelector('label');
    if (l1) l1.textContent = 'JSONBin Master Key';
  }
  if (codeInput) {
    codeInput.placeholder = 'auto-created on Enable — or paste from device 1';
    var l2 = codeInput.parentElement.querySelector('label');
    if (l2) l2.textContent = 'Bin ID';
  }
  var help = document.getElementById('syncHelp');
  if (help) help.innerHTML = '<strong>Setup (2 min):</strong><br>' +
    '1. Go to <code>jsonbin.io</code> → sign up (email only, no verification)<br>' +
    '2. Dashboard shows your <strong>X-Master-Key</strong>. Copy it.<br>' +
    '3. Paste it above, click <strong>Enable sync</strong>. A bin is created automatically.<br>' +
    '4. The <strong>Bin ID</strong> field fills in — copy that value.<br>' +
    '5. On your phone: same Master Key + same Bin ID → Enable sync.<br>' +
    '<br><span id="syncStatusLong" style="color:var(--ink)">Status: local only</span>';
}

/* ===== EXPOSE ===== */
window.renderToday = renderToday;
window.renderTodayItem = renderTodayItem;
window.markCheckin = markCheckin;
window.updateBadges = updateBadges;
window.renderProposals = renderProposals;
window.openProposalForm = openProposalForm;
window.saveProposal = saveProposal;
window.updateProposalStatus = updateProposalStatus;
window.acceptProposal = acceptProposal;
window.declineProposal = declineProposal;
window.confirmDecline = confirmDecline;
window.deleteProposal = deleteProposal;
window.printProposal = printProposal;
window.markLeadLost = markLeadLost;
window.confirmLeadLost = confirmLeadLost;
window.openBulkImport = openBulkImport;
window.confirmBulkImport = confirmBulkImport;
window.runRecurringRetainers = runRecurringRetainers;
window.enableSync = enableSync;
window.disableSync = disableSync;
window.syncNow = syncNow;
window.scheduleSync = scheduleSync;
window.initSync = initSync;
window.relabelSyncUI = relabelSyncUI;

// Relabel as soon as the settings panel exists
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', relabelSyncUI);
else relabelSyncUI();
