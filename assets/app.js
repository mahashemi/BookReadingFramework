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

    const jihadTruceFramework = meta.id === 'book02' && u.id === 'u04' ? `<section class="jihad-source-content" id="jihad-truce-framework" aria-label="Jihad and Truce decision framework">\n  <p class="framework-context" style="margin:0 0 18px;padding:14px 18px;border:1px solid #e3dccb;border-radius:12px;background:#fff;font-size:14px;color:#3f3a34">Start at the top and follow the YES/NO branches. One gate asks whether there is genuine public interest in a truce. The historical comparison highlights <strong>IMAM AL-HASAN · DARK GREEN</strong> and <strong>IMAM AL-HUSAYN · BLOOD RED</strong>.</p>
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
      One jurisprudence. Two circumstances. Six binary gates decide between peace and uprising —
      and the paths of the two Imams are traced through every node. The framework never changes.
      <em>The inputs do.</em>
    </p>
  </header>

  <!-- ================= SUMMARY ================= -->
  <section class="summary">
    <div class="sumcard a">
      <h3>One framework</h3>
      <p>Six gates. The same Shiʿah jurisprudence of jihād and truce.
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
    <div class="step"><span class="n">3</span> At every gate, both face the <strong>same question</strong>. Read their answers side by side.</div>
  </section>

  <!-- ================= TOOLBAR ================= -->
  <div class="toolbar">
    <div class="modes" role="group" aria-label="Path highlight">
      <button data-mode="both" class="active">Both paths</button>
      <button data-mode="hasan">Imam al-Ḥasan</button>
      <button data-mode="husayn">Imam al-Ḥusayn</button>
    </div>
    <span class="hint">Each gate carries both answers — green is al-Ḥasan's, red is al-Ḥusayn's.</span>
    <button class="btn-print" onclick="window.print()">Print / PDF</button>
  </div>

  <!-- ================= DIAGRAM ================= -->
  <div class="diagram-wrap">
    <svg id="map" viewBox="0 0 2000 3560" xmlns="http://www.w3.org/2000/svg"
         role="img" aria-label="Six-gate decision framework for jihad and truce, showing Imam al-Hasan's path in green and Imam al-Husayn's path in red">

      <!-- ======== SPINE ======== -->
      <line x1="22" y1="138" x2="22" y2="1830" stroke="#D6CDB8" stroke-width="2.5" stroke-dasharray="4 5"/>
      <circle cx="22" cy="138" r="19" fill="#1C1917"/><text x="22" y="145" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">1</text>
      <circle cx="22" cy="418" r="19" fill="#1C1917"/><text x="22" y="425" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">2</text>
      <circle cx="22" cy="698" r="19" fill="#1C1917"/><text x="22" y="705" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">2a</text>
      <circle cx="22" cy="978" r="19" fill="#1C1917"/><text x="22" y="985" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">3</text>
      <circle cx="22" cy="1258" r="19" fill="#1C1917"/><text x="22" y="1265" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">4</text>
      <circle cx="22" cy="1538" r="19" fill="#1C1917"/><text x="22" y="1545" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">5</text>
      <circle cx="22" cy="1818" r="19" fill="#1C1917"/><text x="22" y="1825" text-anchor="middle" font-family="Inter,sans-serif" font-size="17" font-weight="700" fill="#fff">6</text>

      <!-- ================= TIME AXIS BAND ================= -->
      <rect x="52" y="60" width="1908" height="44" rx="10" fill="#F7F3EA" stroke="#E3DCCB" stroke-width="1.5"/>
      <text x="84" y="88" font-family="Inter,sans-serif" font-size="16" font-weight="700" fill="#8C6E28" letter-spacing="1.5">TIME AXIS</text>
      <text x="280" y="88" font-family="Inter,sans-serif" font-size="16" font-weight="400" fill="#3F3A34">40 AH · al-Ḥasan: caliph, army fracturing, peace offered</text>
      <text x="1180" y="88" font-family="Inter,sans-serif" font-size="16" font-weight="400" fill="#3F3A34">60 AH · al-Ḥusayn: Muʿāwiyah dead, allegiance demanded</text>

      <!-- ================= GATE 1 ================= -->
      <g>
        <rect x="52" y="128" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="162" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">①  Is Muslim land under foreign attack?</text>
        <text x="84" y="190" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">Defensive jihād (Qurʾān 22:39) — if yes, every Muslim must fight, with no permission needed.</text>

        <g class="p-hasan">
          <rect x="52" y="220" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="220" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="240" width="76" height="36" rx="18" fill="#fff" stroke="#0B6B3A" stroke-width="2.5"/>
          <text x="122" y="264" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#0B6B3A">NO</text>
          <text x="84" y="318" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. Muʿāwiyah is not a foreign invader.</text>
          <text x="84" y="346" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">He is a Muslim rebel from inside.</text>
          <text x="84" y="374" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Defensive jihād <tspan font-weight="700" fill="#0B6B3A">does not apply</tspan>.</text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="220" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="220" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="240" width="76" height="36" rx="18" fill="#fff" stroke="#A31621" stroke-width="2.5"/>
          <text x="1090" y="264" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#A31621">NO</text>
          <text x="1052" y="318" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. Yazīd is not an outside army.</text>
          <text x="1052" y="346" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">He is a usurper from within.</text>
          <text x="1052" y="374" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Defensive jihād <tspan font-weight="700" fill="#A31621">does not apply</tspan>.</text>
        </g>
      </g>

      <!-- ================= GATE 2 ================= -->
      <g>
        <rect x="52" y="410" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="444" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">②  Is one Muslim faction wronging another?</text>
        <text x="84" y="472" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">Fighting rebels (bughāt). Qurʾān 49:9 — reconcile; if one side refuses, fight the wrongdoer.</text>

        <g class="p-hasan">
          <rect x="52" y="502" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="502" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="522" width="84" height="36" rx="18" fill="#0B6B3A"/>
          <text x="126" y="546" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">YES</text>
          <text x="84" y="600" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Yes. Muʿāwiyah rebelled against ʿAlī,</text>
          <text x="84" y="628" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">and now against the rightful caliph.</text>
          <text x="84" y="656" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#0B6B3A">He is the wrongdoer.</tspan></text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="502" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="502" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="522" width="84" height="36" rx="18" fill="#A31621"/>
          <text x="1094" y="546" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">YES</text>
          <text x="1052" y="600" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Yes. Yazīd's regime wrongs the Muslims —</text>
          <text x="1052" y="628" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">tyranny, embezzlement, killing the righteous.</text>
        </g>
      </g>

      <!-- ================= GATE 2a ================= -->
      <g>
        <rect x="52" y="690" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="724" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">②ᵃ  Is there a deal on the table?</text>
        <text x="84" y="752" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">If he returns to Allah's ordinance — reconcile. If he refuses — fight him until he does.</text>

        <g class="p-hasan">
          <rect x="52" y="782" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="782" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="802" width="240" height="36" rx="18" fill="#0B6B3A"/>
          <text x="204" y="826" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">YES → RECONCILE</text>
          <text x="84" y="880" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Yes. Muʿāwiyah sends a blank, signed page:</text>
          <text x="84" y="908" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#0B6B3A">“Write your own terms.”</tspan> A just settlement</text>
          <text x="84" y="936" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">is genuinely on the table.</text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="782" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="782" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="802" width="184" height="36" rx="18" fill="#A31621"/>
          <text x="1144" y="826" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">NO → FIGHT</text>
          <text x="1052" y="880" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. Yazīd's governor demands allegiance —</text>
          <text x="1052" y="908" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">no terms, no negotiation.</text>
          <text x="1052" y="936" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#A31621">There is nothing to reconcile with.</tspan></text>
        </g>
      </g>

      <!-- ================= GATE 3 ================= -->
      <g>
        <rect x="52" y="970" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="1004" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">③  Is this an offensive war beyond Muslim borders?</text>
        <text x="84" y="1032" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">Antecedent jihād — requires the Imam present, personally appointing the commander.</text>

        <g class="p-hasan">
          <rect x="52" y="1062" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="1062" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="1082" width="76" height="36" rx="18" fill="#fff" stroke="#0B6B3A" stroke-width="2.5"/>
          <text x="122" y="1106" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#0B6B3A">NO</text>
          <text x="84" y="1160" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. This is an internal conflict inside the</text>
          <text x="84" y="1188" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Muslim community.</text>
          <text x="84" y="1216" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Antecedent jihād <tspan font-weight="700" fill="#0B6B3A">does not apply</tspan>.</text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="1062" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="1062" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="1082" width="76" height="36" rx="18" fill="#fff" stroke="#A31621" stroke-width="2.5"/>
          <text x="1090" y="1106" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#A31621">NO</text>
          <text x="1052" y="1160" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. Also internal.</text>
          <text x="1052" y="1188" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Antecedent jihād <tspan font-weight="700" fill="#A31621">does not apply</tspan>.</text>
        </g>
      </g>

      <!-- ================= GATE 4 ================= -->
      <g>
        <rect x="52" y="1250" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="1284" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">④  Can we buy time without betraying the cause?</text>
        <text x="84" y="1312" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">Muḥaqqiq, Sharāʾiʿ al-Islām — a truce must be time-bound AND carry a benefit (maṣlaḥah).</text>

        <g class="p-hasan">
          <rect x="52" y="1342" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="1342" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="1362" width="316" height="36" rx="18" fill="#0B6B3A"/>
          <text x="242" y="1386" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">YES → TRUCE PERMITTED</text>
          <text x="84" y="1440" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Yes. A definite term, and a clear benefit: end the</text>
          <text x="84" y="1468" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">war, protect the Shīʿah, force the Umayyads</text>
          <text x="84" y="1496" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">to show <tspan font-weight="700" fill="#0B6B3A">their real face</tspan>.</text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="1342" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="1342" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="1362" width="316" height="36" rx="18" fill="#A31621"/>
          <text x="1210" y="1386" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">NO → TRUCE FORBIDDEN</text>
          <text x="1052" y="1440" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">No. What was offered was allegiance, not a</text>
          <text x="1052" y="1468" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">time-bound truce. Submission brings no benefit —</text>
          <text x="1052" y="1496" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#A31621">it kills the protest</tspan>.</text>
        </g>
      </g>

      <!-- ================= GATE 5 ================= -->
      <g>
        <rect x="52" y="1530" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="1564" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">⑤  Has the duty to rise ripened?</text>
        <text x="84" y="1592" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">Enjoining good and forbidding evil — all three conditions must hold.</text>

        <g class="p-hasan">
          <rect x="52" y="1622" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="1622" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="1642" width="230" height="36" rx="18" fill="#fff" stroke="#0B6B3A" stroke-width="2.5"/>
          <text x="199" y="1666" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#0B6B3A">NOT YET · 0 of 3</text>
          <text x="84" y="1720" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">① No allegiance demanded. ② Corruption not yet</text>
          <text x="84" y="1748" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">manifest. ③ No ultimatum from the base.</text>
          <text x="84" y="1776" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#0B6B3A">The obligation had not yet ripened.</tspan></text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="1622" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="1622" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="1642" width="184" height="36" rx="18" fill="#A31621"/>
          <text x="1144" y="1666" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">YES · 3 of 3</text>
          <text x="1052" y="1720" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">① Allegiance demanded and refused. ② Yazīd</text>
          <text x="1052" y="1748" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">named heir — corruption manifest. ③ 18,000</text>
          <text x="1052" y="1776" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">letters: an ultimatum. <tspan font-weight="700" fill="#A31621">The obligation had ripened.</tspan></text>
        </g>
      </g>

      <!-- ================= GATE 6 ================= -->
      <g>
        <rect x="52" y="1810" width="1908" height="76" rx="12" fill="#1C1917"/>
        <text x="84" y="1844" font-family="Inter,sans-serif" font-size="25" font-weight="600" fill="#fff">⑥  What happens if I die — and what happens if I live?</text>
        <text x="84" y="1872" font-family="Inter,sans-serif" font-size="18" font-weight="400" fill="#C9A227">The seat of the caliphate · the chance of a decisive victory.</text>

        <g class="p-hasan">
          <rect x="52" y="1902" width="940" height="170" rx="12" fill="#EAF5EE" stroke="#0B6B3A" stroke-width="2.5"/>
          <rect x="52" y="1902" width="8" height="170" rx="4" fill="#0B6B3A"/>
          <rect x="84" y="1922" width="396" height="36" rx="18" fill="#0B6B3A"/>
          <text x="282" y="1946" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">CALIPH · WAR WOULD NEVER END</text>
          <text x="84" y="2000" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Killing the caliph disgraces the caliphate. At</text>
          <text x="84" y="2028" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Ṣiffīn, 18 months of fighting ended with</text>
          <text x="84" y="2056" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">Qurʾāns on spears — <tspan font-weight="700" fill="#0B6B3A">no verdict</tspan>.</text>
        </g>

        <g class="p-husayn">
          <rect x="1020" y="1902" width="940" height="170" rx="12" fill="#FBEBEC" stroke="#A31621" stroke-width="2.5"/>
          <rect x="1020" y="1902" width="8" height="170" rx="4" fill="#A31621"/>
          <rect x="1052" y="1922" width="366" height="36" rx="18" fill="#A31621"/>
          <text x="1235" y="1946" text-anchor="middle" font-family="Inter,sans-serif" font-size="20" font-weight="700" fill="#fff">PROTESTOR · DEATH IS HONOR</text>
          <text x="1052" y="2000" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">72 men against an army. No illusion of victory —</text>
          <text x="1052" y="2028" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520">a protest carried to its end.</text>
          <text x="1052" y="2056" font-family="Inter,sans-serif" font-size="22" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#A31621">His blood would become the argument.</tspan></text>
        </g>
      </g>

      <!-- ================= "SO WHAT?" OUTCOME RIBBON ================= -->
      <g>
        <rect x="52" y="2110" width="1908" height="60" rx="12" fill="#F7F3EA" stroke="#E3DCCB" stroke-width="1.5"/>
        <text x="84" y="2145" font-family="Inter,sans-serif" font-size="16" font-weight="700" fill="#8C6E28" letter-spacing="1.5">SO WHAT?</text>
        <text x="280" y="2145" font-family="Inter,sans-serif" font-size="16" font-weight="400" fill="#3F3A34">The peace exposed the Umayyads and preserved the Shīʿah for Karbala.</text>
        <text x="1180" y="2145" font-family="Inter,sans-serif" font-size="16" font-weight="400" fill="#3F3A34">The blood became the argument that no throne could silence.</text>
      </g>

      <!-- ================= RESULTS ================= -->
      <g>
        <rect x="52" y="2200" width="1908" height="70" rx="12" fill="#1C1917"/>
        <text x="1006" y="2245" text-anchor="middle" font-family="Inter,sans-serif" font-size="26" font-weight="700" fill="#fff" letter-spacing="3">THE RESULT — WHAT EACH CHOICE ACHIEVED</text>

        <!-- HASAN RESULT -->
        <g class="p-hasan">
          <rect x="52" y="2290" width="940" height="480" rx="14" fill="#fff" stroke="#0B6B3A" stroke-width="2.5"/>
          <path d="M52,2304 A14,14 0 0 1 66,2290 L978,2290 A14,14 0 0 1 992,2304 L992,2354 L52,2354 Z" fill="#0B6B3A"/>
          <text x="84" y="2332" font-family="Inter,sans-serif" font-size="26" font-weight="700" fill="#fff" letter-spacing="1.2">THE PEACE · The Poison</text>

          <rect x="52" y="2354" width="940" height="138" fill="#F4FAF6"/>
          <text x="84" y="2390" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#0B6B3A" letter-spacing="2.2">DECISION</text>
          <text x="84" y="2424" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">Sign a time-bound treaty with five conditions:</text>
          <text x="84" y="2452" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">no allegiance, no cursing of ʿAlī, the caliphate to</text>
          <text x="84" y="2480" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">return to the Ahl al-Bayt, treasury payments, safety.</text>

          <rect x="52" y="2492" width="940" height="138" fill="#fff"/>
          <text x="84" y="2528" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#0B6B3A" letter-spacing="2.2">REASON</text>
          <text x="84" y="2562" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">Avert annihilation. Buy time. Force the Umayyads</text>
          <text x="84" y="2590" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">to break their own signed word — and</text>
          <text x="84" y="2618" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#0B6B3A">expose themselves</tspan>.</text>

          <rect x="52" y="2630" width="940" height="140" fill="#F4FAF6"/>
          <text x="84" y="2666" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#0B6B3A" letter-spacing="2.2">RESULT</text>
          <text x="84" y="2700" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">Muʿāwiyah breaks every clause. The mask falls.</text>
          <text x="84" y="2728" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#0B6B3A">The ground is prepared for Karbala.</tspan></text>
        </g>

        <!-- HUSAYN RESULT -->
        <g class="p-husayn">
          <rect x="1020" y="2290" width="940" height="480" rx="14" fill="#fff" stroke="#A31621" stroke-width="2.5"/>
          <path d="M1020,2304 A14,14 0 0 1 1034,2290 L1946,2290 A14,14 0 0 1 1960,2304 L1960,2354 L1020,2354 Z" fill="#A31621"/>
          <text x="1052" y="2332" font-family="Inter,sans-serif" font-size="26" font-weight="700" fill="#fff" letter-spacing="1.2">THE UPRISING · The Blood</text>

          <rect x="1020" y="2354" width="940" height="138" fill="#FDF5F6"/>
          <text x="1052" y="2390" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#A31621" letter-spacing="2.2">DECISION</text>
          <text x="1052" y="2424" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">Refuse allegiance. Rise. Stand at Karbala with</text>
          <text x="1052" y="2452" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">72 companions — and no illusion of victory.</text>

          <rect x="1020" y="2492" width="940" height="138" fill="#fff"/>
          <text x="1052" y="2528" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#A31621" letter-spacing="2.2">REASON</text>
          <text x="1052" y="2562" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">The duty had ripened. Silence before a manifest</text>
          <text x="1052" y="2590" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">tyrant is itself a sin.</text>
          <text x="1052" y="2618" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#A31621">The protest had to be made.</tspan></text>

          <rect x="1020" y="2630" width="940" height="140" fill="#FDF5F6"/>
          <text x="1052" y="2666" font-family="Inter,sans-serif" font-size="15" font-weight="700" fill="#A31621" letter-spacing="2.2">RESULT</text>
          <text x="1052" y="2700" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">Martyrdom that shook the Umayyad throne.</text>
          <text x="1052" y="2728" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#A31621">The blood became the argument that never stops.</tspan></text>
        </g>

        <rect x="52" y="2800" width="1908" height="72" rx="12" fill="#C9A227"/>
        <text x="1006" y="2845" text-anchor="middle" font-family="Inter,sans-serif" font-size="25" font-weight="700" fill="#1C1917" letter-spacing="1">BOTH WERE RIGHT — because the inputs differed, not the framework.</text>
      </g>

      <!-- ================= REVERSAL TEST BOX ================= -->
      <g>
        <rect x="52" y="2910" width="1908" height="130" rx="14" fill="#fff" stroke="#C9A227" stroke-width="2.5"/>
        <rect x="52" y="2910" width="8" height="130" rx="4" fill="#C9A227"/>
        <text x="84" y="2950" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8C6E28" letter-spacing="2.4">REVERSAL TEST — APPLY THE FRAMEWORK YOURSELF</text>
        <text x="84" y="2984" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520">If al-Ḥasan had lived past Muʿāwiyah — what would he have done? If al-Ḥusayn had been caliph after ʿAlī — what would he have done?</text>
        <text x="84" y="3018" font-family="Inter,sans-serif" font-size="21" font-weight="400" fill="#2A2520"><tspan font-weight="700" fill="#8C6E28">The answer is the same framework. Only the inputs change.</tspan></text>
      </g>

      <!-- ================= SYNTHESIS ================= -->
      <g>
        <rect x="52" y="3080" width="628" height="200" rx="14" fill="#fff" stroke="#E3DCCB" stroke-width="2"/>
        <text x="84" y="3118" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8C6E28" letter-spacing="2.4">ONE FRAMEWORK</text>
        <text x="84" y="3154" font-family="Inter,sans-serif" font-size="23" font-weight="700" fill="#1C1917">Six gates. Same law.</text>
        <text x="84" y="3188" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">Neither Imam appealed to a special</text>
        <text x="84" y="3214" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">exception. They faced different</text>
        <text x="84" y="3240" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">circumstances and answered the</text>
        <text x="84" y="3266" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">same questions differently.</text>

        <rect x="700" y="3080" width="628" height="200" rx="14" fill="#fff" stroke="#E3DCCB" stroke-width="2"/>
        <text x="732" y="3118" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8C6E28" letter-spacing="2.4">DIFFERENT INPUTS</text>
        <text x="732" y="3154" font-family="Inter,sans-serif" font-size="23" font-weight="700" fill="#1C1917">Caliph vs. protestor.</text>
        <text x="732" y="3188" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">Reconciliation offered vs. refused.</text>
        <text x="732" y="3214" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">Duty ripened vs. not yet.</text>
        <text x="732" y="3240" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">An army of 40,000 vs. a caravan</text>
        <text x="732" y="3266" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">of 72.</text>

        <rect x="1348" y="3080" width="612" height="200" rx="14" fill="#fff" stroke="#E3DCCB" stroke-width="2"/>
        <text x="1380" y="3118" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8C6E28" letter-spacing="2.4">ONE CAUSE</text>
        <text x="1380" y="3154" font-family="Inter,sans-serif" font-size="23" font-weight="700" fill="#1C1917">Peace prepared the uprising.</text>
        <text x="1380" y="3188" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">Had al-Ḥasan lived past Muʿāwiyah,</text>
        <text x="1380" y="3214" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">he would have risen. Had al-Ḥusayn</text>
        <text x="1380" y="3240" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">been caliph, he would have made</text>
        <text x="1380" y="3266" font-family="Inter,sans-serif" font-size="20" font-weight="400" fill="#3F3A34">peace.</text>

        <rect x="52" y="3300" width="1908" height="70" rx="12" fill="#1C1917"/>
        <text x="1006" y="3332" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-style="italic" font-weight="400" fill="#F5F1E8">
          Islam is neither a religion of pure peace nor of pure war. It is a religion of
        </text>
        <text x="1006" y="3358" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-style="italic" font-weight="400" fill="#F5F1E8">
          <tspan font-weight="700" fill="#C9A227">judgement</tspan> — peace and war are tools, and the circumstances decide which is right.
        </text>
      </g>

    </svg>
  </div>

  <!-- ================= NOTES ================= -->
  <section class="notes">
    <h2>Why both were right — in one page</h2>
    <p class="sub">Use this as the expansion after the diagram. Each card maps directly to a gate above.</p>

    <div class="notegrid">
      <div class="notecard g">
        <h3>Imam al-Ḥasan · The Poison</h3>
        <p><strong>Gate 2a:</strong> Muʿāwiyah sent a blank, signed page — <em>write your own terms</em>. A just settlement was genuinely on the table. Under Qurʾān 49:9, reconciliation is the first obligation.</p>
        <p><strong>Gate 4:</strong> The truce was time-bound, and it carried a real benefit — the Shīʿah would survive, and the Umayyads would be forced to show their true face.</p>
        <p><strong>Gate 5:</strong> The duty to rise had not yet ripened. No allegiance was demanded of him. The corruption was not yet manifest. No ultimatum had come from the base.</p>
        <p><strong>Gate 6:</strong> As caliph, his death would have disgraced the caliphate itself. Ṣiffīn had already shown that eighteen months of war produced no verdict.</p>
        <p><strong>Result:</strong> Muʿāwiyah broke every clause. The mask fell. The ground was prepared for Karbala.</p>
      </div>

      <div class="notecard r">
        <h3>Imam al-Ḥusayn · The Blood</h3>
        <p><strong>Gate 2a:</strong> Yazīd's governor demanded allegiance — no terms, no negotiation. There was nothing to reconcile with.</p>
        <p><strong>Gate 4:</strong> What was offered was not a truce. It was submission. Submission brings no benefit — it kills the protest.</p>
        <p><strong>Gate 5:</strong> All three conditions had ripened. Allegiance was demanded and refused. Yazīd was named heir — corruption manifest. Eighteen thousand letters were an ultimatum.</p>
        <p><strong>Gate 6:</strong> As a protestor, his death was not the death of a caliph. It was a protest carried to its end. His blood would become the argument.</p>
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
${u.akhlaq?.lesson ? `<section class="section" id="akhlaq"><div class="card panel"><div class="num">Akhlaq</div><h2>Akhlaq lesson</h2><p>${esc(u.akhlaq.lesson)}</p><p class="meta-line">Derived from the unit source-grounded concepts. Follow the evidence links below to read the exact concepts behind this lesson.</p>${evidenceLinks}<p class="meta-line"></p></div></section>` : ""}
<section class="section" id="concepts"><div class="section-head compact"><div><h2>Concepts</h2><p>Each concept is a canonical learning chunk tied directly to its source.</p></div></div><div class="grid">${concepts}</div></section>
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
