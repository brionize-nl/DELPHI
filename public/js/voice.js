// Browser recognition is optional; transcripts are drafts and never sent here.
(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = $('#btn-voice'); const status = $('#voice-status');
  if (!Recognition || !button) return;
  let recognition;
  try { recognition = new Recognition(); } catch { return; }
  button.hidden = false;
  recognition.lang = 'nl-NL'; recognition.continuous = false; recognition.interimResults = false;
  let listening = false;
  function idle() { listening=false; button.setAttribute('aria-pressed','false'); button.setAttribute('aria-label','Dicteren'); }
  recognition.onstart = () => { listening=true; button.setAttribute('aria-pressed','true'); button.setAttribute('aria-label','Stop dicteren'); status.textContent='Luisteren… Klik nogmaals om te stoppen.'; };
  recognition.onresult = event => {
    if(!listening)return;
    const chunks=[];
    for(let i=event.resultIndex || 0;i<event.results.length;i++) if(event.results[i].isFinal) chunks.push(event.results[i][0].transcript);
    const text=chunks.join(' ').trim();
    if(text) { const prefix=promptEl.selectionStart && !/\s$/.test(promptEl.value.slice(0,promptEl.selectionStart))?' ':''; promptEl.setRangeText(prefix+text,promptEl.selectionStart,promptEl.selectionEnd,'end'); autoResize(); promptEl.focus(); status.textContent='Tekst ingevoegd. Controleer en verstuur zelf.'; }
  };
  recognition.onerror = event => { idle(); status.textContent=({'not-allowed':'Microfoontoegang geweigerd. Controleer je browserinstellingen.','service-not-allowed':'Spraakherkenning is niet beschikbaar in deze browser.','no-speech':'Geen spraak herkend. Probeer opnieuw.','audio-capture':'Geen microfoon beschikbaar.',network:'Spraakherkenning niet bereikbaar. Probeer opnieuw.'}[event.error] || 'Dicteren gestopt. Probeer opnieuw.'); };
  recognition.onend = () => { idle(); if(status.textContent.startsWith('Luisteren')) status.textContent='Dicteren gestopt.'; };
  document.addEventListener('delphi:chat-draft-reset', () => {
    if(!listening)return;idle();try {recognition.abort();}catch {}status.textContent='Dicteren gestopt.';
  });
  button.addEventListener('click', () => {
    try {
      if(listening) recognition.stop();
      else { listening=true; status.textContent='Microfoon starten…'; recognition.start(); }
    } catch { idle(); status.textContent='Microfoon kon niet starten. Probeer opnieuw.'; }
  });
})();
