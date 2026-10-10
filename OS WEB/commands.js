/* Studio OS — command search: + add, - delete, > go, / filter, @ source, # stage, ? help */

var leadFilter = null;

/* --- Delete picker --- */
function openDeletePicker(kind){
  closeSearch();
  var items = [];
  if (kind === 'lead') items = state.leads.map(function(x){ return {id:x.id, label:x.business||x.name||'Untitled', meta:x.stage}; });
  else if (kind === 'client') items = state.clients.map(function(x){ return {id:x.id, label:x.business||x.name||'Untitled', meta:x.stage}; });
  else if (kind === 'invoice') items = state.invoices.map(function(x){ return {id:x.id, label:x.clientName||'Invoice', meta:fmt$(x.amount)+' — '+x.status}; });
  else if (kind === 'proposal') items = state.proposals.map(function(x){ return {id:x.id, label:x.business||'Proposal', meta:fmt$(x.amount)+' — '+x.status}; });
  else if (kind === 'demo') items = state.demos.map(function(x){ return {id:x.id, label:x.business, meta:x.url}; });
  else if (kind === 'time') items = state.timeEntries.map(function(x){ return {id:x.id, label:x.note||'Time entry', meta:x.date+' — '+((x.minutes||0)/60).toFixed(2)+'h'}; });
  else if (kind === 'deploy') items = (state.deploys||[]).map(function(x){ return {id:x.id, label:(x.clientName||'(no client)')+' '+x.target, meta:x.date+' — '+x.status}; });

  window._dpItems = items;
  window._dpKind = kind;

  var html = '<div class="field"><label>Filter</label><input id="dp_search" placeholder="Type to filter…" oninput="dpFilter()"></div>' +
    '<div id="dp_list" style="max-height:400px;overflow-y:auto">' + renderDeleteList(items, kind) + '</div>';

  openModal('Delete ' + kind, html, '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>');
}

function renderDeleteList(items, kind){
  if (items.length === 0) return '<div class="empty">Nothing to delete.</div>';
  return items.map(function(item){
    return '<div class="sr-item" onclick="dpPick(\'' + kind + '\',\'' + item.id + '\')">' +
      '<div class="t">' + esc(item.label) + '</div>' +
      '<div class="m">' + esc(item.meta||'') + '</div></div>';
  }).join('');
}

function dpFilter(){
  var q = (document.getElementById('dp_search').value || '').toLowerCase();
  var filtered = window._dpItems.filter(function(i){
    return (i.label||'').toLowerCase().indexOf(q) !== -1 || (i.meta||'').toLowerCase().indexOf(q) !== -1;
  });
  document.getElementById('dp_list').innerHTML = renderDeleteList(filtered, window._dpKind);
}

function dpPick(kind, id){
  if (!confirm('Delete this ' + kind + '? This cannot be undone.')) return;
  if (kind === 'lead') state.leads = state.leads.filter(function(x){ return x.id !== id; });
  else if (kind === 'client') state.clients = state.clients.filter(function(x){ return x.id !== id; });
  else if (kind === 'invoice') state.invoices = state.invoices.filter(function(x){ return x.id !== id; });
  else if (kind === 'proposal') state.proposals = state.proposals.filter(function(x){ return x.id !== id; });
  else if (kind === 'demo') state.demos = state.demos.filter(function(x){ return x.id !== id; });
  else if (kind === 'time') state.timeEntries = state.timeEntries.filter(function(x){ return x.id !== id; });
  else if (kind === 'deploy') state.deploys = (state.deploys||[]).filter(function(x){ return x.id !== id; });
  saveState(); closeModal(); renderAll(); toast('Deleted','warn');
}

/* --- Lead filters --- */
function filterLeadsBySource(s){
  leadFilter = {type:'source', value:s};
  showView('leads'); renderLeads(); closeSearch();
}
function filterLeadsByStage(s){
  leadFilter = {type:'stage', value:s};
  showView('leads'); renderLeads(); closeSearch();
}
function clearLeadFilter(){
  leadFilter = null;
  showView('leads'); renderLeads();
}
function renderFilteredLeads(){
  var kb = document.getElementById('kanban'); if (!kb) return;
  var items = state.leads.filter(function(l){
    if (leadFilter.type === 'source') return l.source === leadFilter.value;
    if (leadFilter.type === 'stage') return l.stage === leadFilter.value;
    return true;
  });
  var html = '<div style="margin-bottom:12px;padding:10px 14px;border:2px solid var(--accent);background:var(--surface);font-size:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<span>Showing <strong>' + items.length + '</strong> lead' + (items.length===1?'':'s') + ' where ' +
    (leadFilter.type === 'source' ? 'source' : 'stage') + ' = <strong>' + esc(leadFilter.value) + '</strong></span>' +
    '<a style="color:var(--accent);cursor:pointer;text-decoration:underline" onclick="clearLeadFilter()">Clear filter</a></div>';
  if (items.length === 0) html += '<div class="empty">No matching leads.</div>';
  else html += items.map(function(l){
    return '<div class="kcard" style="margin-bottom:8px;max-width:420px" onclick="openLeadForm(\'' + l.id + '\')">' +
      '<div class="biz">' + esc(l.business||l.name||'Untitled') + '</div>' +
      '<div class="meta">' + esc(l.industry||'') + (l.city?' — '+esc(l.city):'') + ' — ' + esc(l.stage) + (l.source?' — '+esc(l.source):'') + '</div></div>';
  }).join('');
  kb.innerHTML = html;
}

(function(){
  var _orig = window.renderLeads;
  window.renderLeads = function(){
    if (leadFilter) { renderFilteredLeads(); return; }
    _orig();
  };
})();

/* --- Help --- */
function showCommandHelp(){
  closeSearch();
  var html = '<div style="font-size:12px;line-height:1.9">' +
    '<p style="margin-bottom:12px">Type a special character in the search bar to switch to command mode. Or press <code>?</code> for this list.</p>' +
    '<table class="tbl" style="font-size:12px">' +
    '<thead><tr><th>Prefix</th><th>Action</th><th>Example</th></tr></thead><tbody>' +
    '<tr><td><code>+</code></td><td>Create new</td><td><code>+lead</code> &nbsp; <code>+invoice</code> &nbsp; <code>+deploy</code></td></tr>' +
    '<tr><td><code>-</code></td><td>Delete record</td><td><code>-lead</code> &nbsp; <code>-client</code></td></tr>' +
    '<tr><td><code>&gt;</code></td><td>Navigate</td><td><code>&gt;today</code> &nbsp; <code>&gt;deployments</code> &nbsp; <code>&gt;cf</code></td></tr>' +
    '<tr><td><code>/</code></td><td>Filter views</td><td><code>/stale</code> &nbsp; <code>/overdue</code></td></tr>' +
    '<tr><td><code>@</code></td><td>Filter by source</td><td><code>@maps</code> &nbsp; <code>@referral</code></td></tr>' +
    '<tr><td><code>#</code></td><td>Filter by stage</td><td><code>#contacted</code> &nbsp; <code>#proposal</code></td></tr>' +
    '</tbody></table>' +
    '<p style="margin-top:16px">Plain text searches across leads, clients, invoices, proposals.</p>' +
    '<p style="margin-top:8px">Tip: press <code>Enter</code> to run the first match. Press <code>Esc</code> to close. Press <code>Ctrl+K</code> or <code>/</code> to focus search.</p>' +
    '<p style="margin-top:16px"><strong>Need a tour?</strong> Click the <em>Help</em> button in the sidebar for section-by-section explanations.</p>' +
    '</div>';
  openModal('Command reference', html, '<button class="btn" onclick="closeModal();showHelp()">Open help</button><button class="btn btn-primary" onclick="closeModal()">Got it</button>');
}

function closeSearch(){
  var res = document.getElementById('searchResults');
  if (res) res.classList.remove('open');
  var inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
}

/* --- Command builder --- */
function buildCommandResults(raw){
  var first = raw.charAt(0);
  var rest = raw.slice(1).toLowerCase();
  var results = [];

  if (first === '+') {
    var adds = [
      {cmd:'+lead', label:'+ New lead', run:'openLeadForm()'},
      {cmd:'+client', label:'+ New client', run:'openClientForm()'},
      {cmd:'+invoice', label:'+ New invoice', run:'openInvoiceForm()'},
      {cmd:'+proposal', label:'+ New proposal', run:'openProposalForm()'},
      {cmd:'+demo', label:'+ New demo', run:'openDemoForm()'},
      {cmd:'+time', label:'+ Log time', run:'openTimeForm()'},
      {cmd:'+deploy', label:'+ Log deploy', run:'openDeployForm()'},
      {cmd:'+script', label:'+ New script', run:'addScript(); showView(\'scripts\')'}
    ];
    adds.forEach(function(a){
      if (!rest || a.cmd.indexOf('+'+rest) === 0 || a.label.toLowerCase().indexOf(rest) !== -1) results.push(a);
    });
  }

  if (first === '-') {
    var dels = [
      {cmd:'-lead', label:'- Delete a lead', run:'openDeletePicker(\'lead\')'},
      {cmd:'-client', label:'- Delete a client', run:'openDeletePicker(\'client\')'},
      {cmd:'-invoice', label:'- Delete an invoice', run:'openDeletePicker(\'invoice\')'},
      {cmd:'-proposal', label:'- Delete a proposal', run:'openDeletePicker(\'proposal\')'},
      {cmd:'-demo', label:'- Delete a demo', run:'openDeletePicker(\'demo\')'},
      {cmd:'-time', label:'- Delete a time entry', run:'openDeletePicker(\'time\')'},
      {cmd:'-deploy', label:'- Delete a deploy log', run:'openDeletePicker(\'deploy\')'}
    ];
    dels.forEach(function(d){
      if (!rest || d.cmd.indexOf('-'+rest) === 0 || d.label.toLowerCase().indexOf(rest) !== -1) results.push(d);
    });
  }

  if (first === '>') {
    var navs = [
      {cmd:'>today', label:'Go to Today', run:"showView('today')"},
      {cmd:'>dashboard', label:'Go to Dashboard', run:"showView('dashboard')"},
      {cmd:'>leads', label:'Go to Leads', run:"showView('leads')"},
      {cmd:'>clients', label:'Go to Clients', run:"showView('clients')"},
      {cmd:'>proposals', label:'Go to Proposals', run:"showView('proposals')"},
      {cmd:'>invoices', label:'Go to Invoices', run:"showView('invoices')"},
      {cmd:'>demos', label:'Go to Demos', run:"showView('demos')"},
      {cmd:'>deployments', label:'Go to Deployments', run:"showView('deployments')"},
      {cmd:'>cf', label:'Go to Deployments', run:"showView('deployments')"},
      {cmd:'>time', label:'Go to Time', run:"showView('time')"},
      {cmd:'>scripts', label:'Go to Scripts', run:"showView('scripts')"},
      {cmd:'>playbook', label:'Go to Playbook', run:"showView('playbook')"},
      {cmd:'>settings', label:'Go to Settings', run:"showView('settings')"},
      {cmd:'>help', label:'Open Help', run:'showHelp()'}
    ];
    navs.forEach(function(n){
      if (!rest || n.cmd.indexOf('>'+rest) === 0 || n.label.toLowerCase().indexOf(rest) !== -1) results.push(n);
    });
  }

  if (first === '?') {
    results.push({cmd:'?', label:'Command reference', run:'showCommandHelp()'});
    results.push({cmd:'?help', label:'Section-by-section help', run:'showHelp()'});
  }

  if (first === '/') {
    var filters = [
      {cmd:'/stale', label:'Show stale leads', run:'showView(\'leads\')'},
      {cmd:'/due', label:'Show due items', run:'showView(\'today\')'},
      {cmd:'/overdue', label:'Show overdue invoices', run:'showView(\'invoices\')'},
      {cmd:'/retainer', label:'Show retainer clients', run:'showView(\'clients\')'},
      {cmd:'/staging', label:'Staging ready to promote', run:'showView(\'today\')'},
      {cmd:'/playbook', label:'Open playbook', run:'showView(\'playbook\')'}
    ];
    filters.forEach(function(f){
      if (!rest || f.cmd.indexOf('/'+rest) === 0 || f.label.toLowerCase().indexOf(rest) !== -1) results.push(f);
    });
  }

  if (first === '@') {
    var sources = ['Google Maps','Facebook','Walk-in','Referral','Cold email','LinkedIn','Other'];
    sources.forEach(function(s){
      if (!rest || s.toLowerCase().indexOf(rest) !== -1) {
        results.push({cmd:'@ ' + s.toLowerCase(), label:'Filter leads from ' + s, run:'filterLeadsBySource(\'' + s.replace(/'/g, "\\'") + '\')'});
      }
    });
  }

  if (first === '#') {
    STAGES.forEach(function(s){
      if (!rest || s.toLowerCase().indexOf(rest) !== -1) {
        results.push({cmd:'# ' + s.toLowerCase(), label:'Filter leads in stage ' + s, run:'filterLeadsByStage(\'' + s + '\')'});
      }
    });
  }

  return results;
}

/* --- The command doSearch (overrides app.js version) --- */
function doSearchCommand(q){
  var res = document.getElementById('searchResults');
  if (!res) return;
  var raw = (q || '').trim();
  if (!raw) { res.classList.remove('open'); return; }

  var first = raw.charAt(0);
  var isCommand = (first === '+' || first === '-' || first === '>' || first === '?' || first === '/' || first === '@' || first === '#');

  if (isCommand) {
    var cmds = buildCommandResults(raw);
    if (cmds.length) {
      res.innerHTML = cmds.map(function(c, i){
        return '<div class="sr-item' + (i===0?' active':'') + '" data-cmd-idx="' + i + '">' +
          '<div class="t">' + esc(c.label) + '</div>' +
          '<div class="m">' + esc(c.cmd) + '</div></div>';
      }).join('');
      res.querySelectorAll('[data-cmd-idx]').forEach(function(el){
        el.addEventListener('click', function(){
          var c = cmds[Number(el.dataset.cmdIdx)];
          if (c) { closeSearch(); try { eval(c.run); } catch(e){ if (window.console) console.error(e); } }
        });
      });
      res.classList.add('open');
      window._activeCmd = cmds;
      return;
    }
    res.classList.remove('open');
    window._activeCmd = null;
    return;
  }

  window._activeCmd = null;
  if (raw.length < 2) { res.classList.remove('open'); return; }
  var q2 = raw.toLowerCase();
  var hits = [];
  state.leads.forEach(function(l){
    var hay = ((l.business||'') + ' ' + (l.name||'') + ' ' + (l.industry||'') + ' ' + (l.city||'') + ' ' + (l.phone||'') + ' ' + (l.email||'')).toLowerCase();
    if (hay.indexOf(q2) !== -1) hits.push({type:'Lead', title:l.business||l.name, meta:l.stage, action:"showView('leads');setTimeout(function(){openLeadForm('" + l.id + "')},100)"});
  });
  state.clients.forEach(function(c){
    var hay = ((c.business||'') + ' ' + (c.name||'') + ' ' + (c.industry||'') + ' ' + (c.phone||'') + ' ' + (c.email||'') + ' ' + (c.cloudflareProject||'')).toLowerCase();
    if (hay.indexOf(q2) !== -1) hits.push({type:'Client', title:c.business||c.name, meta:c.stage, action:"showView('clients');setTimeout(function(){openClientForm('" + c.id + "')},100)"});
  });
  state.invoices.forEach(function(i){
    var hay = ((i.clientName||'') + ' ' + (i.payoneerRef||'') + ' ' + (i.notes||'')).toLowerCase();
    if (hay.indexOf(q2) !== -1) hits.push({type:'Invoice', title:(i.clientName||'') + ' ' + fmt$(i.amount), meta:i.status, action:"showView('invoices')"});
  });
  state.proposals.forEach(function(p){
    var hay = ((p.business||'') + ' ' + (p.clientName||'')).toLowerCase();
    if (hay.indexOf(q2) !== -1) hits.push({type:'Proposal', title:p.business||p.clientName, meta:fmt$(p.amount)+' — '+p.status, action:"showView('proposals')"});
  });
  if (hits.length === 0) {
    res.innerHTML = '<div class="sr-item"><div class="m">No results — try + or ? for commands</div></div>';
  } else {
    res.innerHTML = hits.slice(0,12).map(function(h){
      return '<div class="sr-item" onclick="' + h.action + ';document.getElementById(\'searchResults\').classList.remove(\'open\');document.getElementById(\'searchInput\').value=\'\'">' +
        '<div class="t">[' + h.type + '] ' + esc(h.title) + '</div>' +
        '<div class="m">' + esc(h.meta||'') + '</div></div>';
    }).join('');
  }
  res.classList.add('open');
}

window.doSearch = doSearchCommand;

document.addEventListener('keydown', function(e){
  if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'searchInput') {
    if (window._activeCmd && window._activeCmd.length) {
      e.preventDefault();
      var c = window._activeCmd[0];
      closeSearch();
      try { eval(c.run); } catch(err){ if (window.console) console.error(err); }
    }
  }
});

(function(){
  var inp = document.getElementById('searchInput');
  if (inp) inp.placeholder = 'Search · + add · - delete · > go · / filter · @ source · # stage · ? help';
})();

/* --- Expose --- */
window.openDeletePicker = openDeletePicker;
window.dpFilter = dpFilter;
window.dpPick = dpPick;
window.showCommandHelp = showCommandHelp;
window.filterLeadsBySource = filterLeadsBySource;
window.filterLeadsByStage = filterLeadsByStage;
window.clearLeadFilter = clearLeadFilter;
window.closeSearch = closeSearch;
window.doSearchCommand = doSearchCommand;
