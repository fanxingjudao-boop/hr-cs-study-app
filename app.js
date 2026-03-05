// ─── STATE ───────────────────────────────────────────────
let allQuestions = [];
let fuse         = null;
let currentCat   = 'all';
let currentQuery = '';
let answered     = {};   // { id: chosenIndex }

const CAT_LABELS = { recruiting: '採用管理', evaluation: '人事評価', labor: '労務管理' };
const DATA_FILES  = ['data/recruiting.json', 'data/evaluation.json', 'data/labor.json'];

// ─── INIT ────────────────────────────────────────────────
async function init() {
  try {
    const results = await Promise.all(DATA_FILES.map(f => fetch(f).then(r => r.json())));
    allQuestions = results.flat();

    document.getElementById('headerBadge').textContent = `全 ${allQuestions.length} 問`;

    fuse = new Fuse(allQuestions, {
      keys: [
        { name: 'question',    weight: 0.40 },
        { name: 'explanation', weight: 0.25 },
        { name: 'tags',        weight: 0.25 },
        { name: 'choices',     weight: 0.10 }
      ],
      threshold: 0.35,
      includeMatches: true,
      minMatchCharLength: 1
    });

    render();
  } catch (e) {
    document.getElementById('cardGrid').innerHTML = `
      <div class="empty-state">
        <span class="emoji">⚠️</span>
        <p><strong>JSONファイルが見つかりません</strong><br>
        <code>/data/</code> フォルダに3つのJSONを配置してください</p>
      </div>`;
  }
}

// ─── SEARCH ──────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('input', e => {
  currentQuery = e.target.value.trim();
  const btn = document.getElementById('clearBtn');
  btn.classList.toggle('visible', currentQuery.length > 0);
  render();
});

function clearSearch() {
  document.getElementById('searchInput').value = '';
  currentQuery = '';
  document.getElementById('clearBtn').classList.remove('visible');
  render();
}

function setCategory(el, cat) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentCat = cat;
  render();
}

// ─── RENDER ──────────────────────────────────────────────
function render() {
  let items;

  if (currentQuery && fuse) {
    items = fuse.search(currentQuery);
  } else {
    items = allQuestions.map(q => ({ item: q, matches: [] }));
  }

  if (currentCat !== 'all') {
    items = items.filter(r => r.item.category === currentCat);
  }

  const sortVal = document.getElementById('sortSelect').value;
  if (sortVal === 'category') {
    const order = { recruiting: 0, evaluation: 1, labor: 2 };
    items.sort((a, b) => (order[a.item.category] || 0) - (order[b.item.category] || 0));
  }

  const total = currentCat === 'all'
    ? allQuestions.length
    : allQuestions.filter(q => q.category === currentCat).length;

  const countEl = document.getElementById('resultsCount');
  if (currentQuery) {
    countEl.innerHTML = `検索結果 <strong>${items.length}</strong> 件 / ${total} 問中`;
  } else {
    countEl.innerHTML = `<strong>${items.length}</strong> 問 表示中`;
  }

  const grid = document.getElementById('cardGrid');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="emoji">🔍</span>
        <p>「${esc(currentQuery)}」に一致する問題は見つかりませんでした</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(({ item, matches }) => buildCard(item, matches)).join('');
}

// ─── CARD ────────────────────────────────────────────────
function buildCard(q, matches) {
  const qHL = hlText(q.question, matches, 'question');
  const tags = q.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');

  const choices = q.choices.map((c, i) => {
    const cHL = hlText(c, matches, 'choices');
    return `<div class="choice" data-idx="${i}"
                 onclick="onChoose(event,'${q.id}',${i},'${q.answer}')">${cHL}</div>`;
  }).join('');

  const exp = q.explanation
    ? `<div class="explanation" id="exp-${q.id}">
         <div class="explanation-label">💡 解説</div>
         ${esc(q.explanation)}
         <br>
         <a class="source-link" href="${esc(q.source_url)}" target="_blank" rel="noopener noreferrer">
           📎 ${esc(q.source)}
         </a>
       </div>` : '';

  return `
<div class="card" id="card-${q.id}" onclick="toggleCard('${q.id}')">
  <div class="card-top">
    <span class="cat-badge cat-${q.category}">${CAT_LABELS[q.category] || q.category}</span>
    <span class="card-question">${qHL}</span>
    <span class="chevron">▼</span>
  </div>
  <div class="card-body" onclick="event.stopPropagation()">
    <div class="choices-list">${choices}</div>
    ${exp}
    <div class="tags">${tags}</div>
  </div>
</div>`;
}

// ─── INTERACTIONS ────────────────────────────────────────
function toggleCard(id) {
  document.getElementById(`card-${id}`).classList.toggle('expanded');
}

function onChoose(e, id, idx, correctLetter) {
  e.stopPropagation();
  if (answered[id] !== undefined) return;
  answered[id] = idx;

  const correctIdx = correctLetter.charCodeAt(0) - 65;
  const card = document.getElementById(`card-${id}`);
  card.querySelectorAll('.choice').forEach((el, i) => {
    el.classList.add('answered');
    if (i === correctIdx)                el.classList.add('correct');
    else if (i === idx && idx !== correctIdx) el.classList.add('wrong');
    else                                  el.classList.add('dimmed');
  });

  const expEl = document.getElementById(`exp-${id}`);
  if (expEl) expEl.classList.add('show');
}

// ─── HIGHLIGHT ───────────────────────────────────────────
function hlText(text, matches, key) {
  if (!matches || !matches.length) return esc(text);
  const m = matches.find(m => m.key === key);
  if (!m || !m.indices || !m.indices.length) return esc(text);

  let out = '', last = 0;
  const sorted = [...m.indices].sort((a, b) => a[0] - b[0]);
  for (const [s, e] of sorted) {
    out += esc(text.slice(last, s));
    out += `<mark class="hl">${esc(text.slice(s, e + 1))}</mark>`;
    last = e + 1;
  }
  return out + esc(text.slice(last));
}

function esc(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── BOOT ────────────────────────────────────────────────
init();
