/* BookReadingFramework reader enhancements.
   Visual-only reading aids; source text remains untouched. */
(() => {
  'use strict';

  const root = document.querySelector('.source-transcription, article[data-source-book], article:has(.pdf-page-marker)');
  if (!root) return;

  const key = 'brf-highlights:' + location.pathname + location.search;
  const load = () => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch (_) { return []; }
  };
  const save = items => localStorage.setItem(key, JSON.stringify(items.slice(-100)));

  const tools = document.createElement('div');
  tools.className = 'reader-tools';
  tools.innerHTML = '<button type="button" data-action="clear">پاک‌کردن برجسته‌ها</button>';
  root.parentNode.insertBefore(tools, root);

  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();

  function textNodes(node) {
    const out = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue.trim() || n.parentElement.closest('.reader-tools,.reader-highlight')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function applyHighlight(snippet) {
    const wanted = normalize(snippet);
    if (!wanted || wanted.length < 2) return false;
    for (const n of textNodes(root)) {
      const text = normalize(n.nodeValue);
      const at = text.indexOf(wanted);
      if (at < 0) continue;
      const raw = n.nodeValue;
      const rawAt = raw.indexOf(wanted);
      if (rawAt < 0) continue;
      const range = document.createRange();
      range.setStart(n, rawAt);
      range.setEnd(n, rawAt + wanted.length);
      const mark = document.createElement('mark');
      mark.className = 'reader-highlight';
      try { range.surroundContents(mark); return true; } catch (_) {}
    }
    return false;
  }

  const stored = load();
  stored.forEach(applyHighlight);

  root.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    const snippet = normalize(sel && sel.toString());
    if (!snippet || snippet.length < 2) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const mark = document.createElement('mark');
    mark.className = 'reader-highlight';
    try {
      range.surroundContents(mark);
      const items = load();
      items.push(snippet);
      save([...new Set(items)]);
      sel.removeAllRanges();
      return;
    } catch (_) {}
  });

  root.addEventListener('click', event => {
    const block = event.target.closest('p, pre');
    if (!block || event.target.closest('.reader-highlight')) return;
    root.querySelectorAll('.reader-focus').forEach(el => el.classList.remove('reader-focus'));
    block.classList.add('reader-focus');
  });

  tools.querySelector('[data-action="clear"]').addEventListener('click', () => {
    root.querySelectorAll('.reader-highlight').forEach(mark => {
      mark.replaceWith(document.createTextNode(mark.textContent));
    });
    localStorage.removeItem(key);
  });
})();
