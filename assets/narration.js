(() => {
  'use strict';
  const root = location.pathname.includes('/book/') ? '../' : '';
  const state = { manifest: null, utterance: null };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const bookId = () => new URLSearchParams(location.search).get('book_id') || 'book02';
  const unitId = () => new URLSearchParams(location.search).get('unit');

  async function getManifest() {
    if (state.manifest) return state.manifest;
    const r = await fetch(root + 'audio/manifest.json');
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
      'deep reading insight': persian ? 'حالا کمی عمیق‌تر به معنای این نکته نگاه کنیم.' : 'A broader point to consider.',
      'reflection': persian ? 'حالا کمی مکث کنیم و فکر کنیم.' : 'Now, pause and reflect.',
      'transition': persian ? 'با حرکت به بخش بعد، این پرسش را در ذهن نگه داریم.' : 'As we move forward, keep this question in mind.',
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

  function spoken(script) {
    const parts = [];
    for (const section of script.sections) {
      const key = section.title.trim().toLowerCase();
      if (/^(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع)$/i.test(key)) continue;
      const cue = editorialTitle(section.title, section.text);
      const text = section.text.trim();
      if (!text) continue;
      if (cue && cue !== section.title) parts.push(cue + ' ' + text);
      else if (cue) parts.push(cue + ' ' + text);
      else parts.push(text);
    }
    // One continuous narration gives speech synthesis natural sentence flow;
    // paragraph boundaries remain pauses, not spoken punctuation or bullets.
    return parts.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  function stop(button) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.utterance = null;
    if (button) { button.textContent='▶ Listen & Learn'; button.dataset.playing='false'; }
  }

  function add(entry, script) {
    const hero=document.querySelector('.unit-hero');
    if (!hero || document.querySelector('.listen-learn')) return;
    const section=document.createElement('section');
    section.className='section listen-learn'; section.id='listen-learn';
    const transcriptSections = script.sections.filter(s => !/^(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع)$/i.test(s.title) && !/^narration$/i.test(s.title));
    section.innerHTML='<div class="card panel narration-card"><div class="num">Listen & Learn</div><h2>'+esc(script.title||entry.title||'Unit narration')+'</h2><p class="meta-line">A guided narration with explanation, connections and reflection. Source-map IDs and editorial notes are kept out of the listening transcript.</p><div class="actions narration-actions"><button class="btn primary" type="button" data-play>▶ Listen & Learn</button><button class="btn" type="button" data-transcript>Show transcript</button></div><details class="narration-transcript"><summary>Read the transcript</summary><div class="narration-body">'+transcriptSections.map(s=>'<h3>'+esc(editorialTitle(s.title, s.text)||s.title)+'</h3><p>'+esc(s.text).replace(/\n\n/g,'</p><p>').replace(/\n/g,' ')+'</p>').join('')+'</div></details></div>';
    hero.insertAdjacentElement('afterend',section);
    const play=section.querySelector('[data-play]');
    play.addEventListener('click',()=>{
      if(state.utterance){stop(play);return;}
      if(!('speechSynthesis' in window)){play.textContent='Browser narration unavailable';return;}
      const text=spoken(script), u=new SpeechSynthesisUtterance(text);
      u.lang=/[\u0600-\u06ff]/.test(text)?'fa-IR':'en-US'; u.rate=0.92;
      u.onstart=()=>{state.utterance=u;play.textContent='■ Stop listening';play.dataset.playing='true';};
      u.onend=()=>{state.utterance=null;play.textContent='▶ Listen & Learn';play.dataset.playing='false';};
      u.onerror=()=>stop(play); window.speechSynthesis.speak(u);
    });
    section.querySelector('[data-transcript]').addEventListener('click',e=>{const d=section.querySelector('details');d.open=!d.open;e.currentTarget.textContent=d.open?'Hide transcript':'Show transcript';});
  }

  async function enhance() {
    const id=unitId(); if(!id||!document.querySelector('.unit-hero')||document.querySelector('.listen-learn'))return;
    try {
      const m=await getManifest(), b=m&&m.books&&m.books[bookId()], e=b&&b.units&&b.units[id]; if(!e)return;
      const r=await fetch(root+e.script); if(!r.ok)return; add(e,parse(await r.text()));
    } catch (_) {}
  }
  const app=document.getElementById('app')||document.body;
  new MutationObserver(enhance).observe(app,{childList:true,subtree:true}); enhance();
  window.addEventListener('pagehide',()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel();});
})();
