/* Deep Reading learning hub.
   Two static shells, both fully data-driven so a new book needs zero new
   HTML/JS -- just one entry in assets/books.json:
   - /                : the library (this file's `library()`)
   - /book/?book_id=X : a book's hub and unit pages (`bookHome()`/`unitPage()`)
   Nothing here hardcodes a book's title, counts, or content. */
(() => {
  'use strict';

  const app = document.getElementById('app');
  const inBook = location.pathname.includes('/book/');
  const SITE = inBook ? '../' : '';
  const REPO = 'https://github.com/mahashemi/BookReadingFramework/blob/main/';
  const qs = new URLSearchParams(location.search);
  const bookId = qs.get('book_id') || 'book02';
  const dirEnc = dir => dir.split('/').map(encodeURIComponent).join('/');
  const bookPage = (id, p = '') => 'book/' + p + (p.includes('?') ? '&' : '?') + 'book_id=' + encodeURIComponent(id);
  const unitHref = (id, unit, hash = '') => (inBook ? './' : '') + 'unit.html?book_id=' + encodeURIComponent(id) + '&unit=' + encodeURIComponent(unit) + hash;

  /* ---------- small helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const linkedText = value => {
    const text = String(value ?? '');
    const pattern = /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
    let html = '', cursor = 0, match;
    while ((match = pattern.exec(text))) {
      html += esc(text.slice(cursor, match.index));
      html += '<a href="' + esc(match[2]) + '" target="_blank" rel="noopener">' + esc(match[1]) + '</a>';
      cursor = pattern.lastIndex;
    }
    return html + esc(text.slice(cursor));
  };
  /* Render the small, safe Markdown subset used by concept explanations.
     Always escape source text first; only then add the HTML we generate. */
  const markdownInline = value => {
    let html = esc(value);
    html = html.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g,
      (_, label, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
    html = html.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return html;
  };

  const markdownToHTML = value => {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let paragraph = [];
    let listType = null;
    const closeList = () => {
      if (listType) out.push('</' + listType + '>');
      listType = null;
    };
    const flushParagraph = () => {
      if (paragraph.length) out.push('<p>' + paragraph.map(markdownInline).join(' ') + '</p>');
      paragraph = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { flushParagraph(); closeList(); continue; }
      const bullet = trimmed.match(/^[-+*]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      const item = bullet || numbered;
      if (item) {
        flushParagraph();
        const nextType = bullet ? 'ul' : 'ol';
        if (listType !== nextType) { closeList(); out.push('<' + nextType + '>'); listType = nextType; }
        out.push('<li>' + markdownInline(item[1]) + '</li>');
      } else { closeList(); paragraph.push(trimmed); }
    }
    flushParagraph(); closeList();
    return out.join('');
  };

  const pad = n => String(n).padStart(2, '0');
  const fmt = n => (n == null ? '\u2014' : Number(n).toLocaleString('en-US'));
  const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);

  const parts = title => {
    const session = title.match(/\((Session \d+)\)/);
    const [head, ...rest] = title.replace(/\s*\(Session \d+\)/, '').split(':');
    const name = rest.join(':').trim() || head.trim();
    return { label: session ? head.trim() + ' \u00b7 ' + session[1] : head.trim(), name };
  };

  const getJSON = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' \u2192 HTTP ' + r.status);
    return r.json();
  };
  const optional = p => p.then(x => x, () => null);
  const siteFooter = () => `<footer class="footer site-footer"><div class="shell">Deep Reading · <a href="${inBook ? '../' : ''}about.html">About us</a> · <a href="${inBook ? '../' : ''}citation.html">Cite this work</a> · <a href="https://github.com/mahashemi/BookReadingFramework">Source</a> · <span>Seyed Mohammad Abuzar</span></div></footer>`;

  const stat = (value, label) => `<div class="stat"><strong>${esc(value)}</strong><small>${esc(label)}</small></div>`;
  const card = (num, title, text, href, cta, external) =>
    `<a class="card unit" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}><div class="num">${esc(num)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="more">${esc(cta)}</span></a>`;
  const head = (id, h, p) => `<div class="section-head"><div><h2>${esc(h)}</h2>${p ? `<p>${esc(p)}</p>` : ''}</div></div>`;

  /* ---------- library (site root) ---------- */
  function library(manifest, live) {
    const books = [...manifest.books].sort((a, b) => Number(a.order ?? Number.MAX_SAFE_INTEGER) - Number(b.order ?? Number.MAX_SAFE_INTEGER));
    const cards = books.map(b => {
      if (b.status === 'full' && live[b.id]) {
        const { data, qd } = live[b.id];
        const concepts = data.units.reduce((n, u) => n + (u.chunks || []).length, 0);
        const t = { units: data.units.length, concepts, questions: qd ? qd.questions.length : null };
        return `<a class="card book-card" href="${bookPage(b.id)}">
  <div class="eyebrow">Full learning hub · ${esc(b.primary_category || 'Unclassified')}</div>
  <h3>${esc(b.title)}</h3>
  <p>${esc(b.author)}${b.translator ? ' \u00b7 translated by ' + esc(b.translator) : ''}</p>
  <div class="stats">${stat(t.units, 'Learning units')}${stat(t.concepts, 'Concepts')}${stat(fmt(t.questions), 'Questions')}</div>
  <span class="btn primary">Enter \u2192</span>
</a>`;
      }
      const links = Object.entries(b.links || {}).map(([k, v]) => `<a class="btn" href="${esc(SITE + dirEnc(b.dir) + v)}">${esc(k.replace(/([A-Z])/g, ' $1'))}</a>`).join('');
      return `<div class="card book-card">
  <div class="eyebrow">${esc(b.id)} \u00b7 Original format</div>
  <h3>${esc(b.title)}</h3>
  <p>${esc(b.author)}${b.note ? ' \u2014 ' + esc(b.note) : ''}</p>
  <div class="actions">${links}</div>
</div>`;
    }).join('');

    app.innerHTML = `
<section class="hero">
  <div class="eyebrow">A scholarly digital learning library</div>
  <h1>Deep Reading</h1>
  <p>A reusable framework for turning serious reading into structured understanding, active recall, teaching, and assessment \u2014 every idea traceable to the passage it came from.</p>
</section>
<section class="section" id="books">
  ${head('books', 'Books', 'Each book gets its own learning hub: units, source map, concepts, glossary, practice, assessments, and teaching materials.')}
  <div class="grid">${cards}</div>
</section>
<section class="section" id="method">
  ${head('method', 'The method', 'Four stages, applied to every book. The full methodology is public.')}
  <div class="grid">
    ${card('1 \u00b7 Read', 'Chunked, traceable source', 'The book is fetched and split into small source chunks; nothing downstream is allowed to drift from them.', REPO + 'Library/00_FRAMEWORK.md', 'Read the framework \u2197', true)}
    ${card('2 \u00b7 Understand', 'Concepts, claims, glossary', 'Each unit is distilled into concepts tied to the exact passage they came from.', bookPage('book02') + '#concepts', 'See it in Book 02 \u2192')}
    ${card('3 \u00b7 Practice', 'One question bank, spaced review', 'A single source-of-truth bank powers unit tests, full-book exams, and a Day 1/3/7/16/35 review tracker.', bookPage('book02') + '#practice', 'Start practising \u2192')}
    ${card('4 \u00b7 Teach', 'Deck, guide and script', 'A Beamer deck, teaching guide, and lecture script let you deliver the book to others.', bookPage('book02') + '#teach', 'Open teaching materials \u2192')}
  </div>
</section>
<footer class="footer site-footer"><div class="shell">Deep Reading · <a href="../about.html">About us</a> · <a href="../citation.html">Cite this work</a> · <a href="https://github.com/mahashemi/BookReadingFramework">Source</a> · <span>Seyed Mohammad Abuzar</span></div></footer>`;
  }

  /* ---------- book home ---------- */
  function bookHome(meta, data, qd, gl) {
    document.title = meta.title + ' \u00b7 Deep Reading';
    const dir = SITE + dirEnc(meta.dir);
    const L = k => meta.links?.[k] ? dir + meta.links[k] : null;
    const units = data.units;
    const allChunks = units.flatMap(u => u.chunks || []);
    const chunksForUnit = id => {
      const unit = units.find(u => u.id === id);
      return unit ? (unit.chunks || []) : [];
    };
    const t = { units: units.length, concepts: allChunks.length, chunks: allChunks.length, questions: qd ? qd.questions.length : null, cross: qd ? qd.questions.filter(q => Array.isArray(q.unit_ids)).length : null };
    const unitQuestions = id => (qd ? qd.questions.filter(q => q.unit_id === id) : null);
    const glossary = gl ? gl.entries : [];

    const unitCards = units.map((u, i) => {
      const p = parts(u.title);
      const n = unitQuestions(u.id);
      const unitChunks = u.chunks || [];
      return `<a class="card unit" href="${unitHref(meta.id, u.id)}"><div class="num">Unit ${pad(i + 1)}${p.label === p.name ? '' : ' \u00b7 ' + esc(p.label)}</div><h3>${esc(p.name)}</h3><p>${unitChunks.length} concepts${n ? ' \u00b7 ' + n.length + ' questions' : ''}</p><span class="more">Open learning unit \u2192</span></a>`;
    }).join('');

    const sourceRows = units.map((u, i) => {
      const p = parts(u.title);
      const unitChunks = u.chunks || [];
      const sourceHref = u.source_url || (dir + (u.source_file || ''));
      return `<div class="source-row"><div><div class="chapter">${esc(p.label)}${p.label === p.name ? '' : ' \u2014 ' + esc(p.name)}</div><div class="coverage">${unitChunks.length} source chunks \u00b7 ${unitChunks.length} concepts</div></div><div class="pills"><a class="pill" href="${unitHref(meta.id, u.id)}">Unit ${pad(i + 1)}</a><a class="pill" href="${esc(sourceHref)}" target="_blank" rel="noopener">Original source \u2197</a></div></div>`;
    }).join('');

    const conceptRows = units.map((u, i) => {
      const p = parts(u.title);
      const unitChunks = chunksForUnit(u.id);
      const pills = unitChunks.slice(0, 3).map(c => `<a class="pill" href="${unitHref(meta.id, u.id, '#concepts')}">${esc(c.title)}</a>`).join('');
      return `<div class="source-row"><div><div class="chapter">Unit ${pad(i + 1)} \u00b7 ${esc(p.label)}</div><div class="coverage">${unitChunks.length} source-linked concepts</div></div><div class="pills">${pills}<a class="pill" href="${unitHref(meta.id, u.id, '#concepts')}">All concepts \u2192</a></div></div>`;
    }).join('');

    const glossaryHTML = glossary.length ? `
<section class="section" id="glossary">
  ${head('glossary', 'Glossary \u2014 key terms & names', 'Every entry is verified against the source text; its unit links are computed from where it actually appears.')}
  <input class="search" id="gloss-q" type="search" placeholder="Search terms, e.g. taqiyyah, Siffin, wilayat\u2026" aria-label="Search glossary">
  <p class="coverage" id="gloss-n" style="color:var(--muted);font-size:13px;margin:0 0 10px">${glossary.length} of ${glossary.length} shown</p>
  <div class="card term-list" id="gloss-list">${glossary.map(e => termRow(e, meta.id, units)).join('')}</div>
</section>` : '';

    const teachCards = [
      meta.links?.teachingDeck ? card('Slides', 'Teaching deck', 'Beamer deck with comparison tables, mind maps, speaker notes, and a chapter link in every footer.', L('teachingDeck'), 'Open the PDF \u2192') : '',
      meta.links?.teachingGuide ? card('Guide', 'Teaching guide', 'How the book is organised for teaching, block by block.', REPO + meta.dir + meta.links.teachingGuide, 'Read guide \u2197', true) : '',
      meta.links?.lectureOutline ? card('Outline', 'Lecture outline', 'A timed whole-book lecture plan.', REPO + meta.dir + meta.links.lectureOutline, 'Read outline \u2197', true) : '',
      meta.links?.talkScript ? card('Script', 'Talk script', 'Speaker-ready explanations with exam bridges.', REPO + meta.dir + meta.links.talkScript, 'Read script \u2197', true) : '',
      meta.links?.claimOutline ? card('Reference', 'Claim \u2192 evidence outline', 'Item-by-item claims with explanation, evidence, a question, and an answer guide.', REPO + meta.dir + meta.links.claimOutline, 'Read outline \u2197', true) : '',
    ].join('');

    app.innerHTML = `
<div class="breadcrumb"><a href="${SITE}">Books</a> \u00b7 ${esc(meta.title)}</div>
<section class="hero" id="overview">
  <div class="eyebrow">Learning hub</div>
  <h1>${esc(meta.title)}</h1>
  <p>${esc(meta.author)}${meta.translator ? ', translated by ' + esc(meta.translator) : ''}. A structured environment that keeps the original text, concepts, questions, review and assessment connected.</p>
  <div class="stats">${stat(t.units, 'Learning units')}${stat(t.concepts, 'Concepts')}${stat(fmt(t.questions), 'Questions')}${stat(t.chunks, 'Source chunks')}</div>
  <div class="actions">
    ${L('studyGuide') ? `<a class="btn primary" href="${L('studyGuide')}">Open the study guide</a>` : ''}
    <a class="btn" href="${unitHref(meta.id, units[0].id)}">Start at Unit 01</a>
    ${meta.links?.teachingDeck ? `<a class="btn" href="${L('teachingDeck')}">Teaching deck (PDF)</a>` : ''}
  </div>
</section>
<section class="section" id="units">
  ${head('units', 'Learning units', 'A learning unit is an instructional division of the source \u2014 not necessarily identical to a chapter boundary.')}
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
    ${meta.links?.mindMap ? card('Visual map', 'Interactive concept graph', 'Click through the structure of the book and expand relationships between units and concepts.', L('mindMap'), 'Open mind map \u2192') : ''}
    ${meta.links?.mindMapOutline ? card('Reference', 'Static outline', "Text overview of the book's conceptual structure.", REPO + meta.dir + meta.links.mindMapOutline, 'Read outline \u2197', true) : ''}
  </div>
</section>
<section class="section" id="practice">
  ${head('practice', 'Practice', 'All practice draws on one question bank' + (t.questions ? ' of ' + fmt(t.questions) + ' questions' + (t.cross ? ' (including ' + t.cross + ' cross-unit synthesis questions)' : '') : '') + '.')}
  <div class="grid">
    ${meta.links?.unitTests ? card('Practice', 'Unit tests', 'A mixed test for each learning unit: multiple choice, fill-in, short and long answer.', L('unitTests'), 'Open unit tests \u2192') : ''}
    ${card('Study', 'Interactive study guide', 'Concepts, claims, hidden answers, self-marking, and a Day 1 \u2192 3 \u2192 7 \u2192 16 \u2192 35 spaced-review tracker.', L('studyGuide'), 'Open study guide \u2192')}
  </div>
</section>
<section class="section" id="assessments">
  ${head('assessments', 'Assessments', 'Cumulative papers drawn from the same question bank.')}
  <div class="grid">
    ${meta.links?.fullBookExam ? card('Assessment', 'Full-book exam', 'Generate cumulative papers across the whole book.', L('fullBookExam'), 'Open exam generator \u2192') : ''}
    ${meta.links?.interleavedExam ? card('Assessment', 'Interleaved exam', 'A simulated exam interleaving all units, plus a hard worst-case paper.', L('interleavedExam'), 'Open interleaved exams \u2192') : ''}
    ${meta.links?.masterYears ? card('Exam library', '20 simulated years', 'Twenty complete practice papers, printable.', L('masterYears'), 'Open exam library \u2192') : ''}
  </div>
</section>
<section class="section" id="teach">
  ${head('teach', 'Teach this book', 'Materials for delivering this book to others.')}
  <div class="grid">${teachCards}</div>
</section>`;
    wireGlossary();
  }

  function termRow(e, bookId, units) {
    const pills = e.units.map(id => {
      const i = units.findIndex(u => u.id === id);
      return i < 0 ? '' : `<a class="pill" href="${unitHref(bookId, id)}">Unit ${pad(i + 1)}</a>`;
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

  /* ---------- unit page ----------
     Concepts are the primary content (a student opens this page to learn
     the concepts, not to read about the page). Claim/evidence data is
     intentionally not shown here: in this book's data every
     old claim-example layer's reasoning/evidence entry was identical to (or a
     truncated copy of) the matching concept's own explanation, and every
     The canonical chunk text is rendered directly; derived Akhlaq lessons
     are now displayed separately when a book provides them. */
  function unitPage(meta, data, qd, gl, id, cf) {
    const dir = SITE + dirEnc(meta.dir);
    const units = data.units;
    const i = units.findIndex(u => u.id === id);
    if (i < 0) { location.replace(bookPage(meta.id)); return; }
    const u = units[i];
    const sourceHref = u.source_url || (dir + (u.source_file || ''));
    const L = k => meta.links?.[k] ? dir + meta.links[k] : null;
    const chunks = u.chunks || [];
    const p = parts(u.title);
    const prev = units[i - 1], next = units[i + 1];
    const qList = qd ? qd.questions.filter(q => q.unit_id === u.id) : null;
    const chunkCount = chunks.length;
    const terms = gl ? gl.entries.filter(e => e.units.includes(u.id)) : [];
    const testHref = meta.links?.unitTests ? dir + meta.links?.unitTests + '?unit=' + encodeURIComponent(u.id) : null;
    const counterfactuals = (cf?.counterfactuals || []).filter(x => x.unit_id === u.id);
    const counterfactualHTML = counterfactuals.length ? `
<section class="section" id="counterfactual-istidlal">
  <div class="section-head compact"><div><h2>Questions a careful reader might ask</h2><p>Begin with the genuine puzzle raised by the chapter. Each answer reasons from the linked concept and source; any hypothetical inference is identified in the answer rather than forced into every question.</p></div></div>
  <div class="grid">${counterfactuals.map((x, n) => {
    const conceptUnit = units.find(unit => unit.id === x.unit_id);
    const concept = conceptUnit?.chunks?.find(chunk => chunk.id === x.concept_chunk_id);
    const conceptHref = concept
      ? (conceptUnit.id === u.id
        ? '#concept-' + encodeURIComponent(concept.id)
        : unitHref(meta.id, conceptUnit.id) + '#concept-' + encodeURIComponent(concept.id))
      : null;
    const conceptHTML = concept
      ? '<div class="source-note prerequisite"><strong>Read this concept first:</strong> <a class="pill" href="' + esc(conceptHref) + '">' + esc(concept.title) + ' ↗</a></div>'
      : '<div class="source-note prerequisite"><strong>Prerequisite concept:</strong> ' + esc(x.concept_chunk_id || 'Not specified') + ' (concept reference unavailable)</div>';
    const sources = (x.source_ids || []).map(sid => cf.source_catalog?.[sid]).filter(Boolean);
    const sourceHTML = sources.length
      ? '<div class="source-note"><span>Sources: </span>' + sources.map(src => '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.work) + ' · ' + esc(src.locator) + '</a>').join(' · ') + '</div>'
      : '';
    return '<article class="card unit counterfactual-card"><div class="num">Question ' + pad(n + 1) + ' · ' + esc(x.difficulty || 'hard') + '</div>' + conceptHTML + '<h3>' + esc(x.prompt) + '</h3><details class="passage"><summary>Reveal the reasoning</summary><p>' + linkedText(x.answer) + '</p><p class="meta-line"><strong>Istidlal takeaway:</strong> ' + esc(x.istidlal_takeaway) + '</p>' + sourceHTML + '</details></article>';
  }).join('')}</div>
</section>` : '';
    const nameOf = uid => { const k = units.findIndex(x => x.id === uid); return k < 0 ? uid : 'Unit ' + pad(k + 1) + ' \u00b7 ' + parts(units[k].title).label; };
    const breakdown = list => ['MCQ', 'FILL', 'SHORT', 'LONG'].map(t => t + ' ' + list.filter(q => q.type === t).length).join(' \u00b7 ');

    document.title = (p.label === p.name ? p.name : p.label + ' \u2014 ' + p.name) + ' \u00b7 ' + meta.title;

    /* The canonical chunk text is the source-grounded learning passage. Render one passage reveal per concept rather than inventing a second explanation field or duplicating the same source text under another label. */
    const jihadTruceFramework = meta.id === 'book02' && u.id === 'u04' ? `
<section class="section jihad-framework" id="jihad-truce-framework" aria-labelledby="jihad-framework-title">
  <div class="section-head compact">
    <div><div class="eyebrow">The key teaching visual · read the branches, not just the endpoints</div><h2 id="jihad-framework-title">Jihad &amp; Truce: a Yes/No Decision Tree</h2>
    <p>First classify the situation, then follow the YES/NO branches. The colored overlays show how Mutahhari’s historical comparison can be read against the framework; they are not a modern fatwa or an automatic rule for present-day conflicts.</p></div>
  </div>
  <div class="jf-legend" aria-label="Decision tree legend">
    <span><i class="jf-swatch jf-swatch-question"></i> Question / decision node</span>
    <span><i class="jf-swatch jf-swatch-leaf"></i> Rule or outcome</span>
    <span><i class="jf-swatch jf-swatch-hasan"></i> Imam al-Hasan’s path</span>
    <span><i class="jf-swatch jf-swatch-husayn"></i> Imam al-Husayn’s path</span>
  </div>
  <div class="jf-graph-frame" role="img" aria-label="A yes-or-no decision tree. It distinguishes defence, conflict between Muslim groups, public allegiance and wrongdoing, offensive jihad authorization, and truce conditions. A dark-green overlay traces the treaty case of Imam al-Hasan and a blood-red overlay traces Imam al-Husayn’s public stand.">
    <svg class="jf-graph" viewBox="0 0 1600 1320" xmlns="http://www.w3.org/2000/svg" aria-labelledby="jf-svg-title jf-svg-desc">
      <title id="jf-svg-title">Jihad and truce: source-grounded decision tree</title>
      <desc id="jf-svg-desc">Follow each question's Yes or No arrow. Green traces the route Mutahhari's analysis associates with al-Hasan's treaty; red traces the distinct historical route associated with al-Husayn's public stand. The paths are interpretive overlays, not legal rulings.</desc>
      <defs>
        <marker id="jf-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#82909b"/></marker>
        <marker id="jf-arrow-hasan" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#174f3e"/></marker>
        <marker id="jf-arrow-husayn" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#a51f2b"/></marker>
      </defs>
      <g class="jf-connectors" fill="none" stroke="#82909b" stroke-width="3" marker-end="url(#jf-arrow)">
        <path d="M800 96 V142"/><path d="M620 182 H430 V260"/><path d="M800 222 V260"/>
        <path d="M620 306 H430 V390"/><path d="M800 346 V390"/>
        <path d="M620 436 H430 V540"/><path d="M800 482 V540"/>
        <path d="M980 582 H1140 V600"/><path d="M800 624 V680"/>
        <path d="M620 720 H430 V800"/><path d="M800 760 V800"/>
        <path d="M800 880 V920"/><path d="M620 960 H430 V1050"/><path d="M800 1000 V1050"/>
        <path d="M980 960 H1160 V1050"/>
        <path d="M430 500 H520 V720 H620"/>
      </g>
      <g class="jf-branch-labels">
        <text x="520" y="169">YES</text><text x="817" y="246">NO</text>
        <text x="520" y="293">YES</text><text x="817" y="376">NO</text>
        <text x="520" y="420">NO</text><text x="817" y="526">YES</text>
        <text x="1040" y="568">YES</text><text x="817" y="662">NO</text>
        <text x="520" y="705">NO</text><text x="817" y="785">YES</text>
        <text x="817" y="905">YES</text><text x="520" y="1032">NO</text><text x="817" y="1032">YES</text>
        <text x="1060" y="942">NO</text>
      </g>
      <g class="jf-route jf-route-hasan" fill="none" stroke="#174f3e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".95" marker-end="url(#jf-arrow-hasan)">
        <path d="M800 96 V142"/><path d="M800 222 V260"/><path d="M620 306 H430 V390"/><path d="M430 500 H520 V720 H620"/><path d="M800 760 V800"/><path d="M800 880 V920"/><path d="M800 1000 V1050"/>
      </g>
      <g class="jf-route jf-route-husayn" fill="none" stroke="#a51f2b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".95" marker-end="url(#jf-arrow-husayn)">
        <path d="M800 96 V142"/><path d="M620 182 H430 V260"/><path d="M430 346 H520 V436 H620"/><path d="M980 436 H1140 V510"/>
      </g>
      <g class="jf-node jf-node-root"><rect x="620" y="24" width="360" height="72" rx="18"/><text x="800" y="52" class="jf-node-kicker">START</text><text x="800" y="77">What kind of situation is this?</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="142" width="360" height="80" rx="16"/><text x="800" y="172">Is there an active external attack</text><text x="800" y="196">or immediate threat to protected people/property?</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-left"><rect x="60" y="260" width="370" height="86" rx="14"/><text x="245" y="285" class="jf-node-kicker">YES · DEFENCE</text><text x="245" y="309">Protect against the attack</text><text x="245" y="330" class="jf-node-small">Distinct rules; not the offensive-jihad case.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="260" width="360" height="86" rx="16"/><text x="800" y="290">Is this conflict between Muslim groups</text><text x="800" y="314">or rebellion against a just Imam?</text><text x="800" y="334" class="jf-node-small">Classify precisely; do not assume equivalence.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-left jf-leaf-hasan"><rect x="60" y="390" width="370" height="110" rx="14"/><text x="245" y="416" class="jf-node-kicker">YES · RECONCILIATION FIRST</text><text x="245" y="440">Seek to reconcile the parties</text><text x="245" y="462" class="jf-node-small">Qur’an 49:9 describes confronting the side</text><text x="245" y="482" class="jf-node-small">that persists in wrongdoing after refusal.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="390" width="360" height="92" rx="16"/><text x="800" y="420">Is a demand for allegiance and public</text><text x="800" y="444">opposition to wrongdoing central?</text><text x="800" y="465" class="jf-node-small">A historical duty question—not just troop count.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-right jf-leaf-husayn"><rect x="1140" y="510" width="400" height="120" rx="14"/><text x="1340" y="537" class="jf-node-kicker">YES · HISTORICAL DUTY</text><text x="1340" y="561">Examine the demanded pledge, ruler’s record,</text><text x="1340" y="583">public responsibility, and available options.</text><text x="1340" y="606" class="jf-node-small">These factors explain a case; they do not auto-decide it.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="540" width="360" height="84" rx="16"/><text x="800" y="570">Is the proposal to initiate offensive jihad</text><text x="800" y="594">without an immediate attack?</text><text x="800" y="613" class="jf-node-small">The source’s Shi‘ah jurisprudential category.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-left"><rect x="60" y="650" width="370" height="104" rx="14"/><text x="245" y="677" class="jf-node-kicker">YES · AUTHORIZATION</text><text x="245" y="701">Do not treat initiation as self-authorizing</text><text x="245" y="724" class="jf-node-small">Mutahhari’s account requires the Imam or</text><text x="245" y="744" class="jf-node-small">a specifically appointed representative.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="680" width="360" height="80" rx="16"/><text x="800" y="710">Is a truce being considered</text><text x="800" y="734">instead of continuing hostilities?</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-right"><rect x="1140" y="680" width="400" height="94" rx="14"/><text x="1340" y="707" class="jf-node-kicker">NO · REASSESS THE CASE</text><text x="1340" y="731">Do not force the facts into a truce rule.</text><text x="1340" y="752" class="jf-node-small">Return to duties, authority, and context.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="800" width="360" height="80" rx="16"/><text x="800" y="830">Is there a genuine public interest in a truce?</text><text x="800" y="852" class="jf-node-small">Weakness, time to gain support, or persuasion?</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-left"><rect x="60" y="920" width="370" height="80" rx="14"/><text x="245" y="947" class="jf-node-kicker">NO · NOT JUST PEACE FOR ITS OWN SAKE</text><text x="245" y="972">The cited rule does not permit a truce</text><text x="245" y="991" class="jf-node-small">when the stated advantage is absent.</text></g>
      <g class="jf-node jf-node-question"><rect x="620" y="920" width="360" height="80" rx="16"/><text x="800" y="950">Is the agreement for a defined period</text><text x="800" y="974">with terms examined honestly?</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-right"><rect x="1140" y="920" width="400" height="80" rx="14"/><text x="1340" y="947" class="jf-node-kicker">NO · INSUFFICIENT BASIS</text><text x="1340" y="972">An undefined pause is not enough.</text><text x="1340" y="991" class="jf-node-small">Terms and foreseeable consequences matter.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-hasan"><rect x="620" y="1050" width="360" height="104" rx="14"/><text x="800" y="1077" class="jf-node-kicker">YES · COMPARE THE REAL CASE</text><text x="800" y="1101">Assess role, capacity, pledge, terms,</text><text x="800" y="1123">public duty, and foreseeable consequences.</text><text x="800" y="1143" class="jf-node-small">No single factor is decisive by itself.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-hasan"><rect x="60" y="1050" width="370" height="104" rx="14"/><text x="245" y="1077" class="jf-node-kicker">IMAM AL-HASAN · DARK GREEN</text><text x="245" y="1101">Treaty with conditions</text><text x="245" y="1123" class="jf-node-small">Later poisoned, according to the tradition;</text><text x="245" y="1143" class="jf-node-small">not a causal result inferred from this tree.</text></g>
      <g class="jf-node jf-node-leaf jf-leaf-husayn"><rect x="1140" y="1050" width="400" height="104" rx="14"/><text x="1340" y="1077" class="jf-node-kicker">IMAM AL-HUSAYN · BLOOD RED</text><text x="1340" y="1101">Public stand at Karbala</text><text x="1340" y="1123" class="jf-node-small">Bloodshed and martyrdom followed; this is</text><text x="1340" y="1143" class="jf-node-small">historical aftermath, not a universal algorithm.</text></g>
      <g class="jf-note"><rect x="60" y="1190" width="1480" height="84" rx="14"/><text x="84" y="1220">READ THIS CAREFULLY</text><text x="84" y="1247">The overlays summarize Mutahhari’s interpretation of two distinct historical situations. Al-Hasan’s treaty was not a pledge of allegiance to every act of Mu‘awiyah;</text><text x="84" y="1268">al-Husayn’s refusal involved a different demand and public responsibility. Neither poison nor bloodshed is presented as a simple causal output of the decision tree.</text></g>
    </svg>
  </div>
  <div class="jf-case-notes">
    <article class="jf-case-note jf-case-note-hasan"><h3><span>●</span> Imam al-Hasan · treaty path</h3><p><strong>Highlighted:</strong> rebellion against the sitting caliph; reconciliation/peace as an available option; weak and divided support; defined treaty conditions.</p><p><strong>Not implied:</strong> that the treaty endorsed Mu‘awiyah’s later conduct, or that the later poisoning was caused by the treaty decision.</p><a href="#concept-b02-u04-002">Military balance ↗</a> · <a href="#concept-b02-u04-006">Treaty terms ↗</a></article>
    <article class="jf-case-note jf-case-note-husayn"><h3><span>●</span> Imam al-Husayn · public stand</h3><p><strong>Highlighted:</strong> a direct demand for allegiance to Yazid, the ruler’s record, public invitations from Kufah, and the duty to oppose wrongdoing.</p><p><strong>Not implied:</strong> that his case was simply the same as initiating offensive jihad, or that the truce rules alone settle the question.</p><a href="#concept-b02-u04-001">Different political roles ↗</a> · <a href="#concept-b02-u04-005">Public duty and ruler’s record ↗</a></article>
  </div>
  <div class="jf-bottomline"><strong>How to read the tree</strong><p>Start at the top. Follow only the branch that matches the question’s facts. The historical overlays then ask which principles are relevant—and which boxes do not fit—without pretending that a diagram can replace the chapter’s full argument.</p><a href="https://al-islam.org/survey-lives-infallible-imams-murtadha-mutahhari/chapter-2-imam-al-hassans-pacifism-session-1#the-cases-for-jihad-in-the-shiah-jurisprudence" target="_blank" rel="noopener">Session 1: jurisprudential categories ↗</a> · <a href="https://al-islam.org/survey-lives-infallible-imams-murtadha-mutahhari/chapter-2-imam-al-hassans-pacifism-session-2#the-elements-contributing-to-imam-al-husaynsuprisal-and-their-contrasts-with-imam-al-hassans-circumstances" target="_blank" rel="noopener">Session 2: compare the two Imams ↗</a></div>
</section>` : '';

    const concepts = chunks.map(c => {
      return `<article class="card unit" id="concept-${esc(c.id)}"><div class="num">Concept</div><h3>${esc(c.title)}</h3><details class="passage" open><summary>Read the passage</summary><div class="markdown-content">${markdownToHTML(c.text)}</div></details><div class="source-note"><a href="${esc(c.source_url || sourceHref)}" target="_blank" rel="noopener">${esc(c.title)} ↗</a></div></article>`;
    }).join('');

    const phrases = u.quotes.length ? `<section class="section"><div class="section-head compact"><div><h2>Key phrases</h2><p>Short phrases worth remembering verbatim. Consult the original page for full context.</p></div></div>${u.quotes.map(q => `<blockquote class="phrase">${esc(q.text)}</blockquote>`).join('')}</section>` : '';

    const termsHTML = terms.length ? `<section class="section"><div class="section-head compact"><div><h2>Key terms &amp; names in this unit</h2></div></div><div class="card term-list">${terms.map(e => termRow(e, meta.id, units)).join('')}</div></section>` : '';

    const evidenceLinks = u.akhlaq?.evidence_chunk_ids?.length ? '<div class="evidence-links"><span class="meta-line">Evidence concepts:</span> ' + u.akhlaq.evidence_chunk_ids.map(cid => { const c = chunks.find(x => x.id === cid); return c ? '<a class="pill" href="#concept-' + encodeURIComponent(cid) + '">' + esc(c.title) + ' ↗</a>' : '<span class="pill">' + esc(cid) + '</span>'; }).join(' ') + '</div>' : '';
    const links = u.connections.length ? `<section class="section"><div class="section-head compact"><div><h2>Connections</h2><p>Where this unit's ideas reappear elsewhere in the book.</p></div></div><div class="grid">${u.connections.map(c => `<a class="card unit" href="${unitHref(meta.id, c.to_unit_id)}"><div class="num">${esc(nameOf(c.to_unit_id))}</div><h3>${esc(c.label)}</h3><span class="more">Go to unit \u2192</span></a>`).join('')}</div></section>` : '';

    app.innerHTML = `
<div class="breadcrumb"><a href="${SITE}">Books</a> \u00b7 <a href="${bookPage(meta.id)}">${esc(meta.title)}</a> \u00b7 Unit ${pad(i + 1)}</div>
<section class="unit-hero">
  <div class="eyebrow">Learning unit ${pad(i + 1)} \u00b7 ${esc(p.label)}</div>
  <h1>${esc(p.name)}</h1>
  <div class="meta-line">${chunks.length} concepts \u00b7 ${chunkCount} source chunks${qList ? ' \u00b7 ' + qList.length + ' questions' : ''}</div>
  <div class="actions">
    <a class="btn primary" href="${esc(sourceHref)}" target="_blank" rel="noopener">Read the original \u2197</a>
    ${testHref ? `<a class="btn" href="${testHref}">Take unit test</a>` : ''}
    ${meta.links?.mindMap ? `<a class="btn" href="${dir + meta.links.mindMap}">Mind map</a>` : ''}
  </div>
</section>
${jihadTruceFramework}
${u.akhlaq?.lesson ? `<section class="section" id="akhlaq"><div class="card panel"><div class="num">Akhlaq</div><h2>Akhlaq lesson</h2><p>${esc(u.akhlaq.lesson)}</p><p class="meta-line">Derived from the unit source-grounded concepts. Follow the evidence links below to read the exact concepts behind this lesson.</p>${evidenceLinks}<p class="meta-line"></p></div></section>` : ""}
<section class="section" id="concepts"><div class="section-head compact"><div><h2>Concepts</h2><p>Each concept is a canonical learning chunk tied directly to its source.</p></div></div><div class="grid">${concepts}</div></section>
${phrases}
${counterfactualHTML}
${termsHTML}
${links}
<section class="section"><div class="card panel">
  <h2>Source coverage</h2>
  <div class="metadata-grid">
    <div><span>Source location</span><strong>${esc(p.label)}</strong></div>
    <div><span>Source chunks</span><strong>${chunkCount}</strong></div>
    <div><span>Concepts</span><strong>${chunks.length}</strong></div>
    <div><span>Questions</span><strong>${qList ? qList.length : '\u2014'}</strong></div>
    <div><span>Question mix</span><strong style="font-size:13px">${qList ? esc(breakdown(qList)) : '\u2014'}</strong></div>
    <div><span>Original text</span><strong><a href="${esc(sourceHref)}" target="_blank" rel="noopener">Original source \u2197</a></strong></div>
  </div>
</div></section>
<section class="section"><div class="card panel practice-panel">
  <div><div class="num">Practice</div><h2>Practise this unit</h2><p>Work through questions belonging to this learning unit, or use the full study guide with spaced review.</p></div>
  <div class="actions">${testHref ? `<a class="btn primary" href="${testHref}">Take unit test</a>` : ''}${L('studyGuide') ? `<a class="btn" href="${L('studyGuide')}">Study guide</a>` : ''}</div>
</div></section>
<nav class="unit-nav" aria-label="Unit navigation">
  <a ${prev ? `href="${unitHref(meta.id, prev.id)}"` : 'aria-disabled="true"'}>\u2190 ${prev ? esc(parts(prev.title).label) : 'Previous unit'}</a>
  <a href="${bookPage(meta.id)}#units">All learning units</a>
  <a ${next ? `href="${unitHref(meta.id, next.id)}"` : 'aria-disabled="true"'}>${next ? esc(parts(next.title).label) : 'Next unit'} \u2192</a>
</nav>`;
  }

  /* ---------- legacy book landing (no generated hub yet) ---------- */
  function legacyNotice(meta) {
    document.title = meta.title + ' \u00b7 Deep Reading';
    const dir = SITE + dirEnc(meta.dir);
    const links = Object.entries(meta.links || {}).map(([k, v]) =>
      `<a class="btn" href="${esc(dir + v)}">${esc(k.replace(/([A-Z])/g, ' $1'))}</a>`).join('');
    app.innerHTML = `
<div class="breadcrumb"><a href="${SITE}">Books</a> \u00b7 ${esc(meta.title)}</div>
<section class="hero">
  <div class="eyebrow">Original format</div>
  <h1>${esc(meta.title)}</h1>
  <p>${esc(meta.author)}${meta.note ? ' \u2014 ' + esc(meta.note) : ''}</p>
  <div class="actions">${links}</div>
</section>`;
  }

  /* ---------- boot ---------- */
  async function main() {
    try {
      const manifest = await getJSON(SITE + 'assets/books.json');
      if (!inBook) {
        const live = {};
        await Promise.all(manifest.books.filter(b => b.status === 'full').map(async b => {
          const dir = SITE + dirEnc(b.dir);
          const [data, qd] = await Promise.all([optional(getJSON(dir + b.data.chunks)), optional(getJSON(dir + b.data.questions))]);
          if (data) live[b.id] = { data, qd };
        }));
        library(manifest, live);
      } else {
        const meta = manifest.books.find(b => b.id === bookId);
        if (!meta) throw new Error('Unknown book_id: ' + bookId);
        if (meta.status === 'legacy') { legacyNotice(meta); app.setAttribute('aria-busy', 'false'); return; }
        const dir = SITE + dirEnc(meta.dir);
        const [data, qd, gl, cf] = await Promise.all([getJSON(dir + meta.data.chunks), optional(getJSON(dir + meta.data.questions)), optional(getJSON(dir + meta.data.glossary)), meta.data.counterfactuals ? optional(getJSON(dir + meta.data.counterfactuals)) : Promise.resolve(null)]);
        const unit = qs.get('unit');
        if (unit) {
          unitPage(meta, data, qd, gl, unit, cf);
        } else {
          bookHome(meta, data, qd, gl);
        }
      }
      if (inBook && !app.querySelector('.site-footer')) app.insertAdjacentHTML('beforeend', siteFooter());
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
