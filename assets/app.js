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

  /* Wrap visible ﷺ text in a styled span without changing source or narration data. */
  function normalizeSalawat(root) {
    if (!root || !document.createTreeWalker) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.nodeValue.includes('ﷺ') || !parent ||
            parent.closest('script, style, textarea, code, .salawat')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const matches = [];
    while (walker.nextNode()) matches.push(walker.currentNode);
    for (const node of matches) {
      const fragment = document.createDocumentFragment();
      const pieces = node.nodeValue.split('ﷺ');
      pieces.forEach((piece, index) => {
        if (piece) fragment.appendChild(document.createTextNode(piece));
        if (index < pieces.length - 1) {
          const span = document.createElement('span');
          span.className = 'salawat';
          span.setAttribute('aria-label', 'صلى الله عليه وآله وسلم');
          span.textContent = 'ﷺ';
          fragment.appendChild(span);
        }
      });
      node.parentNode.replaceChild(fragment, node);
    }
  }

  if (document.body) {
    normalizeSalawat(document.body);
    const salawatObserver = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') {
          normalizeSalawat(record.target.parentElement);
        } else {
          for (const added of record.addedNodes) {
            if (added.nodeType === Node.TEXT_NODE) {
              normalizeSalawat(added.parentElement);
            } else if (added.nodeType === Node.ELEMENT_NODE && !added.matches('.salawat')) {
              normalizeSalawat(added);
            }
          }
        }
      }
    });
    salawatObserver.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

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
        return `<div class="card book-card">
  <div class="eyebrow">Full learning hub · ${esc(b.primary_category || 'Unclassified')}</div>
  <h3>${esc(b.title)}</h3>
  <p>${esc(b.author)}${b.translator ? ' \u00b7 translated by ' + esc(b.translator) : ''}</p>
  <div class="stats">${stat(t.units, 'Learning units')}${stat(t.concepts, 'Concepts')}${stat(fmt(t.questions), 'Questions')}</div>
  <div class="actions"><a class="btn primary" href="${bookPage(b.id)}">Enter study hub →</a>${b.id === 'book02' ? '<a class="btn" href="urdu/index.html">Urdu reading &amp; audio →</a>' : ''}</div>
</div>`;
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
    ${meta.id === 'book02' ? `<a class="btn" href="${SITE}urdu/index.html">Urdu reading &amp; audio</a>` : ''}
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

    const jihadTruceFramework = meta.id === 'book02' && u.id === 'u04' ? `<section class="jihad-source-content" id="jihad-truce-framework" aria-label="Jihad and Truce decision framework">\n  <p class="framework-context" style="margin:0 0 18px;padding:14px 18px;border:1px solid #e3dccb;border-radius:12px;background:#fff;font-size:14px;color:#3f3a34">Start at the dark pill on the left and follow the YES/NO branches. The truce box asks whether there is genuine public interest in a truce: a time-bound deal with protective terms and no demand for allegiance. The historical comparison highlights <strong>IMAM AL-HASAN · DARK GREEN</strong> and <strong>IMAM AL-HUSAYN · BLOOD RED</strong>.</p>
<style>
.jihad-source-content{
    --ink:#1C1917; --ink2:#3F3A34; --ink3:#78716C; --ink4:#A8A29E;
    --paper:#FBF8F2; --line:#E3DCCB;
    --gold:#8C6E28; --gold2:#C9A227;
    --hasan:#0B6B3A; --hasan-bg:#EAF5EE;
    --husayn:#A31621; --husayn-bg:#FBEBEC;
  }
.jihad-source-content *{box-sizing:border-box}
.jihad-source-content{scroll-behavior:smooth}
.jihad-source-content{
    margin:0; color:var(--ink); line-height:1.55;
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
    background:
      radial-gradient(1200px 800px at 8% -5%, #fff 0%, rgba(255,255,255,0) 60%),
      radial-gradient(900px 700px at 98% 4%, #F2EDE0 0%, rgba(242,237,224,0) 62%),
      var(--paper);
  }
.jihad-source-content .wrap{max-width:1560px;margin:0 auto;padding:48px 26px 100px}
/* ===== PRE-LECTURE HADITH PANEL ===== */
  .jihad-source-content .hadith-panel{
    background:#fff;border:1px solid var(--line);border-radius:20px;
    padding:36px 40px;margin-bottom:48px;
    box-shadow:0 30px 60px -40px rgba(28,25,23,.25);
  }
.jihad-source-content .hadith-panel h2{
    font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;
    margin:0 0 6px;color:var(--ink);
  }
.jihad-source-content .hadith-panel .sub{
    font-size:12px;letter-spacing:2.4px;text-transform:uppercase;
    color:var(--gold);font-weight:700;margin:0 0 28px;
  }
.jihad-source-content .hadith-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px}
.jihad-source-content .hadith-card{
    border-radius:14px;padding:28px 30px;position:relative;overflow:hidden;
  }
.jihad-source-content .hadith-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px}
.jihad-source-content .hadith-card.h::before{background:var(--hasan)}
.jihad-source-content .hadith-card.x::before{background:var(--husayn)}
.jihad-source-content .hadith-card.n::before{background:var(--gold2)}
.jihad-source-content .hadith-card .ar{
    font-family:Georgia,'Times New Roman',serif;
    font-size:22px;line-height:1.7;direction:rtl;
    margin:0 0 16px;color:var(--ink);
  }
.jihad-source-content .hadith-card .tr{
    font-size:15.5px;color:var(--ink2);margin:0 0 16px;font-style:italic;
  }
.jihad-source-content .hadith-card .src{
    font-size:13px;color:var(--ink3);margin:0 0 8px;
  }
.jihad-source-content .hadith-card .src a{color:var(--gold);text-decoration:none;font-weight:600}
.jihad-source-content .hadith-card .src a:hover{text-decoration:underline}
.jihad-source-content .hadith-card .why{
    font-size:13.5px;color:var(--ink2);margin:0;padding-top:12px;
    border-top:1px solid var(--line);
  }
.jihad-source-content .hadith-card .why strong{color:var(--ink)}
/* ===== HEADER ===== */
  .jihad-source-content .head{border-bottom:1px solid var(--line);padding-bottom:36px;margin-bottom:44px}
.jihad-source-content .eyebrow{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
.jihad-source-content h2{font-family:Georgia,'Times New Roman',serif;font-weight:700;
     font-size:clamp(34px,4.6vw,60px);line-height:1.05;letter-spacing:-.5px;margin:0 0 20px}
.jihad-source-content h2 .h{color:var(--hasan)}
.jihad-source-content h2 .x{color:var(--husayn)}
.jihad-source-content .deck{font-size:clamp(15px,1.2vw,18px);color:var(--ink2);max-width:920px;margin:0}
.jihad-source-content .deck em{font-style:italic}
/* ===== SUMMARY ===== */
  .jihad-source-content .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-bottom:52px}
.jihad-source-content .sumcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px 28px;position:relative;overflow:hidden}
.jihad-source-content .sumcard::before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px}
.jihad-source-content .sumcard.a::before{background:var(--ink)}
.jihad-source-content .sumcard.b::before{background:linear-gradient(180deg,var(--hasan) 0 50%,var(--husayn) 50% 100%)}
.jihad-source-content .sumcard.c::before{background:var(--gold2)}
.jihad-source-content .sumcard h3{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--ink3);margin:0 0 10px;font-weight:700}
.jihad-source-content .sumcard p{margin:0;font-size:15.5px;color:var(--ink2)}
.jihad-source-content .sumcard p strong{color:var(--ink)}
/* ===== HOW TO ===== */
  .jihad-source-content .howto{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px 30px;margin-bottom:26px;
         display:flex;flex-wrap:wrap;gap:14px 44px;align-items:center}
.jihad-source-content .howto h4{font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:var(--gold);margin:0;font-weight:700;width:100%}
.jihad-source-content .step{display:flex;align-items:center;gap:12px;font-size:14.5px;color:var(--ink2);font-weight:500}
.jihad-source-content .step .n{flex:none;width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;
           font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
.jihad-source-content .step .sw{width:26px;height:6px;border-radius:3px;flex:none}
.jihad-source-content .step .sw.g{background:var(--hasan)}
.jihad-source-content .step .sw.r{background:var(--husayn)}
/* ===== TOOLBAR ===== */
  .jihad-source-content .toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:22px}
.jihad-source-content .modes{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:12px;padding:5px;gap:4px}
.jihad-source-content .modes button{appearance:none;border:0;background:transparent;cursor:pointer;
    font:600 13.5px/1 'Inter',system-ui,sans-serif;color:var(--ink2);
    padding:11px 20px;border-radius:9px;transition:all .18s ease}
.jihad-source-content .modes button:hover{background:#F5F1E8;color:var(--ink)}
.jihad-source-content .modes button.active{background:var(--ink);color:#fff}
.jihad-source-content .modes button.active[data-mode="hasan"]{background:var(--hasan)}
.jihad-source-content .modes button.active[data-mode="husayn"]{background:var(--husayn)}
.jihad-source-content .hint{font-size:12.5px;color:var(--ink3)}
.jihad-source-content .btn-print{margin-left:auto;appearance:none;cursor:pointer;
    background:#fff;border:1px solid var(--line);border-radius:11px;
    font:600 13.5px/1 'Inter',system-ui,sans-serif;color:var(--ink2);
    padding:12px 20px;transition:all .18s}
.jihad-source-content .btn-print:hover{background:var(--ink);color:#fff;border-color:var(--ink)}
/* ===== DIAGRAM ===== */
  .jihad-source-content .diagram-wrap{background:#FDFBF7;border:1px solid var(--line);border-radius:20px;
    padding:22px;overflow-x:auto;
    box-shadow:0 44px 80px -48px rgba(28,25,23,.4), inset 0 1px 0 #fff}
.jihad-source-content svg#map{display:block;width:100%;min-width:1080px;height:auto}
.jihad-source-content svg#map .p-hasan, .jihad-source-content svg#map .p-husayn{transition:opacity .4s ease}
.jihad-source-content svg#map.mode-hasan .p-husayn{opacity:.08}
.jihad-source-content svg#map.mode-husayn .p-hasan{opacity:.08}
.jihad-source-content svg#map .off{opacity:.55}
.jihad-source-content svg#map.mode-hasan .off,.jihad-source-content svg#map.mode-husayn .off{opacity:.18}
.jihad-source-content svg#map.mode-hasan .ov-husayn,.jihad-source-content svg#map.mode-husayn .ov-hasan{display:none}
/* ===== NOTES ===== */
  .jihad-source-content .notes{margin-top:72px}
.jihad-source-content .notes h2{font-family:Georgia,serif;font-size:30px;margin:0 0 8px;font-weight:700}
.jihad-source-content .notes > p.sub{margin:0 0 30px;color:var(--ink3);font-size:15px}
.jihad-source-content .notegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.jihad-source-content .notecard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px 28px}
.jihad-source-content .notecard h3{font-size:13px;letter-spacing:1.6px;text-transform:uppercase;margin:0 0 12px;font-weight:700}
.jihad-source-content .notecard.g h3{color:var(--hasan)}
.jihad-source-content .notecard.r h3{color:var(--husayn)}
.jihad-source-content .notecard.n h3{color:var(--gold)}
.jihad-source-content .notecard p{margin:0 0 12px;font-size:15px;color:var(--ink2)}
.jihad-source-content .notecard p:last-child{margin-bottom:0}
.jihad-source-content .notecard strong{color:var(--ink)}
.jihad-source-content .pull{margin-top:26px;padding:24px 32px;border-radius:14px;
    background:var(--ink);color:#F5F1E8;font-size:17px;line-height:1.6;
    font-family:Georgia,serif;font-style:italic}
.jihad-source-content .pull strong{color:var(--gold2);font-style:normal;font-weight:700}
/* ===== SOURCES ===== */
  .jihad-source-content .sources{margin-top:70px;padding-top:30px;border-top:1px solid var(--line);font-size:13.5px;color:var(--ink3)}
.jihad-source-content .sources h3{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:0 0 14px;font-weight:700}
.jihad-source-content .sources ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:8px 34px}
.jihad-source-content .sources li{padding-left:18px;position:relative}
.jihad-source-content .sources li::before{content:'—';position:absolute;left:0;color:var(--gold2)}
.jihad-source-content .sources em{font-style:italic}
@media print{.jihad-source-content{background:#fff}
.jihad-source-content .toolbar, .jihad-source-content .sources, .jihad-source-content .summary, .jihad-source-content .howto{display:none}
.jihad-source-content .diagram-wrap{border:0;box-shadow:none;padding:0;overflow:visible}
.jihad-source-content .wrap{max-width:none;padding:0}
.jihad-source-content .head{margin-bottom:20px}
.jihad-source-content .notes{page-break-before:always}
.jihad-source-content .hadith-panel{page-break-before:always}}
@media (max-width:760px){.jihad-source-content .wrap{padding:32px 16px 70px}
.jihad-source-content .btn-print{margin-left:0}}
</style>
<div class="wrap">

  <!-- ================= PRE-LECTURE HADITH PANEL ================= -->
  <section class="hadith-panel">
    <p class="sub">Pre-Lecture · Authentic Shia Hadith</p>
    <p style="font-size:15.5px;color:var(--ink2);margin:0 0 30px;">
      Three hadith frame the entire framework. They are not ornaments — they are the <strong>foundation</strong>.
      Read them aloud before opening the diagram.
    </p>

    <div class="hadith-grid">

      <!-- Hadith 1 -->
      <div class="hadith-card h">
        <p class="ar">إِنَّ ابْنِي هَذَا سَيِّدٌ، وَإِنَّ اللَّهَ سَيُصْلِحُ بِهِ بَيْنَ فِئَتَيْنِ عَظِيمَتَيْنِ مِنَ الْمُسْلِمِينَ</p>
        <p class="tr">"Indeed, this son of mine is a sayyid (master), and Allah will make peace through him between two great groups of Muslims."</p>
        <p class="src">Source: <em>Bihar al-Anwar</em>, vol. 43, p. 319; <em>al-Tara'if</em>, p. 368. <a href="https://lib.eshia.ir/12813/1/368" target="_blank" rel="noopener">Read</a></p>
        <p class="why"><strong>Why it matters:</strong> The Prophet ﷺ attributes the peace to <strong>Allah's action</strong>, not to al-Hasan's weakness. The peace was divinely willed — it was obedience, not surrender.</p>
      </div>

      <!-- Hadith 2 -->
      <div class="hadith-card n">
        <p class="ar">الحَسَنُ وَالحُسَيْنُ إِمَامَانِ، قَامَا أَوْ قَعَدَا</p>
        <p class="tr">"al-Hasan and al-Husayn are two Imams — whether they rise or sit."</p>
        <p class="src">Source: <em>Bihar al-Anwar</em>, vol. 43, p. 291; vol. 44, p. 2. <a href="https://lib.eshia.ir/11008/43/291" target="_blank" rel="noopener">Read</a></p>
        <p class="why"><strong>Why it matters:</strong> The Prophet ﷺ declares both brothers Imams <strong>in both states</strong> — the state of rising (al-Husayn) and the state of sitting/peace (al-Hasan). This destroys the idea that al-Hasan's peace was a failure.</p>
      </div>

      <!-- Hadith 3 -->
      <div class="hadith-card x">
        <p class="ar">مِثْلِي لَا يُبَايِعُ مِثْلَهُ</p>
        <p class="tr">"One like me does not pledge allegiance to one like him."</p>
        <p class="src">Source: <em>al-Luhuf</em> of Ibn Tawus, p. 30; <em>Bihar al-Anwar</em>, vol. 44, p. 325. <a href="https://lib.eshia.ir/12000/1/30" target="_blank" rel="noopener">Read</a></p>
        <p class="why"><strong>Why it matters:</strong> This is the complement to the first hadith. Al-Hasan's peace was obedience to a divine command; al-Husayn's refusal was <strong>the impossibility of legitimising tyranny</strong>. One framework, two circumstances.</p>
      </div>

    </div>
  </section>

  <!-- ================= HEADER ================= -->
  <header class="head">
    <div class="eyebrow">Chapter 2 · Imam al-Ḥasan's Pacifism · Sessions 1 &amp; 2</div>
    <h2>The Framework of Jihād &amp; Truce<br>
      <span class="h">Imam al-Ḥasan</span> &amp; <span class="x">Imam al-Ḥusayn</span></h2>
    <p class="deck">
      One jurisprudence. Two circumstances. A yes/no tree decides between peace and uprising, and the paths of the two Imams are traced through it. The framework never changes.
      <em>The inputs do.</em>
    </p>
  </header>

  <!-- ================= SUMMARY ================= -->
  <section class="summary">
    <div class="sumcard a">
      <h3>One framework</h3>
      <p>One tree. The same Shiʿah jurisprudence of jihād and truce.
         <strong>Neither Imam appealed to a special exception.</strong></p>
    </div>
    <div class="sumcard b">
      <h3>Two circumstances</h3>
      <p>Caliph vs. protestor. Reconciliation offered vs. refused.
         Duty ripened vs. not yet. <strong>Same questions, different answers.</strong></p>
    </div>
    <div class="sumcard c">
      <h3>Both were right</h3>
      <p>The peace prepared the ground for the uprising.
         <strong>Had al-Ḥasan lived past Muʿāwiyah, he would have risen.</strong></p>
    </div>
  </section>

  <!-- ================= HOW TO ================= -->
  <section class="howto">
    <h4>How to read this map</h4>
    <div class="step"><span class="n">1</span> Follow the green line — <strong>Imam al-Ḥasan</strong> <span class="sw g"></span></div>
    <div class="step"><span class="n">2</span> Follow the red line — <strong>Imam al-Ḥusayn</strong> <span class="sw r"></span></div>
    <div class="step"><span class="n">3</span> Where the paths meet, both face the <strong>same question</strong>; the scorecard under the tree sets their answers side by side.</div>
  </section>

  <!-- ================= TOOLBAR ================= -->
  <div class="toolbar">
    <div class="modes" role="group" aria-label="Path highlight">
      <button data-mode="both" class="active">Both paths</button>
      <button data-mode="hasan">Imam al-Ḥasan</button>
      <button data-mode="husayn">Imam al-Ḥusayn</button>
    </div>
    <span class="hint">Green is al-Ḥasan's route, red is al-Ḥusayn's; hollow marks show principles that did not apply.</span>
    <button class="btn-print" onclick="window.print()">Print / PDF</button>
  </div>

  <!-- ================= DIAGRAM ================= -->
  <div class="diagram-wrap">
    <!-- BEGIN generated: jihad-truce-tree (scripts/build_jihad_truce_tree.py) -->
<svg id="map" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1350" role="img" aria-label="Yes/no decision tree for the jihad and truce frameworks. Imam al-Hassan's path is dark green and ends in truce; Imam al-Husayn's path is blood red and ends in uprising.">

<rect width="2400" height="1350" fill="#FBF9F4"/>
<text x="50.0" y="80.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="56" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Jihad &amp; Truce: one framework, two decisions</text>
<text x="50.0" y="114.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">Mutahhari, A Survey into the Lives of the Infallible Imams · Chapter 2: Imam al-Hassan’s Pacifism (Sessions 1–2)</text>
<text x="2350.0" y="62.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="15" font-weight="bold" font-style="normal" fill="#5B6572" text-anchor="end" letter-spacing="1.5">DEEP READING  ·  BOOK 02  ·  DERIVED TEACHING DIAGRAM</text>
<text x="2350.0" y="90.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="end">A teaching framework drawn from Mutahhari, not a ruling for modern conflicts</text>
<rect x="30" y="140" width="1105" height="850" rx="28" fill="#F3F1EA" stroke="#D8D3C6" stroke-width="2"/>
<rect x="1160" y="140" width="1212" height="850" rx="28" fill="#EAF1F4" stroke="#C9DAE1" stroke-width="2"/>
<text x="54.0" y="172.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#3B4A63" text-anchor="start" letter-spacing="1">STAGE 1 · THE JIHAD FRAMEWORK</text>
<text x="458.8" y="172.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">—  Is there a lawful ground to fight?</text>
<text x="1184.0" y="172.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="start" letter-spacing="1">STAGE 2 · THE TRUCE FRAMEWORK</text>
<text x="1588.8" y="172.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">—  Must we fight now, or is a truce lawful?</text>
<g id="edges-base"><line class="p-both" x1="190.0" y1="450.5" x2="190.0" y2="490.5" stroke="#9AA3AF" stroke-width="3.5"/><path class="off" d="M335.0,547.5 C382.5,547.5 382.5,359.0 430.0,359.0" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-both" d="M335.0,587.5 C385.0,587.5 385.0,587.5 435.0,587.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-hasan" d="M725.0,549.5 C960.0,549.5 960.0,549.5 1195.0,549.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-husayn" d="M725.0,625.5 C770.0,625.5 770.0,712.5 815.0,712.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-husayn" d="M1105.0,674.5 C1150.0,674.5 1150.0,625.5 1195.0,625.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><line class="off" x1="960.0" y1="784.5" x2="960.0" y2="804.5" stroke="#9AA3AF" stroke-width="3.5"/><path class="p-hasan" d="M1485.0,549.5 C1530.0,549.5 1530.0,379.0 1575.0,379.0" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-husayn" d="M1485.0,625.5 C1530.0,625.5 1530.0,796.0 1575.0,796.0" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="off" d="M1865.0,341.0 C1907.5,341.0 1907.5,277.5 1950.0,277.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-hasan" d="M1865.0,417.0 C1907.5,417.0 1907.5,480.5 1950.0,480.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="p-husayn" d="M1865.0,758.0 C1907.5,758.0 1907.5,695.5 1950.0,695.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/><path class="off" d="M1865.0,834.0 C1907.5,834.0 1907.5,896.5 1950.0,896.5" fill="none" stroke="#9AA3AF" stroke-width="3.5" stroke-linecap="round"/></g>
<g id="edges-arrows"><g class="p-both"><polygon points="190.0,502.5 182.0,489.5 198.0,489.5" fill="#9AA3AF"/></g><g class="off"><polygon points="430.0,359.0 417.0,351.0 417.0,367.0" fill="#9AA3AF"/></g><g class="p-both"><polygon points="435.0,587.5 422.0,579.5 422.0,595.5" fill="#9AA3AF"/></g><g class="p-hasan"><polygon points="1195.0,549.5 1182.0,541.5 1182.0,557.5" fill="#9AA3AF"/></g><g class="p-husayn"><polygon points="815.0,712.5 802.0,704.5 802.0,720.5" fill="#9AA3AF"/></g><g class="p-husayn"><polygon points="1195.0,625.5 1182.0,617.5 1182.0,633.5" fill="#9AA3AF"/></g><g class="off"><polygon points="960.0,816.5 952.0,803.5 968.0,803.5" fill="#9AA3AF"/></g><g class="p-hasan"><polygon points="1575.0,379.0 1562.0,371.0 1562.0,387.0" fill="#9AA3AF"/></g><g class="p-husayn"><polygon points="1575.0,796.0 1562.0,788.0 1562.0,804.0" fill="#9AA3AF"/></g><g class="off"><polygon points="1950.0,277.5 1937.0,269.5 1937.0,285.5" fill="#9AA3AF"/></g><g class="p-hasan"><polygon points="1950.0,480.5 1937.0,472.5 1937.0,488.5" fill="#9AA3AF"/></g><g class="p-husayn"><polygon points="1950.0,695.5 1937.0,687.5 1937.0,703.5" fill="#9AA3AF"/></g><g class="off"><polygon points="1950.0,896.5 1937.0,888.5 1937.0,904.5" fill="#9AA3AF"/></g></g>
<g id="edges-overlay"><g class="ov-hasan p-hasan"><line x1="186.0" y1="450.5" x2="186.0" y2="490.5" stroke="#0B5D3B" stroke-width="6" stroke-linecap="round"/><polygon points="186.0,502.5 178.0,489.5 194.0,489.5" fill="#0B5D3B"/></g><g class="ov-husayn p-husayn"><line x1="194.0" y1="450.5" x2="194.0" y2="490.5" stroke="#9B111E" stroke-width="6" stroke-linecap="round"/><polygon points="194.0,502.5 186.0,489.5 202.0,489.5" fill="#9B111E"/></g><g class="ov-hasan p-hasan"><path d="M335.0,583.7 C385.0,583.7 385.0,583.7 435.0,583.7" fill="none" stroke="#0B5D3B" stroke-width="6" stroke-linecap="round"/><polygon points="435.0,583.7 422.0,575.7 422.0,591.7" fill="#0B5D3B"/></g><g class="ov-husayn p-husayn"><path d="M335.0,591.3 C385.0,591.3 385.0,591.3 435.0,591.3" fill="none" stroke="#9B111E" stroke-width="6" stroke-linecap="round"/><polygon points="435.0,591.3 422.0,583.3 422.0,599.3" fill="#9B111E"/></g><g class="ov-hasan p-hasan"><path d="M725.0,549.5 C960.0,549.5 960.0,549.5 1195.0,549.5" fill="none" stroke="#0B5D3B" stroke-width="8" stroke-linecap="round"/><polygon points="1195.0,549.5 1182.0,541.5 1182.0,557.5" fill="#0B5D3B"/></g><g class="ov-husayn p-husayn"><path d="M725.0,625.5 C770.0,625.5 770.0,712.5 815.0,712.5" fill="none" stroke="#9B111E" stroke-width="8" stroke-linecap="round"/><polygon points="815.0,712.5 802.0,704.5 802.0,720.5" fill="#9B111E"/></g><g class="ov-husayn p-husayn"><path d="M1105.0,674.5 C1150.0,674.5 1150.0,625.5 1195.0,625.5" fill="none" stroke="#9B111E" stroke-width="8" stroke-linecap="round"/><polygon points="1195.0,625.5 1182.0,617.5 1182.0,633.5" fill="#9B111E"/></g><g class="ov-hasan p-hasan"><path d="M1485.0,549.5 C1530.0,549.5 1530.0,379.0 1575.0,379.0" fill="none" stroke="#0B5D3B" stroke-width="8" stroke-linecap="round"/><polygon points="1575.0,379.0 1562.0,371.0 1562.0,387.0" fill="#0B5D3B"/></g><g class="ov-husayn p-husayn"><path d="M1485.0,625.5 C1530.0,625.5 1530.0,796.0 1575.0,796.0" fill="none" stroke="#9B111E" stroke-width="8" stroke-linecap="round"/><polygon points="1575.0,796.0 1562.0,788.0 1562.0,804.0" fill="#9B111E"/></g><g class="ov-hasan p-hasan"><path d="M1865.0,417.0 C1907.5,417.0 1907.5,480.5 1950.0,480.5" fill="none" stroke="#0B5D3B" stroke-width="8" stroke-linecap="round"/><polygon points="1950.0,480.5 1937.0,472.5 1937.0,488.5" fill="#0B5D3B"/></g><g class="ov-husayn p-husayn"><path d="M1865.0,758.0 C1907.5,758.0 1907.5,695.5 1950.0,695.5" fill="none" stroke="#9B111E" stroke-width="8" stroke-linecap="round"/><polygon points="1950.0,695.5 1937.0,687.5 1937.0,703.5" fill="#9B111E"/></g></g>
<g id="nodes"><g class="node p-both" id="n-start"><rect x="40.0" y="352.5" width="300.0" height="98.0" rx="49.0" fill="#14212F"/><text x="190.0" y="385.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">A conflict confronts the</text><text x="190.0" y="409.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">Imam, the leader of the</text><text x="190.0" y="433.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">Muslims</text></g><g class="node p-both" id="n-D1"><rect class="ov-hasan p-hasan" x="39.0" y="496.5" width="302.0" height="182.0" rx="24" fill="none" stroke="#0B5D3B" stroke-width="5"/><rect class="ov-husayn p-husayn" x="32.0" y="489.5" width="316.0" height="196.0" rx="31" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="45.0" y="502.5" width="290.0" height="170.0" rx="18" fill="#fff" stroke="#3B4A63" stroke-width="2.5"/><path d="M45.0,538.5 V520.5 A18,18 0 0 1 63.0,502.5 H317.0 A18,18 0 0 1 335.0,520.5 V538.5 Z" fill="#3B4A63"/><text x="61.0" y="525.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">DEFENSIVE JIHAD</text><text x="62.0" y="571.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Is a non-Muslim enemy</text><text x="62.0" y="597.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">attacking Islamic land,</text><text x="62.0" y="623.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">lives, property or</text><text x="62.0" y="649.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">sanctuaries?</text></g><g class="node off" id="n-L1"><rect x="430.0" y="252.5" width="300.0" height="213.0" rx="18" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/><rect x="440.0" y="266.5" width="12" height="185.0" rx="6" fill="#B8B2A2"/><text x="464.0" y="291.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#3A4350" text-anchor="start">Defensive jihad</text><text x="464.0" y="324.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Obligatory on every Muslim,</text><text x="464.0" y="347.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">man or woman, free or not.</text><text x="464.0" y="370.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">No Imam’s permission</text><text x="464.0" y="393.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">needed.</text><text x="464.0" y="424.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">e.g. an invader occupying a</text><text x="464.0" y="446.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">Muslim land</text></g><g class="node p-both" id="n-D2"><rect class="ov-hasan p-hasan" x="429.0" y="509.5" width="302.0" height="156.0" rx="24" fill="none" stroke="#0B5D3B" stroke-width="5"/><rect class="ov-husayn p-husayn" x="422.0" y="502.5" width="316.0" height="170.0" rx="31" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="435.0" y="515.5" width="290.0" height="144.0" rx="18" fill="#fff" stroke="#3B4A63" stroke-width="2.5"/><path d="M435.0,551.5 V533.5 A18,18 0 0 1 453.0,515.5 H707.0 A18,18 0 0 1 725.0,533.5 V551.5 Z" fill="#3B4A63"/><text x="451.0" y="538.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">FIGHTING REBELS · Q 49:9</text><circle cx="703.0" cy="533.5" r="13" fill="#fff"/><text x="703.0" y="539.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#3B4A63" text-anchor="middle">1</text><text x="452.0" y="584.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Is a Muslim faction in</text><text x="452.0" y="610.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">armed revolt against the</text><text x="452.0" y="636.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">lawful, sitting Imam?</text></g><g class="node p-husayn" id="n-D3"><rect class="ov-husayn p-husayn" x="809.0" y="634.5" width="302.0" height="156.0" rx="24" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="815.0" y="640.5" width="290.0" height="144.0" rx="18" fill="#fff" stroke="#3B4A63" stroke-width="2.5"/><path d="M815.0,676.5 V658.5 A18,18 0 0 1 833.0,640.5 H1087.0 A18,18 0 0 1 1105.0,658.5 V676.5 Z" fill="#3B4A63"/><text x="831.0" y="663.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">ENJOINING GOOD</text><circle cx="1083.0" cy="658.5" r="13" fill="#fff"/><text x="1083.0" y="664.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#3B4A63" text-anchor="middle">1</text><text x="832.0" y="709.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Is the Imam instead</text><text x="832.0" y="735.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">protesting a ruler who</text><text x="832.0" y="761.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">violates Islam?</text></g><g class="node off" id="n-L0"><rect x="790.0" y="816.5" width="340.0" height="168.0" rx="18" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/><rect x="800.0" y="830.5" width="12" height="140.0" rx="6" fill="#B8B2A2"/><text x="824.0" y="855.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#3A4350" text-anchor="start">No ground to fight</text><text x="824.0" y="888.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Starting a war on non-Muslims</text><text x="824.0" y="911.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">who have not attacked needs the</text><text x="824.0" y="934.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Imam or his deputy.</text><text x="824.0" y="965.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">Antecedent jihad: adult, free men</text></g><g class="node p-both" id="n-T1"><rect class="ov-hasan p-hasan" x="1189.0" y="496.5" width="302.0" height="182.0" rx="24" fill="none" stroke="#0B5D3B" stroke-width="5"/><rect class="ov-husayn p-husayn" x="1182.0" y="489.5" width="316.0" height="196.0" rx="31" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="1195.0" y="502.5" width="290.0" height="170.0" rx="18" fill="#fff" stroke="#245B74" stroke-width="2.5"/><path d="M1195.0,538.5 V520.5 A18,18 0 0 1 1213.0,502.5 H1467.0 A18,18 0 0 1 1485.0,520.5 V538.5 Z" fill="#245B74"/><text x="1211.0" y="525.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">TRUCE · MUHAQQIQ'S TEST</text><circle cx="1463.0" cy="520.5" r="13" fill="#fff"/><text x="1463.0" y="526.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="middle">3</text><text x="1212.0" y="571.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Is a lawful truce on offer:</text><text x="1212.0" y="597.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">time-bound, protective</text><text x="1212.0" y="623.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">terms, no demand for</text><text x="1212.0" y="649.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">allegiance?</text></g><g class="node p-hasan" id="n-H1"><rect class="ov-hasan p-hasan" x="1569.0" y="288.0" width="302.0" height="182.0" rx="24" fill="none" stroke="#0B5D3B" stroke-width="5"/><rect x="1575.0" y="294.0" width="290.0" height="170.0" rx="18" fill="#fff" stroke="#245B74" stroke-width="2.5"/><path d="M1575.0,330.0 V312.0 A18,18 0 0 1 1593.0,294.0 H1847.0 A18,18 0 0 1 1865.0,312.0 V330.0 Z" fill="#245B74"/><text x="1591.0" y="317.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">TRUCE · STRENGTH TEST</text><circle cx="1843.0" cy="312.0" r="13" fill="#fff"/><text x="1843.0" y="318.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="middle">2</text><text x="1592.0" y="363.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Is the force loyal and</text><text x="1592.0" y="389.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">strong enough to win</text><text x="1592.0" y="415.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">without years of Muslim</text><text x="1592.0" y="441.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">bloodshed?</text></g><g class="node p-husayn" id="n-U1"><rect class="ov-husayn p-husayn" x="1569.0" y="684.0" width="302.0" height="224.0" rx="24" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="1575.0" y="690.0" width="290.0" height="212.0" rx="18" fill="#fff" stroke="#245B74" stroke-width="2.5"/><path d="M1575.0,726.0 V708.0 A18,18 0 0 1 1593.0,690.0 H1847.0 A18,18 0 0 1 1865.0,708.0 V726.0 Z" fill="#245B74"/><text x="1591.0" y="713.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start" letter-spacing="0.9">DUTY TO RISE</text><circle cx="1783.0" cy="708.0" r="13" fill="#fff"/><text x="1783.0" y="714.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="middle">4</text><circle cx="1813.0" cy="708.0" r="13" fill="#fff"/><text x="1813.0" y="714.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="middle">5</text><circle cx="1843.0" cy="708.0" r="13" fill="#fff"/><text x="1843.0" y="714.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="middle">6</text><text x="1592.0" y="759.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Have all three conditions</text><text x="1592.0" y="785.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="20" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">for rising ripened?</text><circle cx="1599.0" cy="806.0" r="4" fill="#245B74"/><text x="1613.0" y="812.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">Allegiance is demanded</text><circle cx="1599.0" cy="827.0" r="4" fill="#245B74"/><text x="1613.0" y="833.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">The wrong is manifest and</text><text x="1613.0" y="854.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">proven</text><circle cx="1599.0" cy="869.0" r="4" fill="#245B74"/><text x="1613.0" y="875.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#5B6572" text-anchor="start">A prepared base calls him</text></g><g class="node off" id="n-F"><rect x="1950.0" y="194.0" width="400.0" height="167.0" rx="18" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/><rect x="1960.0" y="208.0" width="12" height="139.0" rx="6" fill="#B8B2A2"/><text x="1984.0" y="233.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#3A4350" text-anchor="start">Fight on</text><text x="1984.0" y="266.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Strong enough, and a truce gains</text><text x="1984.0" y="289.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">nothing? Then a truce is not permissible.</text><text x="1984.0" y="320.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">‘Ali at Siffin: the stronger Iraqi forces fought</text><text x="1984.0" y="342.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">18 months</text></g><g class="node p-hasan" id="n-TRUCE"><rect class="ov-hasan p-hasan" x="1944.0" y="377.0" width="412.0" height="207.0" rx="24" fill="none" stroke="#0B5D3B" stroke-width="5"/><rect x="1950.0" y="383.0" width="400.0" height="195.0" rx="18" fill="#E2F0E8" stroke="#0B5D3B" stroke-width="4"/><rect x="1960.0" y="397.0" width="12" height="167.0" rx="6" fill="#0B5D3B"/><text x="1984.0" y="422.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#073B25" text-anchor="start">TRUCE: al-Hassan steps</text><text x="1984.0" y="449.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#073B25" text-anchor="start">aside</text><text x="1984.0" y="482.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Book and Sunnah, no successor, no</text><text x="1984.0" y="505.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">cursing of ‘Ali, safety for his followers,</text><text x="1984.0" y="528.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">no allegiance.</text><text x="1984.0" y="559.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">Precedent: the Prophet at Hudaybiyyah</text><path transform="translate(2316.0,423.0) scale(1.25)" d="M0,-15 C7,-5 12,1 12,7 A12,12 0 1 1 -12,7 C-12,1 -7,-5 0,-15 Z" fill="#0B5D3B"/><circle cx="2324.0" cy="554.0" r="13" fill="#fff" stroke="#0B5D3B" stroke-width="2"/><text x="2324.0" y="560.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#0B5D3B" text-anchor="middle">3</text></g><g class="node p-husayn" id="n-RISE"><rect class="ov-husayn p-husayn" x="1944.0" y="594.0" width="412.0" height="203.0" rx="24" fill="none" stroke="#9B111E" stroke-width="5"/><rect x="1950.0" y="600.0" width="400.0" height="191.0" rx="18" fill="#F8E3E5" stroke="#9B111E" stroke-width="4"/><rect x="1960.0" y="614.0" width="12" height="163.0" rx="6" fill="#9B111E"/><text x="1984.0" y="639.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#6E0C15" text-anchor="start">RISE: al-Husayn refuses</text><text x="1984.0" y="672.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Allegiance demanded and refused.</text><text x="1984.0" y="695.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Kufah’s 18,000 letters. 72 loyal</text><text x="1984.0" y="718.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">companions. A protestor’s honourable</text><text x="1984.0" y="741.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">death.</text><text x="1984.0" y="772.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">An honourable stand, even unto death</text><path transform="translate(2316.0,640.0) scale(1.25)" d="M0,-15 C7,-5 12,1 12,7 A12,12 0 1 1 -12,7 C-12,1 -7,-5 0,-15 Z" fill="#9B111E"/></g><g class="node off" id="n-W"><rect x="1950.0" y="813.0" width="400.0" height="167.0" rx="18" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/><rect x="1960.0" y="827.0" width="12" height="139.0" rx="6" fill="#B8B2A2"/><text x="1984.0" y="852.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="21" font-weight="bold" font-style="normal" fill="#3A4350" text-anchor="start">Not yet: expose first</text><text x="1984.0" y="885.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">The duty to rise is not ‘produced’ until</text><text x="1984.0" y="908.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">the ruler’s true face shows.</text><text x="1984.0" y="939.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">Al-Hassan’s peace did exactly this for</text><text x="1984.0" y="961.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">al-Husayn</text></g></g>
<g id="pills"><g class="off"><rect x="364.5" y="421.6" width="46" height="24" rx="12" fill="#2B3A4B"/><text x="387.5" y="438.6" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="p-both"><rect x="364.3" y="575.5" width="46" height="24" rx="12" fill="#2B3A4B"/><text x="387.3" y="592.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g><g class="p-hasan"><rect x="754.1" y="537.5" width="46" height="24" rx="12" fill="#0B5D3B"/><text x="777.1" y="554.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="p-husayn"><rect x="754.5" y="671.1" width="46" height="24" rx="12" fill="#9B111E"/><text x="777.5" y="688.1" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g><g class="p-husayn"><rect x="1134.5" y="630.0" width="46" height="24" rx="12" fill="#9B111E"/><text x="1157.5" y="647.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="off"><rect x="937.0" y="788.5" width="46" height="24" rx="12" fill="#2B3A4B"/><text x="960.0" y="805.5" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g><g class="p-hasan"><rect x="1514.5" y="424.6" width="46" height="24" rx="12" fill="#0B5D3B"/><text x="1537.5" y="441.6" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="p-husayn"><rect x="1514.5" y="726.4" width="46" height="24" rx="12" fill="#9B111E"/><text x="1537.5" y="743.4" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g><g class="off"><rect x="1894.3" y="283.4" width="46" height="24" rx="12" fill="#2B3A4B"/><text x="1917.3" y="300.4" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="p-hasan"><rect x="1894.3" y="450.6" width="46" height="24" rx="12" fill="#0B5D3B"/><text x="1917.3" y="467.6" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g><g class="p-husayn"><rect x="1894.3" y="701.1" width="46" height="24" rx="12" fill="#9B111E"/><text x="1917.3" y="718.1" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">YES</text></g><g class="off"><rect x="1894.3" y="866.9" width="46" height="24" rx="12" fill="#2B3A4B"/><text x="1917.3" y="883.9" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="13.5" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle" letter-spacing="0.5">NO</text></g></g>
<g id="chips"><g class="ov-hasan p-hasan" data-node="D1"><circle cx="73.0" cy="672.5" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M67.5,667.0 L78.5,678.0 M67.5,678.0 L78.5,667.0" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/></g><g class="ov-husayn p-husayn" data-node="D1"><rect x="98.0" y="657.5" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M107.5,667.0 L118.5,678.0 M107.5,678.0 L118.5,667.0" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/></g><g class="ov-hasan p-hasan" data-node="D2"><circle cx="463.0" cy="659.5" r="15" fill="#0B5D3B" stroke="#0B5D3B" stroke-width="3"/><polyline points="456.5,660.0 461.0,665.0 470.0,654.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g><g class="ov-husayn p-husayn" data-node="D2"><rect x="488.0" y="644.5" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M497.5,654.0 L508.5,665.0 M497.5,665.0 L508.5,654.0" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/></g><g class="ov-husayn p-husayn" data-node="D3"><rect x="868.0" y="769.5" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="876.5,785.0 881.0,790.0 890.0,779.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g><g class="ov-hasan p-hasan" data-node="T1"><circle cx="1223.0" cy="672.5" r="15" fill="#0B5D3B" stroke="#0B5D3B" stroke-width="3"/><polyline points="1216.5,673.0 1221.0,678.0 1230.0,667.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g><g class="ov-husayn p-husayn" data-node="T1"><rect x="1248.0" y="657.5" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M1257.5,667.0 L1268.5,678.0 M1257.5,678.0 L1268.5,667.0" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/></g><g class="ov-hasan p-hasan" data-node="H1"><circle cx="1603.0" cy="464.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M1597.5,458.5 L1608.5,469.5 M1597.5,469.5 L1608.5,458.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/></g><g class="ov-husayn p-husayn" data-node="U1"><rect x="1628.0" y="887.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="1636.5,902.5 1641.0,907.5 1650.0,897.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>
<rect x="800" y="215" width="310" height="242" rx="20" fill="#fff" stroke="#D8D3C6" stroke-width="2"/>
<text x="824.0" y="277.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="72" font-weight="bold" font-style="normal" fill="#C9B98F" text-anchor="start">“</text>
<text x="830.0" y="297.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="27" font-weight="normal" font-style="italic" fill="#17202B" text-anchor="start">These all resulted</text>
<text x="830.0" y="331.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="27" font-weight="normal" font-style="italic" fill="#17202B" text-anchor="start">from the differences</text>
<text x="830.0" y="365.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="27" font-weight="normal" font-style="italic" fill="#17202B" text-anchor="start">in their</text>
<text x="830.0" y="399.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="27" font-weight="normal" font-style="italic" fill="#17202B" text-anchor="start">circumstances.</text>
<text x="830.0" y="441.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="15.5" font-weight="bold" font-style="normal" fill="#5B6572" text-anchor="start" letter-spacing="0.5">Mutahhari · Session 2</text>
<rect x="50" y="700" width="690" height="285" rx="20" fill="#fff" stroke="#D8D3C6" stroke-width="2"/>
<text x="74.0" y="734.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="15" font-weight="bold" font-style="normal" fill="#5B6572" text-anchor="start" letter-spacing="1.5">HOW TO READ THE TREE</text>
<line x1="74" y1="764" x2="134" y2="764" stroke="#0B5D3B" stroke-width="8" stroke-linecap="round"/>
<path transform="translate(154.0,766.0) scale(0.90)" d="M0,-15 C7,-5 12,1 12,7 A12,12 0 1 1 -12,7 C-12,1 -7,-5 0,-15 Z" fill="#0B5D3B"/>
<text x="176.0" y="770.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Imam al-Hassan (a) · dark green · aftermath: poison</text>
<line x1="74" y1="797" x2="134" y2="797" stroke="#9B111E" stroke-width="8" stroke-linecap="round"/>
<path transform="translate(154.0,799.0) scale(0.90)" d="M0,-15 C7,-5 12,1 12,7 A12,12 0 1 1 -12,7 C-12,1 -7,-5 0,-15 Z" fill="#9B111E"/>
<text x="176.0" y="803.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Imam al-Husayn (a) · blood red · aftermath: bloodshed</text>
<circle cx="90.0" cy="830.0" r="15" fill="#0B5D3B" stroke="#0B5D3B" stroke-width="3"/><polyline points="83.5,830.5 88.0,835.5 97.0,825.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="117.0" y="815.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="125.5,830.5 130.0,835.5 139.0,825.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
<text x="176.0" y="836.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Principle applied (answer YES)</text>
<circle cx="90.0" cy="863.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M84.5,857.5 L95.5,868.5 M84.5,868.5 L95.5,857.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/><rect x="117.0" y="848.0" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M126.5,857.5 L137.5,868.5 M126.5,868.5 L137.5,857.5" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/>
<text x="176.0" y="869.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Principle did not apply (answer NO)</text>
<rect x="74" y="883" width="60" height="26" rx="8" fill="#F4F2EC" stroke="#B8B2A2" stroke-width="2.5" stroke-dasharray="9 6"/>
<text x="176.0" y="902.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Not on either path: the law, but not their case</text>
<circle cx="104.0" cy="929.0" r="13" fill="#fff" stroke="#3B4A63" stroke-width="2"/><text x="104.0" y="935.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17" font-weight="bold" font-style="normal" fill="#3B4A63" text-anchor="middle">1</text>
<text x="176.0" y="935.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="17.5" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Numbered badges link a box to the scorecard below</text>
<text x="74.0" y="968.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16.5" font-weight="normal" font-style="italic" fill="#5B6572" text-anchor="start">Colours mark each route, not a causal output of the tree.</text>
<text x="40.0" y="1020.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="bold" font-style="normal" fill="#5B6572" text-anchor="start" letter-spacing="1.5">THE SIX PRINCIPLES — HOW EACH ONE APPLIED TO EACH IMAM</text>
<path d="M1208.0,1038 V1031 H2360.0 V1038" fill="none" stroke="#245B74" stroke-width="3" stroke-linecap="round"/>
<text x="2360.0" y="1019.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="15.5" font-weight="bold" font-style="normal" fill="#245B74" text-anchor="end">THE THREE CONDITIONS FOR RISING (4–6):  al-Hassan 0 of 3  ·  al-Husayn 3 of 3</text>
<rect x="40.0" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#DDD7C8" stroke-width="2"/>
<circle cx="68.0" cy="1074" r="16" fill="#3B4A63"/>
<text x="68.0" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">1</text>
<text x="94.0" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Sitting head of state?</text>
<line x1="54.0" y1="1106" x2="399.3" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="70.0" cy="1144.0" r="15" fill="#0B5D3B" stroke="#0B5D3B" stroke-width="3"/><polyline points="63.5,1144.5 68.0,1149.5 77.0,1139.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="96.0" y="1141.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Caliph in the seat: his death would be</text><text x="96.0" y="1161.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">the caliphate’s defeat</text></g>
<g class="ov-husayn p-husayn"><rect x="55.0" y="1187.0" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M64.5,1196.5 L75.5,1207.5 M64.5,1207.5 L75.5,1196.5" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/><text x="96.0" y="1199.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">No office held: his stand is a public</text><text x="96.0" y="1219.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">protest</text></g>
<rect x="429.3" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#DDD7C8" stroke-width="2"/>
<circle cx="457.3" cy="1074" r="16" fill="#3B4A63"/>
<text x="457.3" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">2</text>
<text x="483.3" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Loyal, reliable force?</text>
<line x1="443.3" y1="1106" x2="788.7" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="459.3" cy="1144.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M453.8,1138.5 L464.8,1149.5 M453.8,1149.5 L464.8,1138.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/><text x="485.3" y="1141.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Kufah split: chiefs bribed, desertions at</text><text x="485.3" y="1161.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Nukhaylah</text></g>
<g class="ov-husayn p-husayn"><rect x="444.3" y="1187.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="452.8,1202.5 457.3,1207.5 466.3,1197.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="485.3" y="1199.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">72 trained companions; almost none</text><text x="485.3" y="1219.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">deserted</text></g>
<rect x="818.7" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#DDD7C8" stroke-width="2"/>
<circle cx="846.7" cy="1074" r="16" fill="#245B74"/>
<text x="846.7" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">3</text>
<text x="872.7" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Lawful truce on offer?</text>
<line x1="832.7" y1="1106" x2="1178.0" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="848.7" cy="1144.0" r="15" fill="#0B5D3B" stroke="#0B5D3B" stroke-width="3"/><polyline points="842.2,1144.5 846.7,1149.5 855.7,1139.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="874.7" y="1141.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Signed blank page: time-bound,</text><text x="874.7" y="1161.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">protective clauses</text></g>
<g class="ov-husayn p-husayn"><rect x="833.7" y="1187.0" width="30" height="30" rx="7" fill="#fff" stroke="#9B111E" stroke-width="3"/><path d="M843.2,1196.5 L854.2,1207.5 M843.2,1207.5 L854.2,1196.5" stroke="#9B111E" stroke-width="3.4" stroke-linecap="round"/><text x="874.7" y="1199.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Only a pledge of allegiance was</text><text x="874.7" y="1219.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">demanded</text></g>
<rect x="1208.0" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#9DB7C4" stroke-width="2"/>
<circle cx="1236.0" cy="1074" r="16" fill="#245B74"/>
<text x="1236.0" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">4</text>
<text x="1262.0" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Allegiance demanded?</text>
<line x1="1222.0" y1="1106" x2="1567.3" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="1238.0" cy="1144.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M1232.5,1138.5 L1243.5,1149.5 M1232.5,1149.5 L1243.5,1138.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/><text x="1264.0" y="1146.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">None: the treaty required no pledge</text></g>
<g class="ov-husayn p-husayn"><rect x="1223.0" y="1187.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="1231.5,1202.5 1236.0,1207.5 1245.0,1197.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="1264.0" y="1204.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">“He must pledge his allegiance”</text></g>
<rect x="1597.3" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#9DB7C4" stroke-width="2"/>
<circle cx="1625.3" cy="1074" r="16" fill="#245B74"/>
<text x="1625.3" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">5</text>
<text x="1651.3" y="1070.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Binding call from a prepared</text>
<text x="1651.3" y="1092.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">base?</text>
<line x1="1611.3" y1="1106" x2="1956.7" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="1627.3" cy="1144.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M1621.8,1138.5 L1632.8,1149.5 M1621.8,1149.5 L1632.8,1138.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/><text x="1653.3" y="1146.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Kufah divided, hostile factions active</text></g>
<g class="ov-husayn p-husayn"><rect x="1612.3" y="1187.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="1620.8,1202.5 1625.3,1207.5 1634.3,1197.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="1653.3" y="1204.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Kufah’s 18,000 letters: an ultimatum</text></g>
<rect x="1986.7" y="1040" width="373.3" height="200" rx="18" fill="#fff" stroke="#9DB7C4" stroke-width="2"/>
<circle cx="2014.7" cy="1074" r="16" fill="#245B74"/>
<text x="2014.7" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="18" font-weight="bold" font-style="normal" fill="#fff" text-anchor="middle">6</text>
<text x="2040.7" y="1080.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19" font-weight="bold" font-style="normal" fill="#17202B" text-anchor="start">Wrong manifest and proven?</text>
<line x1="2000.7" y1="1106" x2="2346.0" y2="1106" stroke="#E8E3D6" stroke-width="2"/>
<g class="ov-hasan p-hasan"><circle cx="2016.7" cy="1144.0" r="15" fill="#fff" stroke="#0B5D3B" stroke-width="3"/><path d="M2011.2,1138.5 L2022.2,1149.5 M2011.2,1149.5 L2022.2,1138.5" stroke="#0B5D3B" stroke-width="3.4" stroke-linecap="round"/><text x="2042.7" y="1141.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Not yet: Mu‘awiyah’s written terms</text><text x="2042.7" y="1161.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">promised religious rule</text></g>
<g class="ov-husayn p-husayn"><rect x="2001.7" y="1187.0" width="30" height="30" rx="7" fill="#9B111E" stroke="#9B111E" stroke-width="3"/><polyline points="2010.2,1202.5 2014.7,1207.5 2023.7,1197.0" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><text x="2042.7" y="1199.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">Rules changed, blood shed, an unfit</text><text x="2042.7" y="1219.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="16" font-weight="normal" font-style="normal" fill="#17202B" text-anchor="start">son made heir</text></g>
<rect x="0" y="1252" width="2400" height="98" fill="#14212F"/>
<text x="50.0" y="1318.0" font-family="'Times New Roman', 'Liberation Serif', Georgia, serif" font-size="42" font-weight="bold" font-style="normal" fill="#fff" text-anchor="start">Same law. Different circumstances.</text>
<text x="920.0" y="1296.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="24" font-weight="bold" font-style="normal" fill="#E8EEF3" text-anchor="start">Neither Imam changed the law. The circumstances changed the answer.</text>
<text x="920.0" y="1330.0" font-family="Arial, 'Liberation Sans', Helvetica, sans-serif" font-size="19.5" font-weight="normal" font-style="italic" fill="#B9C7D3" text-anchor="start">“Imam al-Hassan’s peace prepared the grounds for Imam al-Husayn’s uprising.”  ·  Mutahhari, Session 2</text>
</svg>
<!-- END generated: jihad-truce-tree -->
  </div>

  <!-- ================= NOTES ================= -->
  <section class="notes">
    <h2>Why both were right — in one page</h2>
    <p class="sub">Use this as the expansion after the diagram. Each card maps directly to the numbered boxes above.</p>

    <div class="notegrid">
      <div class="notecard g">
        <h3>Imam al-Ḥasan · The Poison</h3>
        <p><strong>Truce on offer (box 3):</strong> Muʿāwiyah sent a blank, signed page — <em>write your own terms</em>. A just settlement was genuinely on the table. Under Qurʾān 49:9, reconciliation is the first obligation.</p>
        <p><strong>Truce terms (box 3):</strong> The truce was time-bound, and it carried a real benefit — the Shīʿah would survive, and the Umayyads would be forced to show their true face.</p>
        <p><strong>Duty to rise (boxes 4–6):</strong> The duty to rise had not yet ripened. No allegiance was demanded of him. The corruption was not yet manifest. No ultimatum had come from the base.</p>
        <p><strong>Position and strength (boxes 1–2):</strong> As caliph, his death would have disgraced the caliphate itself. Ṣiffīn had already shown that eighteen months of war produced no verdict.</p>
        <p><strong>Result:</strong> Muʿāwiyah broke every clause. The mask fell. The ground was prepared for Karbala.</p>
      </div>

      <div class="notecard r">
        <h3>Imam al-Ḥusayn · The Blood</h3>
        <p><strong>Truce on offer (box 3):</strong> Yazīd's governor demanded allegiance — no terms, no negotiation. There was nothing to reconcile with.</p>
        <p><strong>Truce terms (box 3):</strong> What was offered was not a truce. It was submission. Submission brings no benefit — it kills the protest.</p>
        <p><strong>Duty to rise (boxes 4–6):</strong> All three conditions had ripened. Allegiance was demanded and refused. Yazīd was named heir — corruption manifest. Eighteen thousand letters were an ultimatum.</p>
        <p><strong>Position and strength (boxes 1–2):</strong> As a protestor, his death was not the death of a caliph. It was a protest carried to its end. His blood would become the argument.</p>
        <p><strong>Result:</strong> A martyrdom that shook the Umayyad throne — and an argument that has never stopped speaking.</p>
      </div>

      <div class="notecard n">
        <h3>The one-sentence answer</h3>
        <p><strong>Same framework. Different inputs.</strong> The jurisprudence of jihād and truce does not change between the two Imams. What changes is the situation each one faced.</p>
        <p>Had al-Ḥasan been in al-Ḥusayn's place, he would have risen. Had al-Ḥusayn been in al-Ḥasan's place, he would have made peace.</p>
        <p>The peace of al-Ḥasan <strong>prepared the ground</strong> for the uprising of al-Ḥusayn. They are not two contradictory characters — they are two correct answers to two different questions.</p>
      </div>
    </div>

    <div class="pull">
      “It is not wise to say that a religion which permits war therefore considers war necessary in every situation.
      The opposite is equally wrong — to claim one is wholly anti-war and wholly pro-peace.
      <strong>Many wars prepared a more comprehensive peace, and much reconciliation prepared the ground for victorious battles.</strong>”
    </div>
  </section>

  <!-- ================= SOURCES ================= -->
  <div class="sources">
    <h3>Sources &amp; References</h3>
    <ul>
      <li>Muḥaqqiq al-Ḥillī, <em>Sharāʾiʿ al-Islām</em> — Kitāb al-Jihād: the cases of jihād and the truce test</li>
      <li>Shahīd al-Thānī, <em>Masālik al-Afhām</em> — commentary on the above</li>
      <li><em>Nahj al-Balāghah</em> — ʿAlī's restraint, his defence of ʿUthmān, and the principle of rising only when the affairs of Muslims are crossed</li>
      <li>Qurʾān 2:190 · 4:128 · 8:61 · 22:39 · 49:9</li>
      <li>Ḥudaybiyyah, 6 AH — the ten-year truce and its conditions</li>
      <li>The five clauses of the Ḥasan–Muʿāwiyah treaty</li>
      <li><em>Bihar al-Anwar</em>, vol. 43, p. 291; vol. 43, p. 319; vol. 44, p. 325</li>
      <li><em>al-Tara'if</em> of Sayyid Ibn Tawus, p. 368</li>
      <li><em>al-Luhuf</em> of Sayyid Ibn Tawus, p. 30</li>
      <li>Session 1 &amp; Session 2 of <em>Imam al-Ḥasan's Pacifism</em>, Chapter 2</li>
    </ul>
  </div>
</div>
</section>` : '';

    const conceptCard = c => `<article class="card unit" id="concept-${esc(c.id)}"><div class="num">Concept</div><h3>${esc(c.title)}</h3><details class="passage" open><summary>Read the passage</summary><div class="markdown-content">${markdownToHTML(c.text)}</div></details><div class="source-note"><a href="${esc(c.source_url || sourceHref)}" target="_blank" rel="noopener">${esc(c.title)} ↗</a></div></article>`;
    let concepts;
    if (meta.id === 'book02' && u.id === 'u06') {
      const sessionTwoIndex = chunks.findIndex(c => c.id === 'b02-u06-010');
      const sessionOne = sessionTwoIndex >= 0 ? chunks.slice(0, sessionTwoIndex) : chunks;
      const sessionTwo = sessionTwoIndex >= 0 ? chunks.slice(sessionTwoIndex) : [];
      const sessionDivider = `<div class="concept-session-divider" role="separator" aria-label="End of Session 1; beginning of Session 2" style="display:flex;align-items:center;gap:12px;margin:30px 0 22px;color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.03em"><span aria-hidden="true" style="height:1px;background:var(--line);flex:1"></span><span>SESSION 2 · IMAM AL-SADIQ’S SCHOLARLY MOVEMENT</span><span aria-hidden="true" style="height:1px;background:var(--line);flex:1"></span></div>`;
      concepts = `<section class="concept-session" aria-label="Session 1 concepts"><div class="actions"><button class="btn" type="button" data-narrate-session="1">Narrate Session 1</button><button class="btn" type="button" data-stop-narration>Stop narration</button></div><div class="grid">${sessionOne.map(conceptCard).join('')}</div></section>`
        + (sessionTwo.length ? sessionDivider + `<section class="concept-session" aria-label="Session 2 — Imam al-Sadiq’s scholarly movement"><div class="actions"><button class="btn" type="button" data-narrate-session="2">Narrate Session 2</button><button class="btn" type="button" data-stop-narration>Stop narration</button></div><div class="grid">${sessionTwo.map(conceptCard).join('')}</div></section>` : '');
    } else {
      concepts = chunks.map(conceptCard).join('');
    }

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
${u.akhlaq?.lesson ? `<section class="section" id="akhlaq"><div class="card panel"><div class="num">Akhlaq</div><h2>Akhlaq lesson</h2><p>${esc(u.akhlaq.lesson)}</p><p class="meta-line">Derived from the unit source-grounded concepts. Follow the evidence links below to read the exact concepts behind this lesson.</p>${evidenceLinks}<p class="meta-line"></p></div></section>` : ""}
<section class="section" id="concepts"><div class="section-head compact"><div><h2>Concepts</h2><p>Each concept is a canonical learning chunk tied directly to its source.</p></div></div>${meta.id === 'book02' && u.id === 'u06' ? concepts : `<div class="grid">${concepts}</div>`}</section>
${jihadTruceFramework}
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
    const sessionNarrationSections = app.querySelectorAll('[data-narrate-session]');
    if (sessionNarrationSections.length) {
      const stopNarration = () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        app.querySelectorAll('[data-narrate-session]').forEach(button => {
          button.disabled = false;
          button.textContent = button.dataset.narrateSession === '1' ? 'Narrate Session 1' : 'Narrate Session 2';
        });
      };
      sessionNarrationSections.forEach(button => button.addEventListener('click', () => {
        if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
          button.textContent = 'Browser narration unavailable';
          button.disabled = true;
          return;
        }
        stopNarration();
        const section = button.closest('.concept-session');
        const conceptsToRead = [...(section?.querySelectorAll('article.card.unit') || [])];
        const sessionLabel = button.dataset.narrateSession === '2'
          ? 'Session 2. Imam al-Sadiq’s scholarly movement.'
          : 'Session 1.';
        const textToRead = [sessionLabel, ...conceptsToRead.map(card => {
          const title = card.querySelector('h3')?.textContent || '';
          const passage = card.querySelector('.markdown-content')?.innerText || '';
          return title + '. ' + passage;
        })].join('\n\n');
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.onend = () => {
          button.disabled = false;
          button.textContent = button.dataset.narrateSession === '1' ? 'Narrate Session 1' : 'Narrate Session 2';
        };
        utterance.onerror = () => {
          button.disabled = false;
          button.textContent = button.dataset.narrateSession === '1' ? 'Narrate Session 1' : 'Narrate Session 2';
        };
        button.disabled = true;
        button.textContent = 'Narrating…';
        window.speechSynthesis.speak(utterance);
      }));
      app.querySelectorAll('[data-stop-narration]').forEach(button => button.addEventListener('click', stopNarration));
    }
    const frameworkRoot = app.querySelector('.jihad-source-content');
    if (frameworkRoot) {
      const svg = frameworkRoot.querySelector('#map');
      const buttons = frameworkRoot.querySelectorAll('.modes button');
      buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        svg?.classList.remove('mode-hasan', 'mode-husayn');
        if (button.dataset.mode !== 'both') svg?.classList.add('mode-' + button.dataset.mode);
      }));
    }
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
