(() => {
  'use strict';
  const root = location.pathname.includes('/book/') ? '../' : '';
  const state = { manifest: null, utterance: null, utterances: [], remaining: 0, playing: false, generation: 0, currentKey: null, loadingKey: null };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const bookId = () => new URLSearchParams(location.search).get('book_id') || 'book02';
  const unitId = () => new URLSearchParams(location.search).get('unit');

  async function getManifest() {
    if (state.manifest) return state.manifest;
    const r = await fetch(root + 'audio/manifest.json', { cache: 'no-store' });
    if (!r.ok) return null;
    state.manifest = await r.json();
    return state.manifest;
  }

  function editorialTitle(title, text = '') {
    const key = title.trim().toLowerCase();
    const persian = /[\u0600-\u06ff]/.test(text);
    if (/^\s*[0-9۰-۹]+[.)،ـ\s-]+/.test(title)) return spokenSubheading(title);
    if (key === 'opening') return persian ? 'برای شروع،' : 'To begin,';
    if (key === 'summary' || key === 'conclusion') return persian ? 'برای جمع‌بندی،' : 'To bring these ideas together.';
    return ({
      'narration': '',
      'opening': persian ? 'برای شروع،' : 'To begin,',
      'عنوان شنیداری': '',
      'source-grounded narration': persian ? 'روایت از متن:' : 'From the source:',
      'روایت': '',
      'deep reading insight': persian ? 'حالا کمی عمیق‌تر به معنای این نکته نگاه کنیم.' : 'A broader point to consider.',
      'بینشِ خوانش عمیق': 'حالا کمی عمیق‌تر به این نکته نگاه کنیم.',
      'reflection': persian ? 'حالا کمی مکث کنیم و فکر کنیم.' : 'Now, pause and reflect.',
      'مکث و تمرین': 'حالا مکث کنیم و یک تمرین کوتاه انجام دهیم.',
      'transition': persian ? 'با حرکت به بخش بعد، این پرسش را در ذهن نگه داریم.' : 'As we move forward, keep this question in mind.',
      'گذار': 'از اینجا به نکته بعد می‌رسیم.',
      'summary': persian ? 'برای جمع‌بندی،' : 'To bring these ideas together.',
      'conclusion': persian ? 'برای جمع‌بندی،' : 'To bring these ideas together.',
      'جمع‌بندی': 'برای جمع‌بندی،',
      'جمع بندی': 'برای جمع‌بندی،',
      'تمرین شنیداری': 'حالا یک تمرین کوتاه انجام دهیم.'
    })[key] ?? title.trim();
  }

  function spokenSubheading(title) {
    const clean = title.replace(/^\s*[0-9۰-۹]+[.)،ـ\s-]*/, '').replace(/[：:]$/, '').trim();
    if (!clean) return '';
    return /[\u0600-\u06ff]/.test(clean)
      ? 'نکته‌ی بعدی این است: ' + clean + '.'
      : 'The next point is ' + clean + '.';
  }

  function cleanText(value) {
    return String(value ?? '')
      .replace(/\[([^\]]+)\]\((?:https?:\/\/[^)\s]+|#[^)]+)\)/g, '$1')
      .replace(/^\s*#{2,6}\s+(.+)\s*$/gm, (_, title) => spokenSubheading(title))
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-+*]\s+/gm, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/^\s*[-*_]{3,}\s*$/gm, '')
      .replace(/\*\*|__|\*|_|\`/g, '')
      .replace(/Mu['’]awiyah/gi, 'Muawiyah')
      .replace(/Mu['’]awiya/gi, 'Muawiya')
      .replace(/Ja['’]far/gi, 'Jafar')
      .replace(/Ma['’]mun/gi, 'Mamun')
      .replace(/al-['’](?=[A-Za-z])/gi, 'al-')
      .replace(/Qur['’]an/gi, 'Quran')
      .replace(/(^|[\s([{])['’](?=[A-Za-z])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function parse(md) {
    // Source maps are editorial provenance. Keep them in the Markdown file,
    // but never expose opaque chunk IDs in the learner's transcript or audio.
    const sourceMapStart = md.search(/^#{2,6}\s+(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع)\s*$/im);
    const learningText = sourceMapStart >= 0 ? md.slice(0, sourceMapStart) : md;
    const sections = [];
    let current = null;
    for (const line of learningText.split(/\r?\n/)) {
      const h = line.match(/^#{2,6}\s+(.+)$/);
      if (h) {
        current = { title: h[1].trim(), text: '' };
        sections.push(current);
      } else if (current) {
        current.text += (current.text ? '\n' : '') + line;
      }
    }
    return {
      title: ((learningText.match(/^#\s+(.+)$/m) || [,'Listen & Learn'])[1]).trim(),
      sections: sections.filter(s => s.text.trim()).map(s => ({
        title: s.title,
        text: cleanText(s.text)
      }))
    };
  }

  // This is the single source of truth for both the visible transcript and speech.
  // In particular, the short legacy "Narration" summary is deliberately excluded:
  // it is not shown in "Read the transcript", so it must not be spoken either.
  function transcriptSections(script) {
    return script.sections.filter(s =>
      !/^(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع|narration|عنوان شنیداری)$/i.test(s.title.trim())
    );
  }

  function spoken(script) {
    const parts = [];
    for (const section of transcriptSections(script)) {
      const cue = editorialTitle(section.title, section.text);
      const text = section.text.trim();
      if (!text) continue;
      parts.push(cue ? cue + ' ' + text : text);
    }
    // Speech and transcript use exactly the same sections and editorial heading cues.
    return parts.join('\\n\\n').replace(/[ \\t]+\\n/g, '\\n').trim();
  }

  function readingEstimate(script) {
    const visibleText = transcriptSections(script)
      .map(s => [editorialTitle(s.title, s.text), s.text].filter(Boolean).join(' ') )
      .join(' ');
    const words = visibleText.match(/[\\p{L}\\p{M}\\p{N}]+(?:['’\\-][\\p{L}\\p{M}\\p{N}]+)*/gu) || [];
    const persian = /[\\u0600-\\u06ff]/.test(visibleText);
    const minutes = Math.max(1, Math.ceil(words.length / (persian ? 180 : 200)));
    return { words: words.length, minutes };
  }

  function speechPieces(text, maxChars = 1100) {
    const pieces = [];
    for (const paragraph of text.split(/\n{2,}/)) {
      let remaining = paragraph.trim();
      while (remaining.length > maxChars) {
        let cut = Math.max(
          remaining.lastIndexOf('. ', maxChars),
          remaining.lastIndexOf('! ', maxChars),
          remaining.lastIndexOf('? ', maxChars),
          remaining.lastIndexOf('؟ ', maxChars),
          remaining.lastIndexOf('۔ ', maxChars)
        );
        if (cut < Math.floor(maxChars * 0.45)) cut = remaining.lastIndexOf(' ', maxChars);
        if (cut < 1) cut = maxChars;
        pieces.push(remaining.slice(0, cut + 1).trim());
        remaining = remaining.slice(cut + 1).trim();
      }
      if (remaining) pieces.push(remaining);
    }
    return pieces.filter(Boolean);
  }

  function stop(button) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.generation++;
    state.utterance = null;
    state.utterances = [];
    state.remaining = 0;
    state.playing = false;
    if (button) { button.textContent='▶ Listen & Learn'; button.dataset.playing='false'; }
  }

  function add(entry, script, key) {
    const hero=document.querySelector('.unit-hero');
    if (!hero || document.querySelector('.listen-learn')) return;
    const section=document.createElement('section');
    section.className='section listen-learn'; section.id='listen-learn'; section.dataset.unitKey=key;
    const visibleSections = transcriptSections(script);
    const estimate = readingEstimate(script);
    section.innerHTML='<div class="card panel narration-card"><div class="num">Listen & Learn</div><h2>'+esc(script.title||entry.title||'Unit narration')+'</h2><p class="meta-line">A guided narration with explanation, connections and reflection. The spoken content matches the transcript below.</p><p class="meta-line narration-reading-time">Estimated reading time: about '+estimate.minutes+' min · '+estimate.words.toLocaleString()+' words</p><div class="actions narration-actions"><button class="btn primary" type="button" data-play>▶ Listen & Learn</button><button class="btn" type="button" data-transcript>Show transcript</button></div><details class="narration-transcript"><summary>Read the transcript</summary><div class="narration-body">'+visibleSections.map(s=>'<h3>'+esc(editorialTitle(s.title, s.text)||s.title)+'</h3><p>'+esc(s.text).replace(/\n\n/g,'</p><p>').replace(/\n/g,' ')+'</p>').join('')+'</div></details></div>';
    hero.insertAdjacentElement('afterend',section);
    const play=section.querySelector('[data-play]');
    play.addEventListener('click',()=>{
      if(state.playing){stop(play);return;}
      if(!('speechSynthesis' in window)){play.textContent='Browser narration unavailable';return;}
      const text=spoken(script), pieces=speechPieces(text);
      if(!pieces.length)return;
      const lang=/[\u0600-\u06ff]/.test(text)?'fa-IR':'en-US';
      const generation=++state.generation;
      state.utterances=pieces.map(piece=>{
        const u=new SpeechSynthesisUtterance(piece);
        u.lang=lang; u.rate=0.92;
        return u;
      });
      state.remaining=state.utterances.length; state.playing=true;
      play.textContent='■ Stop listening'; play.dataset.playing='true';
      // Queue one utterance at a time. Some browsers silently drop items when a
      // long list is submitted at once, which can make the voice stop mid-script.
      const speakNext=()=>{
        if(generation!==state.generation)return;
        const utterance=state.utterances.shift();
        if(!utterance){
          state.utterance=null; state.remaining=0; state.playing=false;
          play.textContent='▶ Listen & Learn'; play.dataset.playing='false';
          return;
        }
        state.utterance=utterance;
        utterance.onend=()=>{
          if(generation!==state.generation)return;
          state.remaining=Math.max(0,state.remaining-1);
          speakNext();
        };
        utterance.onerror=()=>{if(generation===state.generation)stop(play);};
        window.speechSynthesis.speak(utterance);
      };
      speakNext();
    });
    section.querySelector('[data-transcript]').addEventListener('click',e=>{const d=section.querySelector('details');d.open=!d.open;e.currentTarget.textContent=d.open?'Hide transcript':'Show transcript';});
  }

  async function enhance() {
    const id = unitId(); const key = id ? `${bookId()}::${id}` : null;
    const panel = document.querySelector('.listen-learn');
    // A client-side route can replace a unit without pagehide firing.
    if (state.currentKey !== key) { stop(); panel?.remove(); state.currentKey = key; state.loadingKey = null; }
    if (!id || !document.querySelector('.unit-hero')) return;
    const existing = document.querySelector('.listen-learn');
    if (existing?.dataset.unitKey === key || state.loadingKey === key) return;
    state.loadingKey = key;
    try {
      const m = await getManifest(), b = m && m.books && m.books[bookId()], entry = b && b.units && b.units[id];
      if (!entry) return;
      const r = await fetch(root + entry.script, { cache: 'no-store' });
      if (!r.ok || key !== `${bookId()}::${unitId()}` || state.currentKey !== key) return;
      add(entry, parse(await r.text()), key);
    } catch (_) { /* Narration is optional; a failed fetch must not break the unit. */ }
    finally { if (state.loadingKey === key) state.loadingKey = null; }
  }
  const app=document.getElementById('app')||document.body;
  const routeChanged = () => { enhance(); };
  new MutationObserver(enhance).observe(app,{childList:true,subtree:true});
  window.addEventListener('popstate', routeChanged); window.addEventListener('hashchange', routeChanged);
  for (const method of ['pushState', 'replaceState']) { const original = history[method]; history[method] = function(...args) { const result = original.apply(this, args); window.dispatchEvent(new Event('narration:routechange')); return result; }; }
  window.addEventListener('narration:routechange', routeChanged);
  enhance(); window.addEventListener('pagehide',()=>{stop();});
})();
