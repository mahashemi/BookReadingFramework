/* Injects a consistent navigation bar into the standalone tool pages, so a learner
   is never stranded. Resolves every link from this script's own URL, so it works
   on GitHub Pages (project path) and on a local server alike.
   Usage: <script defer src="../../../assets/toolbar.js"></script>
          add data-mode="float" for pages with a fixed header (e.g. the mind map). */
(function () {
  var s = document.currentScript || document.querySelector('script[src$="toolbar.js"]');
  if (!s) return;
  var root = new URL('../', s.src);
  var book = new URL('Library/Book%2002%20-%20Survey%20of%20the%20Lives%20of%20the%20Infallible%20Imams/', root).href;
  var links = [
    ['\u2190 Hub', root.href],
    ['Book 02', new URL('book-02/', root).href],
    ['Study guide', book + 'study_guide/study.html'],
    ['Unit tests', book + 'exam_bank/unit_tests.html'],
    ['Full-book exam', book + 'exam_bank/full_book_exam_generator.html'],
    ['Interleaved', book + 'exam_bank/interleaved_exam_generator.html'],
    ['20 years', book + 'exam_bank/MASTER_20_SIMULATED_YEARS.html'],
    ['Mind map', book + 'mind_maps/book02_interactive.html'],
    ['Teaching deck', book + 'teaching_materials/main.pdf']
  ];
  var floating = s.getAttribute('data-mode') === 'float';
  if (floating) links = links.slice(0, 3);
  var here = location.pathname.split('/').pop();
  function build() {
    var nav = document.createElement('nav');
    nav.className = 'brf-bar' + (floating ? ' brf-float' : '');
    nav.setAttribute('aria-label', 'BookReadingFramework navigation');
    nav.innerHTML = links.map(function (l) {
      var cur = here && l[1].split('?')[0].split('/').pop() === here ? ' aria-current="page"' : '';
      return '<a href="' + l[1] + '"' + cur + '>' + l[0] + '</a>';
    }).join('');
    if (floating) document.body.appendChild(nav); else document.body.insertBefore(nav, document.body.firstChild);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
