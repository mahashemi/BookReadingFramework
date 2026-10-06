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
  function parse(md) {
    const sections = [];
    let current = null;
    for (const line of md.split(/\r?\n/)) {
      const h = line.match(/^##\s+(.+)$/);
      if (h) { current = {title:h[1].trim(), text:''}; sections.push(current); }
      else if (current) current.text += (current.text ? '\n' : '') + line;
    }
    return {
      title: ((md.match(/^#\s+(.+)$/m) || [,'Listen & Learn'])[1]).trim(),
      sections: sections.filter(s => s.text.trim()).map(s => ({
        title:s.title,
        text:s.text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_>#]/g, '').replace(/\n{3,}/g, '\n\n').trim()
      }))
    };
  }
  function spoken(script) {
    return script.sections.filter(s => !/^source map/i.test(s.title)).map(s => s.text).join('\n\n');
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
    section.innerHTML='<div class="card panel narration-card"><div class="num">Listen & Learn</div><h2>'+esc(script.title||entry.title||'Unit narration')+'</h2><p class="meta-line">A guided narration with explanation, connections and reflection. Editorial labels are not read aloud.</p><div class="actions narration-actions"><button class="btn primary" type="button" data-play>▶ Listen & Learn</button><button class="btn" type="button" data-transcript>Show transcript</button></div><details class="narration-transcript"><summary>Read the transcript</summary><div class="narration-body">'+script.sections.map(s=>'<h3>'+esc(s.title)+'</h3><p>'+esc(s.text).replace(/\n\n/g,'</p><p>')+'</p>').join('')+'</div></details></div>';
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