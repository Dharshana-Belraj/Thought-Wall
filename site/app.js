// app.js — extracted from verse.html and adapted for external config.js

const SUPABASE_URL = (window.__ENV && window.__ENV.SUPABASE_URL) || '';
const SUPABASE_KEY = (window.__ENV && window.__ENV.SUPABASE_KEY) || '';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let db;
const STORE = 'poems';

async function dbGetAll() {
  try {
    const { data, error } = await supabaseClient
      .from('poems')
      .select('id,title,body,mood,collection,form,favourite,created_at,updated_at');
    if (error) {
      console.error('dbGetAll error', JSON.stringify(error, null, 2));
      return [];
    }
    return (data || []).map(r => ({
      id: r.id,
      title: r.title,
      body: r.body,
      mood: r.mood,
      collection: r.collection,
      form: r.form,
      favourite: r.favourite,
      createdAt: r.created_at ? (typeof r.created_at === 'string' ? Date.parse(r.created_at) : r.created_at) : Date.now(),
      updatedAt: r.updated_at ? (typeof r.updated_at === 'string' ? Date.parse(r.updated_at) : r.updated_at) : Date.now(),
    }));
  } catch (err) {
    console.error('dbGetAll unexpected error', err && err.message ? err.message : err);
    return [];
  }
}

async function dbPut(poem) {
  try {
    const payload = { ...poem };
    if (payload.createdAt) payload.created_at = new Date(payload.createdAt).toISOString();
    if (payload.updatedAt) payload.updated_at = new Date(payload.updatedAt).toISOString();
    delete payload.createdAt; delete payload.updatedAt;

    let res;
    if (payload.id) {
      res = await supabaseClient.from('poems').upsert([payload], { returning: 'representation' });
    } else {
      res = await supabaseClient.from('poems').insert([payload], { returning: 'representation' });
    }

    const { data, error } = res;
    if (error) {
      console.error('dbPut error', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  } catch (err) {
    console.error('dbPut unexpected error', err && err.message ? err.message : err);
    throw err;
  }
}

async function dbDelete(id) {
  try {
    const { data, error } = await supabaseClient
      .from('poems')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('dbDelete error', JSON.stringify(error, null, 2));
      throw error;
    }
    return data;
  } catch (err) {
    console.error('dbDelete unexpected error', err && err.message ? err.message : err);
    throw err;
  }
}

// state
let poems = [];
let currentView = 'all';
let currentLayout = 'grid';
let searchQuery = '';
let editingId = null;
let viewingPoem = null;

const moodColors = {
  melancholy: { bar: '#9b7fa6', tag: 'tag-purple' },
  peaceful:   { bar: '#5a9e8a', tag: 'tag-teal' },
  longing:    { bar: '#c47060', tag: 'tag-coral' },
  wonder:     { bar: '#6a8faf', tag: 'tag-blue' },
  nostalgia:  { bar: '#c9a84c', tag: 'tag-amber' },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function isUuid(s) { return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
function formatDate(ts) { const d = new Date(ts); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(window._toastTimer); window._toastTimer = setTimeout(() => t.classList.add('hidden'), 2400); }
function wordCount(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }
function lineCount(text) { return text.trim() ? text.split('\n').filter(l => l.trim()).length : 0; }
function getPreview(text) { const lines = text.split('\n').filter(l => l.trim()).slice(0, 2); return lines.join('\n') + (lines.length < text.split('\n').filter(l => l.trim()).length ? '...' : ''); }

function getFilteredPoems() {
  let list = [...poems];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.body.toLowerCase().includes(q) ||
      (p.collection || '').toLowerCase().includes(q)
    );
  }
  if (currentView === 'favourites') list = list.filter(p => p.favourite);
  if (currentView.startsWith('mood-')) { const mood = currentView.replace('mood-', ''); list = list.filter(p => p.mood === mood); }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}
function getCollections() { const map = {}; poems.forEach(p => { if (p.collection) { map[p.collection] = (map[p.collection] || 0) + 1; } }); return map; }
function getPinnedPoem() { const favs = poems.filter(p => p.favourite).sort((a,b) => b.updatedAt - a.updatedAt); if (favs.length) return favs[0]; return poems.sort((a,b) => b.updatedAt - a.updatedAt)[0] || null; }

function render() {
  const filtered = getFilteredPoems();
  const content = document.getElementById('main-content');
  const viewTitles = { all: 'All poems', favourites: 'Favourites', collections: 'Collections', 'mood-melancholy': 'Melancholy', 'mood-peaceful': 'Peaceful', 'mood-longing': 'Longing', 'mood-wonder': 'Wonder', 'mood-nostalgia': 'Nostalgia', };
  document.getElementById('topbar-title').textContent = viewTitles[currentView] || 'All poems';
  if (currentView === 'collections') { renderCollections(content); return; }
  const countLabel = `${filtered.length} poem${filtered.length !== 1 ? 's' : ''}`;
  document.getElementById('topbar-count').textContent = countLabel;
  const totalPoems = poems.length;
  const totalLines = poems.reduce((s, p) => s + lineCount(p.body), 0);
  const colCount = Object.keys(getCollections()).length;
  let html = '';
  if (currentView === 'all' && !searchQuery) {
    html += `<div class="stats-row">\n      <div class="stat-card"><div class="stat-num">${totalPoems}</div><div class="stat-lbl">poems</div></div>\n      <div class="stat-card"><div class="stat-num">${colCount}</div><div class="stat-lbl">collections</div></div>\n      <div class="stat-card"><div class="stat-num">${totalLines}</div><div class="stat-lbl">lines</div></div>\n      <div class="stat-card"><div class="stat-num">${poems.filter(p=>p.favourite).length}</div><div class="stat-lbl">favourites</div></div>\n    </div>`;
    const daily = getDailyPoem();
    if (daily) { const preview = getPreview(daily.body); html += `<div class="daily-banner" onclick="openView('${daily.id}')">\n        <div class="daily-icon">✦</div>\n        <div class="daily-text">\n          <p>From your archive</p>\n          <p>${daily.title || 'Untitled'} — ${preview.split('\n')[0]}</p>\n        </div>\n      </div>`; }
    const pinned = getPinnedPoem();
    if (pinned) { const previewLines = pinned.body.split('\n').filter(l => l.trim()).slice(0, 3).join('\n'); html += `<div class="featured" onclick="openView('${pinned.id}')" style="cursor:pointer">\n        <div class="feat-label">${pinned.favourite ? '★ Favourite' : 'Most recent'}</div>\n        <div class="feat-title">${escHtml(pinned.title || 'Untitled')}</div>\n        <div class="feat-lines">${escHtml(previewLines)}</div>\n      </div>`; }
  }
  const gridClass = currentLayout === 'list' ? 'poem-grid list-view' : 'poem-grid';
  html += `<div class="${gridClass}" id="poem-grid">`;
  if (filtered.length === 0) {
    html += `<div class="empty-state">\n      <div class="empty-icon">"</div>\n      <p>No poems here yet.<br>Write your first verse.</p>\n    </div>`;
  } else {
    filtered.forEach((p, i) => { html += renderCard(p, i); });
  }
  if (currentView === 'all' && !searchQuery) {
    html += `<div class="new-poem-card" onclick="openEditor()">\n      <div class="plus">+</div>\n      <span>New poem</span>\n    </div>`;
  }
  html += `</div>`;
  content.innerHTML = html;
}

function renderCard(p, i) {
  const mood = p.mood ? moodColors[p.mood] : null;
  const barColor = mood ? mood.bar : 'transparent';
  const tagClass = mood ? mood.tag : 'tag-none';
  const moodLabel = p.mood ? (p.mood.charAt(0).toUpperCase() + p.mood.slice(1)) : '';
  const preview = getPreview(p.body);
  const favIcon = p.favourite ? '★' : '☆';
  const favClass = p.favourite ? 'card-fav is-fav' : 'card-fav';
  const delay = Math.min(i * 0.04, 0.3);
  return `<div class="poem-card" onclick="openView('${p.id}')" style="animation-delay:${delay}s">\n    <div class="card-accent" style="background:${barColor}"></div>\n    <div class="card-title">${escHtml(p.title || 'Untitled')}</div>\n    <div class="poem-preview">${escHtml(preview)}</div>\n    <div class="card-footer">\n      <span class="card-date">${formatDate(p.createdAt)}</span>\n      <div style="display:flex;align-items:center;gap:6px">\n        ${moodLabel ? `<span class="card-tag ${tagClass}">${moodLabel}</span>` : ''}\n        <span class="${favClass}" onclick="event.stopPropagation();toggleFav('${p.id}')">${favIcon}</span>\n      </div>\n    </div>\n  </div>`;
}

function renderCollections(content) {
  const cols = getCollections();
  const keys = Object.keys(cols);
  document.getElementById('topbar-count').textContent = `${keys.length} collection${keys.length !== 1 ? 's' : ''}`;
  let html = `<div class="poem-grid">`;
  if (keys.length === 0) {
    html += `<div class="empty-state" style="grid-column:1/-1">\n      <div class="empty-icon">"</div>\n      <p>No collections yet.<br>Add a collection name when writing a poem.</p>\n    </div>`;
  } else {
    keys.forEach(name => { html += `<div class="poem-card" onclick="setViewCollection('${escAttr(name)}')" style="min-height:100px;display:flex;flex-direction:column;justify-content:center">\n        <div class="card-accent" style="background:var(--accent)"></div>\n        <div class="card-title" style="margin-top:10px">${escHtml(name)}</div>\n        <div class="card-footer"><span class="card-date">${cols[name]} poem${cols[name] !== 1 ? 's' : ''}</span></div>\n      </div>`; });
  }
  html += `</div>`;
  content.innerHTML = html;
}

function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return (s || '').replace(/'/g, "\\'"); }

function setView(view, el) { currentView = view; searchQuery = ''; document.getElementById('search-input').value = ''; document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); if (el) el.classList.add('active'); render(); }
function setViewCollection(name) { currentView = 'collection:' + name; document.getElementById('topbar-title').textContent = name; const filtered = poems.filter(p => p.collection === name).sort((a,b) => b.createdAt - a.createdAt); document.getElementById('topbar-count').textContent = `${filtered.length} poem${filtered.length !== 1 ? 's' : ''}`; const gridClass = currentLayout === 'list' ? 'poem-grid list-view' : 'poem-grid'; let html = `<div class="${gridClass}">`; filtered.forEach((p,i) => { html += renderCard(p, i); }); html += `</div>`; document.getElementById('main-content').innerHTML = html; }
function toggleLayout(mode) { currentLayout = mode; document.getElementById('grid-btn').classList.toggle('active', mode === 'grid'); document.getElementById('list-btn').classList.toggle('active', mode === 'list'); render(); }
function onSearch(q) { searchQuery = q; render(); }

function openEditor(id) {
  editingId = id || null;
  const modal = document.getElementById('editor-overlay');
  modal.classList.remove('hidden');
  document.getElementById('delete-btn').classList.toggle('hidden', !editingId);
  document.getElementById('editor-mode-label').textContent = editingId ? 'Edit poem' : 'New poem';
  const editorModal = document.querySelector('.editor-modal');
  if (editorModal) {
    if (!editingId) editorModal.classList.add('fullscreen'); else editorModal.classList.remove('fullscreen');
  }
  // prevent background scrolling on fullscreen editor
  if (document.querySelector('.editor-modal.fullscreen')) document.body.classList.add('no-scroll');
  // close mobile sidebar if open
  if (document.body.classList.contains('mobile-sidebar-open')) toggleMobileMenu(false);
  if (editingId) {
    const p = poems.find(x => x.id === editingId);
    document.getElementById('poem-title-input').value = p.title || '';
    document.getElementById('poem-body-input').value = p.body || '';
    document.getElementById('poem-mood-input').value = p.mood || '';
    document.getElementById('poem-collection-input').value = p.collection || '';
    document.getElementById('poem-form-input').value = p.form || '';
  } else {
    document.getElementById('poem-title-input').value = '';
    document.getElementById('poem-body-input').value = '';
    document.getElementById('poem-mood-input').value = '';
    document.getElementById('poem-collection-input').value = '';
    document.getElementById('poem-form-input').value = '';
  }
  updatePoemStats();
  setTimeout(() => document.getElementById('poem-title-input').focus(), 100);
}

function closeEditor() {
  document.getElementById('editor-overlay').classList.add('hidden');
  editingId = null;
  const editorModal = document.querySelector('.editor-modal');
  if (editorModal) editorModal.classList.remove('fullscreen');
  document.body.classList.remove('no-scroll');
}
function updatePoemStats() { const body = document.getElementById('poem-body-input').value; const wc = wordCount(body); const lc = lineCount(body); document.getElementById('poem-stats-bar').innerHTML = `<span>${wc} word${wc !== 1 ? 's' : ''}</span><span>${lc} line${lc !== 1 ? 's' : ''}</span>`; }

async function savePoem() {
  const title = document.getElementById('poem-title-input').value.trim();
  const body = document.getElementById('poem-body-input').value.trim();
  const mood = document.getElementById('poem-mood-input').value;
  const collection = document.getElementById('poem-collection-input').value.trim();
  const form = document.getElementById('poem-form-input').value;
  if (!body) { showToast('Please write something first.'); return; }
  const now = Date.now();
  let poem;
  if (editingId) {
    const existing = poems.find(p => p.id === editingId) || {};
    poem = { ...existing, title, body, mood, collection, form, updatedAt: now };
    if (!isUuid(editingId)) delete poem.id;
  } else {
    poem = { title, body, mood, collection, form, favourite: false, createdAt: now, updatedAt: now };
  }
  await dbPut(poem);
  poems = await dbGetAll();
  closeEditor();
  render();
  showToast(editingId ? 'Poem updated.' : 'Poem saved ✦');
}

async function deletePoem() {
  if (!editingId) return;
  if (!confirm('Delete this poem? This cannot be undone.')) return;
  if (isUuid(editingId)) { await dbDelete(editingId); } else { poems = poems.filter(p => p.id !== editingId); }
  poems = await dbGetAll();
  closeEditor();
  closeView();
  render();
  showToast('Poem deleted.');
}

function openView(id) {
  const p = poems.find(x => x.id === id);
  if (!p) return;
  viewingPoem = p;
  document.getElementById('view-title').textContent = p.title || 'Untitled';
  document.getElementById('view-body').textContent = p.body;
  document.getElementById('view-date').textContent = formatDate(p.createdAt);
  const moodEl = document.getElementById('view-mood'); if (p.mood) { moodEl.textContent = p.mood.charAt(0).toUpperCase() + p.mood.slice(1); moodEl.style.display = ''; } else moodEl.style.display = 'none';
  const formEl = document.getElementById('view-form'); if (p.form) { formEl.textContent = p.form; formEl.style.display = ''; } else formEl.style.display = 'none';
  const colEl = document.getElementById('view-collection'); if (p.collection) { colEl.textContent = p.collection; colEl.style.display = ''; } else colEl.style.display = 'none';
  document.getElementById('fav-view-btn').textContent = p.favourite ? '★' : '☆';
  document.getElementById('view-overlay').classList.remove('hidden');
}

function closeView() { document.getElementById('view-overlay').classList.add('hidden'); viewingPoem = null; }

function toggleMobileMenu(force) {
  const shouldOpen = typeof force === 'boolean' ? force : !document.body.classList.contains('mobile-sidebar-open');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  if (!sidebar) return;
  if (shouldOpen) {
    document.body.classList.add('mobile-sidebar-open');
    sidebar.classList.add('mobile-open');
    // force a reflow then show for transition
    setTimeout(() => sidebar.classList.add('show'), 10);
    if (backdrop) backdrop.classList.add('show');
  } else {
    document.body.classList.remove('mobile-sidebar-open');
    sidebar.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    setTimeout(() => sidebar.classList.remove('mobile-open'), 260);
  }
}

async function toggleFavFromView() { if (!viewingPoem) return; await toggleFav(viewingPoem.id); viewingPoem = poems.find(p => p.id === viewingPoem.id); document.getElementById('fav-view-btn').textContent = viewingPoem.favourite ? '★' : '☆'; }
function editFromView() { const id = viewingPoem ? viewingPoem.id : null; closeView(); if (id) openEditor(id); }

async function toggleFav(id) { const p = poems.find(x => x.id === id); if (!p) return; p.favourite = !p.favourite; p.updatedAt = Date.now(); await dbPut(p); poems = await dbGetAll(); render(); showToast(p.favourite ? '★ Added to favourites' : 'Removed from favourites'); }

function getDailyPoem() { if (poems.length < 2) return null; const old = poems.filter(p => Date.now() - p.createdAt > 7 * 24 * 3600 * 1000); if (!old.length) return null; const today = new Date(); const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate(); return old[seed % old.length]; }
function overlayClickClose(e, id) { if (e.target.id === id) { if (id === 'editor-overlay') closeEditor(); if (id === 'view-overlay') closeView(); } }

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeEditor(); closeView(); } if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !document.getElementById('editor-overlay').classList.contains('hidden') === false) { e.preventDefault(); openEditor(); } if ((e.metaKey || e.ctrlKey) && e.key === 's') { if (!document.getElementById('editor-overlay').classList.contains('hidden')) { e.preventDefault(); savePoem(); } } });

async function seedIfEmpty() { if (poems.length > 0) return; const now = Date.now(); const seeds = [ { title: 'The space between', body: 'In the gap where silence grows\nbetween your name and the door closing —\nI have built entire cities.\n\nStreet lamps that hum your absence,\npavements that memorise the weight\nof what was almost said.', mood: 'melancholy', collection: 'Distance', form: '', favourite: true, createdAt: now - 10*86400000, updatedAt: now - 10*86400000 }, { title: 'Salt and distance', body: 'The sea does not apologize\nfor swallowing the light.\nNeither do I\nfor wanting you whole.', mood: 'longing', collection: 'Distance', form: 'free verse', favourite: false, createdAt: now - 7*86400000, updatedAt: now - 7*86400000 }, { title: 'Morning ritual', body: 'Tea cools in the blue cup.\nSteam curls toward the window\nlike a thought that forgets itself\nbefore it arrives.\n\nSomewhere, a crow\ndecides the sky is enough.', mood: 'peaceful', collection: 'Mornings', form: '', favourite: false, createdAt: now - 5*86400000, updatedAt: now - 5*86400000 }, { title: 'Cartography', body: 'I mapped your silences\nthe way glaciers map stone —\nslowly, without asking permission,\nleaving only the shape of pressure behind.', mood: 'wonder', collection: '', form: '', favourite: false, createdAt: now - 3*86400000, updatedAt: now - 3*86400000 }, ]; for (const p of seeds) await dbPut(p); poems = await dbGetAll(); }

async function testSupabase() { try { const now = Date.now(); const testPoem = { title: 'Supabase test ' + new Date(now).toISOString(), body: 'This is a test poem to verify Supabase storage.', mood: '', collection: 'test', form: '', favourite: false, createdAt: now, updatedAt: now }; await dbPut(testPoem); const all = await dbGetAll(); const tests = all.filter(p => p.id && p.id.startsWith('test-'));
    console.log('Supabase test inserted — total poems:', all.length, 'test rows:', tests);
    showToast(tests.length ? 'Supabase test OK — check console or Supabase table.' : 'Supabase test: no test rows found (check console).');
  } catch (err) { console.error('Supabase test failed', err && err.message ? err.message : err); showToast('Supabase test failed — see console.'); } }

(async () => { poems = await dbGetAll(); if (poems.length === 0) { await seedIfEmpty(); poems = await dbGetAll(); } render(); })();
