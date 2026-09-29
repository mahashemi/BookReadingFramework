/* BookReadingFramework learning hub.
   Renders three views from the repository's own data files:
   - library (site root)        - book-02/index.html
   - unit page                  - book-02/unit.html?unit=uNN
   Nothing here is hardcoded about the book's content: unit titles, counts,
   concepts, glossary and questions all come from the JSON in Library/. */
(() => {
  'use strict';

  const app = document.getElementById('app');
  const inBook = location.pathname.includes('/book-02/');
  const SITE = inBook ? '../' : '';
  const BOOK_DIR = 'Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams/';
  const BOOK1_DIR = 'Library/Book%2001%20-%20Polarization%20Around%20_Ali/';
  const LIB = SITE + BOOK_DIR;
  const REPO = 'https://github.com/mahashemi/BookReadingFramework/blob/main/';
  const bookPage = (p = '') => (inBook ? './' : 'book-02/') + p;
  const unitHref = (id, hash = '') => bookPage('unit.html?unit=' + encodeURIComponent(id)) + hash;

  /* ---------- small helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const pad = n => String(n).padStart(2, '0');
  const fmt = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));
  const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

  // "Chapter 2: Imam al-Hassan's Pacifism (Session 1)" -> {label:"Chapter 2 · Session 1", name:"Imam al-Hassan's Pacifism"}
  const parts = title => {
    const session = title.match(/\((Session \d+)\)/);
    const [head, ...rest] = title.replace(/\s*\(Session \d+\)/, '').split(':');
    const name = rest.join(':').trim() || head.trim();
    return { label: session ? head.trim() + ' · ' + session[1] : head.trim(), name };
  };

  const getJSON = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
    return r.json();
  };
  const optional = p => p.then(x => x, () => null);

  const stat = (value, label) => `<div class="stat"><strong>${esc(value)}</strong><small>${esc(label)}</small></div>`;
  const totals = (study, qd) => ({
    units: study.units.length,
    concepts: sum(study.units, u => u.concepts.length),
    chunks: new Set(study.units.flatMap(u => u.concepts.map(c => c.source_chunk_id))).size,
    questions: qd ? qd.questions.length : null,
    cross: qd ? qd.questions.filter(q => Array.isArray(q.unit_ids)).length : null,
  });
  const statRow = t => `<div class="stats">${stat(t.units, 'Learning units')}${stat(t.concepts, 'Concepts')}${stat(fmt(t.questions), 'Questions')}${stat(t.chunks, 'Source chunks')}</div>`;
  const unitQuestions = (qd, id) => (qd ? qd.questions.filter(q => q.unit_id === id) : null);
  const breakdown = list => ['MCQ', 'FILL', 'SHORT', 'LONG'].map(t => t + ' ' + list.filter(q => q.type === t).length).join(' · ');
  const card = (num, title, text, href, cta, external) =>
    `<a class="card unit" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="num">${esc(num)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="more">${esc(cta)}</span></a>`;
  const head = (id, h, p) => `<div class="section-head"><div><h2>${esc(h)}</h2>${p ? `<p>${esc(p)}</p>` : ''}</div></div>`;

  /* ---------- library (site root) ---------- */
  function library(study, qd) {
    const t = totals(study, qd);
    app.innerHTML = `
<section class="hero">
  <div class="eyebrow">A scholarly digital learning library</div>
  <h1>BookReadingFramework</h1>
  <p>A reusable framework for turning serious reading into structured understanding, active recall, teaching, and assessment — every idea traceable to the passage it came from.</p>
</section>
<section class="section" id="books">
  ${head('books', 'Books', 'Each book has its own learning environment: units, source map, concepts, glossary, practice, assessments, and teaching materials.')}
  <div class="grid">
    <a class="card book-card" href="book-02/">
      <div class="eyebrow">Book 02 · Full learning hub</div>
      <h3>A Survey into the Lives of the Infallible Imams</h3>
      <p>Ayatullah Murtadha Mutahhari · translated by Zainab Muhammadi 'Araqi.</p>
      ${statRow(t)}
      <span class="btn primary">Enter Book 02 →</span>
    </a>
    <div class="card book-card">
      <div class="eyebrow">Book 01 · Original format</div>
      <h3>Polarization Around the Character of 'Ali ibn Abi Talib</h3>
      <p>Ayatullah Murtadha Mutahhari. Interactive study guide and exam papers; being brought onto the same data-driven architecture as Book 02.</p>
      <div class="actions">
        <a class="btn" href="${BOOK1_DIR}study_guide/study_guide_attraction_polarization.html">Study guide</a>
        <a class="btn" href="${BOOK1_DIR}exam_bank/exam_papers_bank.html">26 practice papers</a>
        <a class="btn" href="${BOOK1_DIR}exam_bank/Polarization_Ali_MASTER_Exam_Workbook_34_Chapters_20_Simulated_Years.html">Master workbook</a>
      </div>
    </div>
  </div>
</section>
<section class="section" id="method">
  ${head('method', 'The method', 'Four stages, applied to every book. The full methodology is public.')}
  <div class="grid">
    ${card('1 · Read', 'Chunked, traceable source', 'The book is fetched and split into small source chunks; nothing downstream is allowed to drift from them.', REPO + 'Library/00_FRAMEWORK.md', 'Read the framework ↗', true)}
    ${card('2 · Understand', 'Concepts, claims, glossary', 'Each unit is distilled into concepts and claim → reasoning → evidence → lesson structures.', 'book-02/#concepts', 'See it in Book 02 →')}
    ${card('3 · Practice', 'One question bank, spaced review', 'A single source-of-truth bank powers unit tests, full-book exams, and a Day 1/3/7/16/35 review tracker.', 'book-02/#practice', 'Start practising →')}
    ${card('4 · Teach', 'Deck, guide and script', 'A Beamer deck, teaching guide, and lecture script let you deliver the book to others.', 'book-02/#teach', 'Open teaching materials →')}
  </div>
</section>`;
  }

  /* ---------- Book 02 home ---------- */
  function bookHome(study, qd, gl) {
    const t = totals(study, qd);
    const units = study.units;
    const glossary = gl ? gl.entries : [];

    const unitCards = units.map((u, i) => {
      const p = parts(u.title);
      const n = unitQuestions(qd, u.id);
      return `<a class="card unit" href="${unitHref(u.id)}"><div class="num">Unit ${pad(i + 1)}${p.label === p.name ? '' : ' · ' + esc(p.label)}</div><h3>${esc(p.name)}</h3><p>${u.concepts.length} concepts · ${u.claim_examples.length} claims${n ? ' · ' + n.length + ' questions' : ''}</p><span class="more">Open learning unit →</span></a>`;
    }).join('');

    const sourceRows = units.map((u, i) => {
      const p = parts(u.title);
      const chunks = new Set(u.concepts.map(c => c.source_chunk_id)).size;
      return `<div class="source-row"><div><div class="chapter">${esc(p.label)}${p.label === p.name ? '' : ' — ' + esc(p.name)}</div><div class="coverage">${chunks} source chunks · ${u.concepts.length} concepts</div></div><div class="pills"><a class="pill" href="${unitHref(u.id)}">Unit ${pad(i + 1)}</a><a class="pill" href="${esc(u.source_url)}" target="_blank" rel="noopener">Original on al-islam.org ↗</a></div></div>`;
    }).join('');

    const conceptRows = units.map((u, i) => {
      const p = parts(u.title);
      const pills = u.concepts.slice(0, 3).map(c => `<a class="pill" href="${unitHref(u.id, '#concepts')}">${esc(c.title)}</a>`).join('');
      return `<div class="source-row"><div><div class="chapter">Unit ${pad(i + 1)} · ${esc(p.label)}</div><div class="coverage">${u.concepts.length} source-linked concepts</div></div><div class="pills">${pills}<a class="pill" href="${unitHref(u.id, '#concepts')}">All concepts →</a></div></div>`;
    }).join('');

    const glossaryHTML = glossary.length ? `
<section class="section" id="glossary">
  ${head('glossary', 'Glossary — key terms & names', 'Every entry is verified against the source text; its unit links are computed from where it actually appears.')}
  <input class="search" id="gloss-q" type="search" placeholder="Search terms, e.g. taqiyyah, Siffin, wilayat…" aria-label="Search glossary">
  <p class="coverage" id="gloss-n" style="color:var(--muted);font-size:13px;margin:0 0 10px">${glossary.length} of ${glossary.length} shown</p>
  <div class="card term-list" id="gloss-list">${glossary.map(e => termRow(e, units)).join('')}</div>
</section>` : '';

    app.innerHTML = `
<div class="breadcrumb"><a href="../">Books</a> · Book 02</div>
<section class="hero" id="overview">
  <div class="eyebrow">Book 02 · Learning hub</div>
  <h1>A Survey into the Lives of the Infallible Imams</h1>
  <p>Ayatullah Murtadha Mutahhari, translated by Zainab Muhammadi 'Araqi. A structured environment that keeps the original text, concepts, questions, review and assessment connected.</p>
  ${statRow(t)}
  <div class="actions">
    <a class="btn primary" href="${LIB}study_guide/study.html">Open the study guide</a>
    <a class="btn" href="${unitHref(units[0].id)}">Start at Unit 01</a>
    <a class="btn" href="${LIB}teaching_materials/main.pdf">Teaching deck (PDF)</a>
  </div>
</section>
<section class="section" id="units">
  ${head('units', 'Learning units', 'A learning unit is an instructional division of the source — not necessarily identical to a chapter boundary.')}
  <div class="grid">${unitCards}</div>
</section>
<section class="section" id="source-map">
  ${head('source-map', 'Source map', 'Provenance both ways: from each learning unit to the original text, and from the original text to its unit.')}
  <div class="card source-tree">${sourceRows}</div>
</section>
<section class="section" id="concepts">
  ${head('concepts', 'Concepts', 'Every concept remains tied to the source chunk it came from.')}
  <div class="card source-tree">${conceptRows}</div>
</section>
${glossaryHTML}
<section class="section" id="mind-maps">
  ${head('mind-maps', 'Mind maps', 'Explore the book as a concept graph, or read it as a text outline.')}
  <div class="grid">
    ${card('Visual map', 'Interactive concept graph', 'Click through the structure of Book 02 and expand relationships between units and concepts.', LIB + 'mind_maps/book02_interactive.html', 'Open mind map →')}
    ${card('Reference', 'Static outline', "Text overview of the book's conceptual structure.", REPO + BOOK_DIR + 'mind_maps/book02_static_outline.md', 'Read outline ↗', true)}
  </div>
</section>
<section class="section" id="practice">
  ${head('practice', 'Practice', 'All practice draws on one question bank' + (t.questions ? ' of ' + fmt(t.questions) + ' questions' + (t.cross ? ' (including ' + t.cross + ' cross-unit synthesis questions)' : '') : '') + '.')}
  <div class="grid">
    ${card('Practice', 'Unit tests', 'A mixed test for each learning unit: multiple choice, fill-in, short and long answer.', LIB + 'exam_bank/unit_tests.html', 'Open unit tests →')}
    ${card('Study', 'Interactive study guide', 'Concepts, claims, hidden answers, self-marking, and a Day 1 → 3 → 7 → 16 → 35 spaced-review tracker.', LIB + 'study_guide/study.html', 'Open study guide →')}
  </div>
</section>
<section class="section" id="assessments">
  ${head('assessments', 'Assessments', 'Cumulative papers drawn from the same question bank.')}
  <div class="grid">
    ${card('Assessment', 'Full-book exam', 'Generate cumulative papers across the whole book.', LIB + 'exam_bank/full_book_exam_generator.html', 'Open exam generator →')}
    ${card('Assessment', 'Interleaved exam', 'A simulated exam interleaving all units, plus a hard worst-case paper.', LIB + 'exam_bank/interleaved_exam_generator.html', 'Open interleaved exams →')}
    ${card('Exam library', '20 simulated years', 'Twenty complete practice papers, printable.', LIB + 'exam_bank/MASTER_20_SIMULATED_YEARS.html', 'Open exam library →')}
  </div>
</section>
<section class="section" id="teach">
  ${head('teach', 'Teach this book', 'Materials for delivering Book 02 to others.')}
  <div class="grid">
    ${card('Slides', 'Teaching deck', 'Beamer deck with comparison tables, mind maps, speaker notes, and a chapter link in every footer.', LIB + 'teaching_materials/main.pdf', 'Open the PDF →')}
    ${card('Guide', 'Teaching guide', 'How the book is organised for teaching, block by block.', REPO + BOOK_DIR + 'teaching_materials/BOOK02_TEACHING_GUIDE.md', 'Read guide ↗', true)}
    ${card('Outline', 'Lecture outline', 'A timed whole-book lecture plan.', REPO + BOOK_DIR + 'teaching_materials/BOOK02_LECTURE_OUTLINE.md', 'Read outline ↗', true)}
    ${card('Script', 'Talk script', 'Speaker-ready explanations with exam bridges.', REPO + BOOK_DIR + 'teaching_materials/BOOK02_TALK_SCRIPT_AND_EXAM_QUESTIONS.md', 'Read script ↗', true)}
    ${card('Reference', 'Claim → evidence outline', 'Item-by-item claims with explanation, evidence, a question, and an answer guide.', REPO + BOOK_DIR + 'teaching_materials/book02_claim_example_outline.md', 'Read outline ↗', true)}
  </div>
</section>`;
    wireGlossary();
  }

  function termRow(e, units) {
    const pills = e.units.map(id => {
      const i = units.findIndex(u => u.id === id);
      return i < 0 ? '' : `<a class="pill" href="${unitHref(id)}">Unit ${pad(i + 1)}</a>`;
    }).join('');
    const text = (e.term + ' ' + e.gloss + ' ' + e.kind).toLowerCase();
    return `<div class="term" data-text="${esc(text)}"><div><span class="kind">${esc(e.kind)}</span><b>${esc(e.term)}</b></div><div><p>${esc(e.gloss)}</p><div class="pills">${pills}</div></div></div>`;
  }

  function wireGlossary() {
    const box = document.getElementById('gloss-q');
    if (!box) return;
    const rows = [...document.querySelectorAll('#gloss-list .term')];
    const out = document.getElementById('gloss-n');
    box.addEventListener('input', () => {
      const q = box.value.trim().toLowerCase();
      let n = 0;
      rows.forEach(r => { const hit = !q || r.dataset.text.includes(q); r.hidden = !hit; if (hit) n++; });
      out.textContent = n + ' of ' + rows.length + ' shown';
    });
  }

  /* ---------- unit page ---------- */
  function unitPage(study, qd, gl, chunkData, id) {
    const units = study.units;
    const i = units.findIndex(u => u.id === id);
    if (i < 0) { location.replace('./'); return; }
    const u = units[i];
    const p = parts(u.title);
    const prev = units[i - 1], next = units[i + 1];
    const chunkText = new Map((chunkData || []).map(c => [c.id, c.text]));
    const qs = unitQuestions(qd, u.id);
    const chunkCount = new Set(u.concepts.map(c => c.source_chunk_id)).size;
    const terms = gl ? gl.entries.filter(e => e.units.includes(u.id)) : [];
    const testHref = LIB + 'exam_bank/unit_tests.html?unit=' + encodeURIComponent(u.id);
    const nameOf = uid => { const k = units.findIndex(x => x.id === uid); return k < 0 ? uid : 'Unit ' + pad(k + 1) + ' · ' + parts(units[k].title).label; };

    document.title = (p.label === p.name ? p.name : p.label + ' — ' + p.name) + ' · Book 02 · BookReadingFramework';

    const claims = u.claim_examples.map(c => `
<details class="claim"><summary>${esc(c.claim)}</summary><div class="claim-body">
  <h4>Reasoning</h4><p>${esc(c.reasoning)}</p>
  <h4>Evidence</h4><p>${esc(c.evidence)}</p>
  <h4>Lesson</h4><p>${esc(c.lesson)}</p>
</div></details>`).join('');

    const concepts = u.concepts.map(c => {
      const src = chunkText.get(c.source_chunk_id);
      return `<article class="card unit"><div class="num">Concept</div><h3>${esc(c.title)}</h3><p>${esc(c.explanation)}</p>${src ? `<details class="passage"><summary>Source passage</summary><p>${esc(src)}</p></details>` : ''}<div class="pills"><span class="pill">${esc(c.source_chunk_id || 'source-linked')}</span></div></article>`;
    }).join('');

    const phrases = u.quotes.length ? `<section class="section"><div class="section-head compact"><div><h2>Key phrases</h2><p>Short phrases worth remembering verbatim. Consult the original page for full context.</p></div></div>${u.quotes.map(q => `<blockquote class="phrase">${esc(q.text)}</blockquote>`).join('')}</section>` : '';

    const termsHTML = terms.length ? `<section class="section"><div class="section-head compact"><div><h2>Key terms &amp; names in this unit</h2></div></div><div class="card term-list">${terms.map(e => termRow(e, units)).join('')}</div></section>` : '';

    const links = u.connections.length ? `<section class="section"><div class="section-head compact"><div><h2>Connections</h2><p>Where this unit's ideas reappear elsewhere in the book.</p></div></div><div class="grid">${u.connections.map(c => `<a class="card unit" href="${unitHref(c.to_unit_id)}"><div class="num">${esc(nameOf(c.to_unit_id))}</div><h3>${esc(c.label)}</h3><span class="more">Go to unit →</span></a>`).join('')}</div></section>` : '';

    app.innerHTML = `
<div class="breadcrumb"><a href="../">Books</a> · <a href="./">Book 02</a> · Unit ${pad(i + 1)}</div>
<section class="unit-hero">
  <div class="eyebrow">Learning unit ${pad(i + 1)} · ${esc(p.label)}</div>
  <h1>${esc(p.name)}</h1>
  <div class="meta-line">${u.concepts.length} concepts · ${chunkCount} source chunks${qs ? ' · ' + qs.length + ' questions' : ''}</div>
  <div class="actions">
    <a class="btn primary" href="${esc(u.source_url)}" target="_blank" rel="noopener">Read the original ↗</a>
    <a class="btn" href="${testHref}">Take unit test</a>
    <a class="btn" href="${LIB}mind_maps/book02_interactive.html">Mind map</a>
  </div>
</section>
<section class="section"><div class="card panel">
  <h2>Source coverage</h2>
  <div class="metadata-grid">
    <div><span>Source location</span><strong>${esc(p.label)}</strong></div>
    <div><span>Edition</span><strong>al-islam.org (online)</strong></div>
    <div><span>Source chunks</span><strong>${chunkCount}</strong></div>
    <div><span>Concepts</span><strong>${u.concepts.length}</strong></div>
    <div><span>Questions</span><strong>${qs ? qs.length : 'see question bank'}</strong></div>
    <div><span>Question mix</span><strong style="font-size:13px">${qs ? esc(breakdown(qs)) : '—'}</strong></div>
  </div>
</div></section>
<section class="section"><div class="section-head compact"><div><h2>How to study this unit</h2></div></div>
  <div class="path">
    <a class="step" href="${esc(u.source_url)}" target="_blank" rel="noopener"><b>1 · Read</b><span>the original passage</span></a>
    <a class="step" href="#concepts"><b>2 · Learn</b><span>the concepts</span></a>
    <a class="step" href="#claims"><b>3 · Explain</b><span>each claim aloud</span></a>
    <a class="step" href="${testHref}"><b>4 · Practise</b><span>the unit test</span></a>
    <a class="step" href="${LIB}study_guide/study.html"><b>5 · Review</b><span>on the spaced schedule</span></a>
  </div>
</section>
<section class="section" id="claims"><div class="section-head compact"><div><h2>Claims &amp; evidence</h2><p>The author's argument, one claim at a time: reasoning, evidence, and the lesson it teaches.</p></div></div>${claims}</section>
${phrases}
${termsHTML}
<section class="section" id="concepts"><div class="section-head compact"><div><h2>Concepts &amp; provenance</h2><p>Each concept stays tied to its source chunk${chunkData ? ' — open “Source passage” to read it' : ''}.</p></div></div><div class="grid">${concepts}</div></section>
${links}
<section class="section"><div class="card panel practice-panel">
  <div><div class="num">Practice</div><h2>Practise this unit</h2><p>Work through questions belonging to this learning unit, or use the full study guide with spaced review.</p></div>
  <div class="actions"><a class="btn primary" href="${testHref}">Take unit test</a><a class="btn" href="${LIB}study_guide/study.html">Study guide</a></div>
</div></section>
<nav class="unit-nav" aria-label="Unit navigation">
  <a ${prev ? `href="${unitHref(prev.id)}"` : 'aria-disabled="true"'}>← ${prev ? esc(parts(prev.title).label) : 'Previous unit'}</a>
  <a href="./#units">All learning units</a>
  <a ${next ? `href="${unitHref(next.id)}"` : 'aria-disabled="true"'}>${next ? esc(parts(next.title).label) : 'Next unit'} →</a>
</nav>`;
  }

  /* ---------- boot ---------- */
  async function main() {
    try {
      const unit = new URLSearchParams(location.search).get('unit');
      const [study, qd, gl] = await Promise.all([
        getJSON(LIB + 'data/study_book02.json'),
        optional(getJSON(LIB + 'exam_bank/questions.json')),
        optional(getJSON(LIB + 'data/glossary.json')),
      ]);
      if (unit) {
        const chunks = await optional(getJSON(LIB + 'data/chunks.json'));
        unitPage(study, qd, gl, chunks, unit);
      } else if (inBook) {
        bookHome(study, qd, gl);
      } else {
        library(study, qd);
      }
      app.setAttribute('aria-busy', 'false');
      if (location.hash) {
        const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (el) el.scrollIntoView();
      }
    } catch (e) {
      app.innerHTML = '<div class="empty"><b>The learning data could not be loaded.</b><br>' + esc(e.message) +
        '<br><br>If you opened this file directly from disk, serve the folder through a web server (for example <code>python -m http.server</code>) or use the GitHub Pages site.</div>';
    }
  }
  main();
})();
