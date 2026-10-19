(() => {
  'use strict';

  // Se usa únicamente la secuencia de notas compartida para la introducción.
  // No se transcriben ritmos, acompañamiento ni audio de la grabación.
  const INTRO = [
    { midi: 63, name: 'Re♯', full: 'Re sostenido', beats: 0.25, len: 0.25 },
    { midi: 64, name: 'Mi',  full: 'Mi natural', beats: 0.25, len: 0.25 },
    { midi: 66, name: 'Fa♯', full: 'Fa sostenido', beats: 0.25, len: 0.25 },
    { midi: 68, name: 'Sol♯', full: 'Sol sostenido', beats: 2, len: 1.75 },
    { midi: 71, name: 'Si',  full: 'Si natural', beats: 0.25, len: 0.25 },
    { midi: 69, name: 'La',  full: 'La natural', beats: 1, len: 1 },
    { midi: 68, name: 'Sol♯', full: 'Sol sostenido', beats: 0.75, len: 0.75 },
    { midi: 64, name: 'Mi',  full: 'Mi natural', beats: 0.25, len: 0.25 },
    { midi: 66, name: 'Fa♯', full: 'Fa sostenido', beats: 1.75, len: 1.5 },
    { midi: 63, name: 'Re♯', full: 'Re sostenido', beats: 0.25, len: 0.25 },
    { midi: 64, name: 'Mi',  full: 'Mi natural', beats: 2, len: 2 }
  ];

  const PHRASES = [
    { title: 'Primera parte', from: 0, to: 3 },
    { title: 'Segunda parte', from: 4, to: 8 },
    { title: 'Tercera parte', from: 9, to: 10 }
  ];

  const KEY_INFO = [
    { midi: 60, name: 'Do',  full: 'Do natural', kind: 'blanca' },
    { midi: 61, name: 'Do♯', full: 'Do sostenido', kind: 'negra', after: 0 },
    { midi: 62, name: 'Re',  full: 'Re natural', kind: 'blanca' },
    { midi: 63, name: 'Re♯', full: 'Re sostenido', kind: 'negra', after: 1 },
    { midi: 64, name: 'Mi',  full: 'Mi natural', kind: 'blanca' },
    { midi: 65, name: 'Fa',  full: 'Fa natural', kind: 'blanca' },
    { midi: 66, name: 'Fa♯', full: 'Fa sostenido', kind: 'negra', after: 3 },
    { midi: 67, name: 'Sol', full: 'Sol natural', kind: 'blanca' },
    { midi: 68, name: 'Sol♯',full: 'Sol sostenido', kind: 'negra', after: 4 },
    { midi: 69, name: 'La',  full: 'La natural', kind: 'blanca' },
    { midi: 70, name: 'La♯', full: 'La sostenido', kind: 'negra', after: 5 },
    { midi: 71, name: 'Si',  full: 'Si natural', kind: 'blanca' },
    { midi: 72, name: 'Do',  full: 'Do agudo natural', kind: 'blanca' }
  ];

  const HINTS = {
    63: 'Es una tecla negra entre Re y Mi: la segunda de las dos teclas negras.',
    64: 'Es una tecla blanca. Está justo a la derecha de la tecla negra Re♯.',
    66: 'Es una tecla negra entre Fa y Sol: la primera del grupo de tres teclas negras.',
    68: 'Es una tecla negra entre Sol y La: la segunda del grupo de tres teclas negras.',
    69: 'Es una tecla blanca entre Sol y Si. Busca el nombre «La» en el piano.',
    71: 'Es una tecla blanca justo antes de Do agudo, al final de las siete notas blancas.'
  };

  const $ = (selector) => document.querySelector(selector);
  const state = {
    current: 0,
    completed: new Set(),
    challenge: false,
    feedback: { text: 'Busca la tecla iluminada en el piano y tócala.', type: '' },
    playing: false,
    demoIndex: -1,
    pressedMidi: null,
    playToken: 0,
    nextTimer: null,
    keyTimer: null,
    audioContext: null
  };

  const phraseOf = (index) => PHRASES.findIndex((p) => index >= p.from && index <= p.to);
  const visibleIndex = () => state.playing && state.demoIndex >= 0 ? state.demoIndex : state.current;
  const noteKind = (midi) => KEY_INFO.find((k) => k.midi === midi)?.kind || 'tecla';
  const keyLabel = (midi) => KEY_INFO.find((k) => k.midi === midi)?.full || 'nota';

  function generateKeyboard() {
    const keyboard = $('#keyboard');
    KEY_INFO.filter((n) => n.kind === 'blanca').forEach((n) => keyboard.appendChild(makeKey(n)));
    KEY_INFO.filter((n) => n.kind === 'negra').forEach((n) => {
      const key = makeKey(n);
      // 8 teclas blancas: posición entre las dos blancas que rodean esta negra.
      key.style.left = `${((n.after + 1) / 8) * 100}%`;
      keyboard.appendChild(key);
    });
  }

  function makeKey(note) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `piano-key ${note.kind === 'blanca' ? 'white-key' : 'black-key'}`;
    button.dataset.midi = String(note.midi);
    button.setAttribute('aria-label', `Tocar ${note.full}, tecla ${note.kind}`);
    button.title = note.full;
    const label = document.createElement('span');
    label.className = 'key-name';
    label.textContent = note.name;
    button.appendChild(label);
    button.addEventListener('click', () => keyboardPress(note.midi));
    return button;
  }

  function generatePhrases() {
    const container = $('#phrases');
    container.innerHTML = '';
    PHRASES.forEach((phrase, phraseIndex) => {
      const row = document.createElement('div');
      row.className = `phrase-row ${phraseOf(visibleIndex()) === phraseIndex ? 'is-selected' : ''}`;
      const header = document.createElement('div');
      header.className = 'phrase-header';
      header.innerHTML = `<span class="phrase-index">${phraseIndex + 1}</span><span class="phrase-row-title">${phrase.title}</span><span class="phrase-status">${phrase.to - phrase.from + 1} notas</span>`;
      row.appendChild(header);
      const notes = document.createElement('div');
      notes.className = 'phrase-notes';
      for (let i = phrase.from; i <= phrase.to; i += 1) {
        const item = INTRO[i];
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.name;
        button.className = `note-chip ${visibleIndex() === i ? 'is-current' : ''} ${state.completed.has(i) ? 'is-completed' : ''}`;
        button.title = `Ir a la nota ${i + 1}: ${item.full}`;
        button.setAttribute('aria-label', `Ir a la nota ${i + 1} de 11: ${item.full}${state.completed.has(i) ? ', encontrada' : ''}`);
        if (visibleIndex() === i) button.setAttribute('aria-current', 'step');
        button.addEventListener('click', () => {
          selectNote(i);
          soundNote(item.midi, .65);
          flashKey(item.midi);
        });
        notes.appendChild(button);
      }
      row.appendChild(notes);
      container.appendChild(row);
    });
  }

  function renderProgress() {
    $('#progress-label').textContent = `${state.completed.size} de 11 encontradas`;
    const progress = $('#progress-dots');
    progress.innerHTML = '';
    INTRO.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = `progress-dot ${state.completed.has(i) ? 'is-completed' : ''} ${visibleIndex() === i ? 'is-current' : ''}`;
      dot.title = `Nota ${i + 1}: ${state.completed.has(i) ? 'encontrada' : 'pendiente'}`;
      progress.appendChild(dot);
    });
  }

  function renderTrainer() {
    const index = visibleIndex();
    const note = INTRO[index];
    $('#step-indicator').textContent = `NOTA ${index + 1} DE ${INTRO.length} · PARTE ${phraseOf(index) + 1}`;
    $('#target-note').textContent = note.name;
    $('#target-full-name').textContent = note.full;
    $('#note-description').textContent = HINTS[note.midi];
    $('#previous').disabled = state.current === 0;
    $('#next').innerHTML = state.current === INTRO.length - 1 ? 'Volver al inicio <span aria-hidden="true">↺</span>' : 'Siguiente nota <span aria-hidden="true">→</span>';
    $('#dock-current').textContent = note.name;
    $('#dock-name').textContent = `tecla ${noteKind(note.midi)}`;
    $('#keyboard-guidance').textContent = state.challenge ? 'Piano sin pistas: busca la nota por su nombre.' : 'La tecla violeta muestra qué nota buscar.';
    $('#mode-guided').classList.toggle('is-active', !state.challenge);
    $('#mode-guided').setAttribute('aria-pressed', String(!state.challenge));
    $('#mode-challenge').classList.toggle('is-active', state.challenge);
    $('#mode-challenge').setAttribute('aria-pressed', String(state.challenge));
    $('#keyboard').classList.toggle('hide-labels', state.challenge);
    const message = $('#answer-message');
    message.textContent = state.playing ? 'Escucha y observa la tecla rosada en el piano.' : state.feedback.text;
    message.className = `answer-message ${!state.playing && state.feedback.type ? 'is-' + state.feedback.type : ''}`;
    document.querySelectorAll('.piano-key').forEach((key) => {
      const midi = Number(key.dataset.midi);
      const isTarget = !state.challenge && !state.playing && midi === note.midi;
      key.classList.toggle('is-target', isTarget);
      key.classList.toggle('is-demo', state.playing && midi === INTRO[state.demoIndex]?.midi);
      key.classList.toggle('is-pressed', midi === state.pressedMidi);
    });
    $('#live-announcement').textContent = state.feedback.text;
  }

  function renderAll() { generatePhrases(); renderProgress(); renderTrainer(); }

  function stopPlayback(restoreButtons = true) {
    state.playToken += 1;
    state.playing = false;
    state.demoIndex = -1;
    if (restoreButtons) refreshPlaybackButtons();
  }

  function refreshPlaybackButtons() {
    $('#play-all').classList.toggle('is-playing', state.playing);
    $('#play-phrase').classList.toggle('is-playing', state.playing);
    $('.play-label').textContent = state.playing ? 'Detener reproducción' : 'Escuchar las 11 notas';
    $('#play-phrase').innerHTML = state.playing ? '<span aria-hidden="true">■</span> Detener' : '<span aria-hidden="true">♫</span> Escuchar esta parte';
  }

  function cancelNext() { if (state.nextTimer !== null) { clearTimeout(state.nextTimer); state.nextTimer = null; } }

  function selectNote(index) {
    stopPlayback();
    cancelNext();
    state.current = (index + INTRO.length) % INTRO.length;
    state.feedback = { text: state.challenge ? 'Busca la nota por su nombre. ¡Tú puedes!' : 'Busca la tecla iluminada en el piano y tócala.', type: '' };
    renderAll();
  }

  function flashKey(midi) {
    if (state.keyTimer !== null) clearTimeout(state.keyTimer);
    state.pressedMidi = midi;
    renderTrainer();
    state.keyTimer = setTimeout(() => { state.pressedMidi = null; renderTrainer(); }, 270);
  }

  function keyboardPress(midi) {
    if (state.playing) stopPlayback();
    cancelNext();
    soundNote(midi, .82);
    flashKey(midi);
    const target = INTRO[state.current];
    if (midi === target.midi) {
      state.completed.add(state.current);
      const last = state.current === INTRO.length - 1;
      const allFound = state.completed.size === INTRO.length;
      state.feedback = { text: allFound ? '¡Lo lograste! 🎉 Encontraste las 11 notas. Puedes repetirlas las veces que quieras.' : last ? '¡Muy bien! Encontraste la última nota. Puedes volver al inicio y seguir practicando.' : '¡Esa es! ✨ Vamos con la siguiente nota.', type: 'success' };
      renderAll();
      if (!last) {
        state.nextTimer = setTimeout(() => {
          state.nextTimer = null;
          state.current += 1;
          state.feedback = { text: state.challenge ? 'Busca esta nota sin pistas.' : 'Encuentra la siguiente tecla iluminada.', type: '' };
          renderAll();
        }, 720);
      }
    } else {
      const typed = keyLabel(midi);
      state.feedback = { text: state.challenge ? `Esa fue ${typed}. Busca ${target.name} y vuelve a intentar.` : `Tocaste ${typed}. La que buscamos ahora es ${target.name}. Fíjate en la tecla violeta.`, type: 'error' };
      renderTrainer();
    }
  }

  function audioContext() {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) return null;
    if (!state.audioContext) state.audioContext = new Constructor();
    if (state.audioContext.state === 'suspended') state.audioContext.resume().catch(() => {});
    return state.audioContext;
  }

  function soundNote(midi, duration = .76) {
    const ctx = audioContext();
    if (!ctx) {
      state.feedback = { text: 'Este navegador no permite reproducir sonido, pero puedes seguir practicando con el piano visual.', type: '' };
      renderTrainer();
      return;
    }
    try {
      const frequency = 440 * Math.pow(2, (midi - 69) / 12);
      const start = ctx.currentTime + .015;
      const harmonics = [
        { n: 1, level: .28, type: 'sine' },
        { n: 2, level: .115, type: 'sine' },
        { n: 3, level: .038, type: 'sine' }
      ];
      for (const { n, level, type } of harmonics) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency * n, start);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.linearRampToValueAtTime(level, start + .012);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0001, level * .31), start + .19);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + .04);
      }
    } catch (error) {
      console.warn('No se pudo reproducir la nota:', error);
    }
  }

  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function playRange(from, to) {
    if (state.playing) { stopPlayback(); renderTrainer(); return; }
    cancelNext();
    state.playing = true;
    const token = ++state.playToken;
    refreshPlaybackButtons();
    const beatMs = 60000 / (Number($('#pace').value) || 60);
    for (let i = from; i <= to; i += 1) {
      if (token !== state.playToken) return;
      state.demoIndex = i;
      soundNote(INTRO[i].midi, Math.max(.35, INTRO[i].len * beatMs / 1000 * .95));
      renderAll();
      await sleep(INTRO[i].beats * beatMs);
    }
    if (token === state.playToken) {
      state.playing = false;
      state.demoIndex = -1;
      refreshPlaybackButtons();
      renderAll();
    }
  }

  function bindActions() {
    $('#previous').addEventListener('click', () => selectNote(Math.max(0, state.current - 1)));
    $('#next').addEventListener('click', () => selectNote(state.current === INTRO.length - 1 ? 0 : state.current + 1));
    $('#listen-current').addEventListener('click', () => { soundNote(INTRO[state.current].midi); flashKey(INTRO[state.current].midi); });
    $('#play-all').addEventListener('click', () => playRange(0, INTRO.length - 1));
    $('#play-phrase').addEventListener('click', () => { const p = PHRASES[phraseOf(state.current)]; playRange(p.from, p.to); });
    $('#mode-guided').addEventListener('click', () => { state.challenge = false; selectNote(state.current); });
    $('#mode-challenge').addEventListener('click', () => { state.challenge = true; selectNote(state.current); });
    $('#reset').addEventListener('click', () => { state.completed.clear(); selectNote(0); });
    document.querySelectorAll('[data-focus]').forEach((button) => {
      button.addEventListener('click', () => {
        const i = INTRO.findIndex((note) => note.midi === Number(button.dataset.focus));
        if (i < 0) return;
        selectNote(i);
        soundNote(INTRO[i].midi);
        flashKey(INTRO[i].midi);
      });
    });
    // Opcional: en computador también se puede tocar el piano con el teclado físico.
    const keyMapping = { a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72 };
    document.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)) return;
      const midi = keyMapping[event.key.toLowerCase()];
      if (midi !== undefined) keyboardPress(midi);
    });
  }

  generateKeyboard();
  bindActions();
  renderAll();
})();
