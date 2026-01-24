<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Color Swap Match-3</title>
  <style>
    :root{
      --bg0:#060710;
      --bg1:#0a0d1f;
      --panel: rgba(255,255,255,.06);
      --panel2: rgba(255,255,255,.10);
      --text: rgba(255,255,255,.92);
      --muted: rgba(255,255,255,.72);
      --muted2: rgba(255,255,255,.60);
      --good: #2de3a6;
      --warn: #ffcc00;
      --bad: #ff5a7a;
      --glow: rgba(120,160,255,.35);

      --tile: 44px; /* updated by JS to fit viewport */
      --gap: 8px;
      --radius: 14px;
      --board-pad: 14px;

      --shadow: 0 14px 40px rgba(0,0,0,.55);
      --shadow2: 0 8px 18px rgba(0,0,0,.45);
      --ring: 0 0 0 2px rgba(255,255,255,.35), 0 0 0 6px rgba(130,180,255,.18), 0 0 18px rgba(150,210,255,.20);
      --hintRing: 0 0 0 2px rgba(255,255,255,.30), 0 0 0 8px rgba(255,230,120,.16), 0 0 18px rgba(255,230,120,.28);
    }

    *{ box-sizing:border-box; }
    html,body{
      height:100%;
      margin:0;
      background: radial-gradient(1000px 800px at 50% -20%, rgba(120,160,255,.25), transparent 55%),
                  radial-gradient(900px 900px at 10% 20%, rgba(255,80,140,.15), transparent 55%),
                  radial-gradient(900px 900px at 90% 40%, rgba(50,235,180,.12), transparent 60%),
                  linear-gradient(180deg, var(--bg1), var(--bg0) 60%, #05050c);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      overflow:hidden; /* static, no scrollbars */
      touch-action: manipulation;
    }

    .app{
      height:100%;
      width:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom) 16px;
    }

    .frame{
      width:min(420px, 96vw);
      height:min(844px, 96vh);
      display:flex;
      flex-direction:column;
      gap: 12px;
    }

    header{
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05));
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: var(--shadow2);
      border-radius: 18px;
      padding: 14px 14px 12px;
      backdrop-filter: blur(10px);
    }

    h1{
      font-size: 18px;
      margin:0 0 8px 0;
      letter-spacing:.2px;
      display:flex;
      align-items:center;
      gap:10px;
      line-height:1.15;
    }

    .badge{
      font-size: 12px;
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.14);
      color: rgba(255,255,255,.88);
      box-shadow: 0 0 22px rgba(130,180,255,.12);
      white-space:nowrap;
    }

    .reasoning{
      font-size: 13px;
      color: var(--muted);
      margin: 0 0 10px 0;
      line-height:1.35;
    }

    .rulesWrap{
      display:grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .rulesTitle{
      font-size: 13px;
      margin:0;
      color: rgba(255,255,255,.88);
      display:flex;
      align-items:center;
      gap:8px;
    }

    ul.rules{
      margin: 6px 0 0 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height:1.35;
    }
    ul.rules li{ margin: 4px 0; }

    .hud{
      display:flex;
      gap: 10px;
      align-items:stretch;
      justify-content:space-between;
    }

    .pill{
      flex: 1;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.05));
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: var(--shadow2);
      backdrop-filter: blur(10px);
      min-width:0;
    }
    .pill strong{
      font-size: 14px;
      letter-spacing:.2px;
    }
    .pill .val{
      font-variant-numeric: tabular-nums;
      font-size: 15px;
      color: rgba(255,255,255,.92);
      text-shadow: 0 0 18px rgba(130,180,255,.15);
      white-space:nowrap;
    }

    .controls{
      display:flex;
      gap: 10px;
      align-items:center;
      justify-content:space-between;
    }

    button{
      appearance:none;
      border:0;
      cursor:pointer;
      user-select:none;
      -webkit-tap-highlight-color: transparent;
      padding: 10px 12px;
      border-radius: 14px;
      font-weight: 650;
      letter-spacing:.2px;
      color: rgba(255,255,255,.92);
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: var(--shadow2);
      transition: transform .06s ease, filter .06s ease;
      flex: 1;
      min-width:0;
    }
    button:active{ transform: translateY(1px) scale(.99); filter: brightness(1.08); }
    button.secondary{ background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05)); }
    button.good{
      background: linear-gradient(180deg, rgba(45,227,166,.28), rgba(45,227,166,.10));
      border-color: rgba(45,227,166,.35);
    }
    button.warn{
      background: linear-gradient(180deg, rgba(255,204,0,.24), rgba(255,204,0,.08));
      border-color: rgba(255,204,0,.32);
    }

    .subnote{
      margin: 0;
      text-align:center;
      font-size: 12px;
      color: var(--muted2);
      letter-spacing:.15px;
    }

    .boardCard{
      flex: 1;
      display:flex;
      align-items:center;
      justify-content:center;
      background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: var(--shadow);
      border-radius: 22px;
      padding: 14px;
      position:relative;
      overflow:hidden;
      backdrop-filter: blur(10px);
    }

    .boardGlow{
      position:absolute;
      inset:-40px;
      background: radial-gradient(400px 320px at 30% 20%, rgba(120,160,255,.20), transparent 60%),
                  radial-gradient(380px 360px at 70% 80%, rgba(255,80,140,.14), transparent 58%),
                  radial-gradient(420px 380px at 80% 25%, rgba(50,235,180,.12), transparent 58%);
      pointer-events:none;
      filter: blur(12px);
      opacity:.9;
    }

    .board{
      position:relative;
      width: calc(var(--tile) * 8 + var(--gap) * 7 + var(--board-pad) * 2);
      height: calc(var(--tile) * 8 + var(--gap) * 7 + var(--board-pad) * 2);
      padding: var(--board-pad);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.12));
      border: 1px solid rgba(255,255,255,.10);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), inset 0 0 40px rgba(0,0,0,.35);
      display:grid;
      grid-template-columns: repeat(8, var(--tile));
      grid-template-rows: repeat(8, var(--tile));
      gap: var(--gap);
      touch-action: none; /* pointer events for board */
    }

    .tile{
      width: var(--tile);
      height: var(--tile);
      border-radius: var(--radius);
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      transform: translate3d(0,0,0);
      transition: transform 140ms ease;
      will-change: transform, opacity, filter;
      box-shadow: 0 10px 20px rgba(0,0,0,.35);
      outline: none;
    }

    .tile::before{
      content:"";
      position:absolute;
      inset: 0;
      border-radius: var(--radius);
      background:
        radial-gradient(18px 18px at 30% 25%, rgba(255,255,255,.55), transparent 55%),
        radial-gradient(28px 20px at 70% 80%, rgba(0,0,0,.25), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0) 55%, rgba(0,0,0,.18));
      mix-blend-mode: overlay;
      pointer-events:none;
    }

    .tile::after{
      content:"";
      position:absolute;
      inset: -1px;
      border-radius: var(--radius);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.10);
      pointer-events:none;
    }

    .tile.selected{
      box-shadow: var(--shadow2), var(--ring);
      transform: translate3d(0,-2px,0) scale(1.03);
      z-index: 5;
    }

    .tile.hint{
      box-shadow: var(--shadow2), var(--hintRing);
      z-index: 4;
      animation: hintPulse 900ms ease-in-out infinite;
    }

    @keyframes hintPulse{
      0%,100%{ transform: translate3d(0,0,0) scale(1.00); filter: brightness(1.0); }
      50%{ transform: translate3d(0,-1px,0) scale(1.03); filter: brightness(1.12); }
    }

    .tile.clearing{
      animation: pop 180ms ease-out forwards;
    }
    @keyframes pop{
      from{ transform: scale(1); opacity:1; }
      to{ transform: scale(.75); opacity:0; }
    }

    .overlay{
      position:absolute;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      padding: 18px;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(8px);
      z-index: 20;
    }
    .overlay.show{ display:flex; }

    .modal{
      width: min(360px, 92%);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.16);
      box-shadow: var(--shadow);
      padding: 16px;
      text-align:center;
    }
    .modal h2{
      margin: 4px 0 8px 0;
      font-size: 18px;
      letter-spacing:.2px;
    }
    .modal p{
      margin: 0 0 14px 0;
      color: var(--muted);
      font-size: 13px;
      line-height:1.35;
    }
    .modal .scoreline{
      margin: 10px 0 14px 0;
      font-size: 14px;
      color: rgba(255,255,255,.90);
      font-variant-numeric: tabular-nums;
    }
    .modal .row{
      display:flex;
      gap: 10px;
      margin-top: 8px;
    }

    .toast{
      position:absolute;
      left:50%;
      bottom: 12px;
      transform: translateX(-50%);
      background: rgba(0,0,0,.52);
      border: 1px solid rgba(255,255,255,.14);
      color: rgba(255,255,255,.90);
      padding: 8px 10px;
      border-radius: 999px;
      font-size: 12px;
      box-shadow: var(--shadow2);
      opacity:0;
      pointer-events:none;
      transition: opacity 180ms ease, transform 180ms ease;
      z-index: 30;
    }
    .toast.show{
      opacity:1;
      transform: translateX(-50%) translateY(-4px);
    }

    .srOnly{
      position:absolute;
      width:1px;height:1px;
      padding:0;margin:-1px;
      overflow:hidden;clip:rect(0,0,0,0);
      white-space:nowrap;border:0;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="frame" role="application" aria-label="Color Swap Match-3 Game">
      <header>
        <h1>
          Hi, welcome to Color Swap Match-3!
          <span class="badge" id="statusBadge">Ready</span>
        </h1>

        <p class="reasoning">
          Reasoning: This game is about spotting patterns fast. You swap two adjacent tiles to line up 3 or more of the same color.
          When you create a match, those tiles pop away, the tiles above fall down, and new ones appear from the top. Your goal is to
          score as many points as you can before you run out of moves.
        </p>

        <div class="rulesWrap">
          <div>
            <p class="rulesTitle">Rules</p>
            <ul class="rules">
              <li>Tap a tile, then tap an adjacent tile to swap.</li>
              <li>Swaps must create a match of 3+ in a row or column, or they swap back.</li>
              <li>Matches clear, tiles fall down, and chain reactions keep scoring.</li>
              <li>You have a limited number of moves. Highest score wins.</li>
            </ul>
          </div>
        </div>
      </header>

      <div class="hud" aria-live="polite">
        <div class="pill">
          <strong>Score</strong>
          <div class="val" id="scoreVal">0</div>
        </div>
        <div class="pill">
          <strong>Moves</strong>
          <div class="val" id="movesVal">30</div>
        </div>
        <div class="pill">
          <strong>Sound</strong>
          <div class="val" id="soundVal">On</div>
        </div>
      </div>

      <div class="controls">
        <button class="secondary" id="newBtn" type="button" aria-label="Start a new game">New Game</button>
        <button class="warn" id="hintBtn" type="button" aria-label="Show a hint">Hint</button>
        <button class="good" id="soundBtn" type="button" aria-label="Toggle sound">Toggle Sound</button>
      </div>

      <p class="subnote" id="instructionLine">Tap two adjacent tiles to swap.</p>

      <div class="boardCard">
        <div class="boardGlow"></div>
        <div class="board" id="board" aria-label="Game board" role="grid"></div>

        <div class="overlay" id="overlay" aria-modal="true" role="dialog">
          <div class="modal">
            <h2 id="endTitle">Game Over</h2>
            <p id="endMsg">Nice run. Want another go?</p>
            <div class="scoreline" id="finalScoreLine">Final Score: 0</div>
            <div class="row">
              <button class="good" id="playAgainBtn" type="button">Play Again</button>
              <button class="secondary" id="closeOverlayBtn" type="button">Close</button>
            </div>
          </div>
        </div>

        <div class="toast" id="toast" role="status" aria-live="polite"></div>
        <span class="srOnly" id="srAnnounce" aria-live="polite"></span>
      </div>
    </div>
  </div>

  <script>
    'use strict';

    // =========================
    // Constants
    // =========================
    const ROWS = 8;
    const COLS = 8;
    const COLORS = [
      { name: 'Pink',   a: '#ff4fa3', b: '#ff7bd3' },
      { name: 'Cyan',   a: '#2ee8ff', b: '#67b7ff' },
      { name: 'Lime',   a: '#45ff9a', b: '#b6ff4d' },
      { name: 'Gold',   a: '#ffd84a', b: '#ff9e2c' },
      { name: 'Violet', a: '#b15cff', b: '#ff5bff' },
      { name: 'Coral',  a: '#ff5b5b', b: '#ff9a5b' },
    ];

    const MAX_MOVES = 30;
    const SWAP_MS = 140;
    const DROP_MS = 140;
    const CASCADE_PAUSE_MS = 60;

    // =========================
    // State
    // =========================
    let board = []; // ints 0..COLORS-1
    let tiles = []; // DOM nodes for each cell [r][c]
    let selected = null; // {r,c}
    let busy = false;
    let score = 0;
    let movesLeft = MAX_MOVES;
    let soundOn = true;

    // hint
    let hintPair = null; // [{r,c},{r,c}]
    let hintTimeout = null;

    // audio
    let audioCtx = null;

    // DOM
    const boardEl = document.getElementById('board');
    const scoreVal = document.getElementById('scoreVal');
    const movesVal = document.getElementById('movesVal');
    const soundVal = document.getElementById('soundVal');
    const statusBadge = document.getElementById('statusBadge');
    const toastEl = document.getElementById('toast');
    const srAnnounce = document.getElementById('srAnnounce');

    const newBtn = document.getElementById('newBtn');
    const hintBtn = document.getElementById('hintBtn');
    const soundBtn = document.getElementById('soundBtn');

    const overlayEl = document.getElementById('overlay');
    const finalScoreLine = document.getElementById('finalScoreLine');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const closeOverlayBtn = document.getElementById('closeOverlayBtn');

    // =========================
    // Helpers
    // =========================
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    function inBounds(r,c){ return r>=0 && r<ROWS && c>=0 && c<COLS; }

    function isAdjacent(a,b){
      const dr = Math.abs(a.r - b.r);
      const dc = Math.abs(a.c - b.c);
      return (dr + dc) === 1;
    }

    function setStatus(text){
      statusBadge.textContent = text;
    }

    let toastTimer = null;
    function toast(msg){
      clearTimeout(toastTimer);
      toastEl.textContent = msg;
      srAnnounce.textContent = msg;
      toastEl.classList.add('show');
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1200);
    }

    function ensureAudio(){
      if (!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    }

    function beep(freq=440, dur=0.06, type='sine', gain=0.04){
      if (!soundOn) return;
      try{
        ensureAudio();
        const t0 = audioCtx.currentTime;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.01);
      }catch(_){}
    }

    function scoreBeep(){
      beep(660, 0.05, 'triangle', 0.05);
      setTimeout(()=>beep(880, 0.05, 'triangle', 0.045), 55);
    }

    function badBeep(){
      beep(220, 0.08, 'sawtooth', 0.04);
    }

    function clickBeep(){
      beep(520, 0.035, 'sine', 0.03);
    }

    function clampTileSize(){
      const frame = document.querySelector('.frame');
      const header = frame.querySelector('header');
      const hud = frame.querySelector('.hud');
      const controls = frame.querySelector('.controls');
      const instruction = frame.querySelector('.subnote');

      // Available height for board card: total frame height - known elements - gaps
      const frameRect = frame.getBoundingClientRect();
      const used =
        header.getBoundingClientRect().height +
        hud.getBoundingClientRect().height +
        controls.getBoundingClientRect().height +
        instruction.getBoundingClientRect().height +
        12 * 4; // approximate gaps

      const boardCardPadding = 14 * 2; // boardCard internal padding top+bottom
      const boardOuter = frameRect.height - used - 12; // small slack
      const available = Math.max(260, boardOuter - boardCardPadding);

      // board size = tile*8 + gap*7 + pad*2
      const gap = 8;
      const pad = 14*2;
      const maxTileByHeight = Math.floor((available - (gap*7) - pad) / 8);
      const maxTileByWidth = Math.floor(((frameRect.width - 32) - (gap*7) - pad) / 8);
      const tile = Math.max(34, Math.min(52, Math.min(maxTileByHeight, maxTileByWidth)));

      document.documentElement.style.setProperty('--tile', tile + 'px');
    }

    function randColor(){
      return Math.floor(Math.random() * COLORS.length);
    }

    function wouldCreateMatch(r,c,color){
      // check local row/col at (r,c) as if set to color
      // horizontal count
      let count = 1;
      for (let cc=c-1; cc>=0 && board[r][cc]===color; cc--) count++;
      for (let cc=c+1; cc<COLS && board[r][cc]===color; cc++) count++;
      if (count>=3) return true;

      // vertical
      count = 1;
      for (let rr=r-1; rr>=0 && board[rr][c]===color; rr--) count++;
      for (let rr=r+1; rr<ROWS && board[rr][c]===color; rr++) count++;
      return count>=3;
    }

    function generateBoardNoMatches(){
      let tries = 0;
      while (tries++ < 2000){
        const b = Array.from({length: ROWS}, ()=>Array(COLS).fill(0));
        for (let r=0; r<ROWS; r++){
          for (let c=0; c<COLS; c++){
            let color = randColor();
            // prevent immediate matches
            let safety = 0;
            while (safety++ < 20){
              const left1 = (c>=1) ? b[r][c-1] : null;
              const left2 = (c>=2) ? b[r][c-2] : null;
              const up1 = (r>=1) ? b[r-1][c] : null;
              const up2 = (r>=2) ? b[r-2][c] : null;
              const makesRow = (left1 !== null && left2 !== null && left1 === color && left2 === color);
              const makesCol = (up1 !== null && up2 !== null && up1 === color && up2 === color);
              if (!makesRow && !makesCol) break;
              color = randColor();
            }
            b[r][c] = color;
          }
        }
        board = b;
        if (findMatches().size === 0 && hasValidMove()){
          return;
        }
      }
      // fallback: accept whatever, then clear
    }

    function buildBoardDOM(){
      boardEl.innerHTML = '';
      tiles = Array.from({length: ROWS}, ()=>Array(COLS).fill(null));

      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          const div = document.createElement('div');
          div.className = 'tile';
          div.setAttribute('role', 'gridcell');
          div.setAttribute('aria-label', `Tile ${r+1},${c+1}`);
          div.dataset.r = String(r);
          div.dataset.c = String(c);
          div.tabIndex = -1;

          div.addEventListener('pointerdown', onTilePointerDown, {passive:false});
          boardEl.appendChild(div);
          tiles[r][c] = div;
        }
      }
    }

    function paintTile(el, colorIndex){
      const col = COLORS[colorIndex];
      el.style.background = `linear-gradient(180deg, ${col.b}, ${col.a})`;
      el.style.boxShadow = `0 10px 22px rgba(0,0,0,.35), 0 0 20px rgba(255,255,255,.06), 0 0 18px ${hexToRgba(col.a, 0.16)}`;
      el.dataset.color = String(colorIndex);
      el.setAttribute('aria-label', `${col.name} tile`);
    }

    function hexToRgba(hex, a){
      const h = hex.replace('#','');
      const r = parseInt(h.substring(0,2),16);
      const g = parseInt(h.substring(2,4),16);
      const b = parseInt(h.substring(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    }

    function render(){
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          paintTile(tiles[r][c], board[r][c]);
          tiles[r][c].style.opacity = '1';
          tiles[r][c].classList.remove('clearing');
        }
      }
      clearHint();
      updateHUD();
    }

    function updateHUD(){
      scoreVal.textContent = String(score);
      movesVal.textContent = String(movesLeft);
      soundVal.textContent = soundOn ? 'On' : 'Off';
    }

    function clearSelection(){
      if (!selected) return;
      const el = tiles[selected.r][selected.c];
      el.classList.remove('selected');
      selected = null;
    }

    function clearHint(){
      if (hintTimeout){ clearTimeout(hintTimeout); hintTimeout = null; }
      hintPair = null;
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          tiles[r][c].classList.remove('hint');
        }
      }
    }

    function markHint(pair){
      clearHint();
      hintPair = pair;
      for (const p of pair){
        tiles[p.r][p.c].classList.add('hint');
      }
      hintTimeout = setTimeout(clearHint, 1800);
    }

    // =========================
    // Core match logic
    // =========================
    function findMatches(){
      // Return a Set of "r,c" keys to clear
      const clear = new Set();

      // rows
      for (let r=0; r<ROWS; r++){
        let runStart = 0;
        for (let c=1; c<=COLS; c++){
          const same = (c<COLS && board[r][c] === board[r][c-1]);
          if (!same){
            const runLen = c - runStart;
            if (runLen >= 3){
              for (let k=runStart; k<c; k++) clear.add(`${r},${k}`);
            }
            runStart = c;
          }
        }
      }

      // cols
      for (let c=0; c<COLS; c++){
        let runStart = 0;
        for (let r=1; r<=ROWS; r++){
          const same = (r<ROWS && board[r][c] === board[r-1][c]);
          if (!same){
            const runLen = r - runStart;
            if (runLen >= 3){
              for (let k=runStart; k<r; k++) clear.add(`${k},${c}`);
            }
            runStart = r;
          }
        }
      }

      return clear;
    }

    function swapInBoard(a,b){
      const tmp = board[a.r][a.c];
      board[a.r][a.c] = board[b.r][b.c];
      board[b.r][b.c] = tmp;
    }

    async function animateSwap(a,b){
      const elA = tiles[a.r][a.c];
      const elB = tiles[b.r][b.c];

      const dx = (b.c - a.c);
      const dy = (b.r - a.r);

      // translate by tile+gap
      const tilePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
      const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
      const stepX = dx * (tilePx + gapPx);
      const stepY = dy * (tilePx + gapPx);

      elA.style.transition = `transform ${SWAP_MS}ms ease`;
      elB.style.transition = `transform ${SWAP_MS}ms ease`;
      elA.style.transform = `translate3d(${stepX}px, ${stepY}px, 0)`;
      elB.style.transform = `translate3d(${-stepX}px, ${-stepY}px, 0)`;

      await sleep(SWAP_MS);

      // reset transforms
      elA.style.transition = '';
      elB.style.transition = '';
      elA.style.transform = 'translate3d(0,0,0)';
      elB.style.transform = 'translate3d(0,0,0)';
    }

    async function animateDrop(moves){
      // moves: array of {fromR, toR, c} for non-null tiles falling
      const tilePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
      const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;

      // Apply transforms to the tile DOM element that visually moves down.
      // We'll cheat: after updating board, re-render and animate by offsetting from previous positions.
      // Implementation: capture old colors, render new state, then animate tiles that changed row.
      // Since DOM cells are fixed, we animate the cell itself: offset up then ease to 0.
      // We can simulate by applying translateY on destination cells.

      for (const m of moves){
        const dest = tiles[m.toR][m.c];
        const delta = (m.fromR - m.toR) * (tilePx + gapPx); // negative means came from above
        dest.style.transition = '';
        dest.style.transform = `translate3d(0, ${delta}px, 0)`;
      }

      // force reflow
      boardEl.getBoundingClientRect();

      for (const m of moves){
        const dest = tiles[m.toR][m.c];
        dest.style.transition = `transform ${DROP_MS}ms ease`;
        dest.style.transform = 'translate3d(0,0,0)';
      }

      await sleep(DROP_MS);

      for (const m of moves){
        const dest = tiles[m.toR][m.c];
        dest.style.transition = '';
      }
    }

    async function clearMatches(clearSet){
      if (clearSet.size === 0) return 0;

      // mark clearing
      for (const key of clearSet){
        const [r,c] = key.split(',').map(Number);
        tiles[r][c].classList.add('clearing');
      }

      // sound + score
      const clearedCount = clearSet.size;
      const points = clearedCount * 10;
      score += points;
      scoreBeep();

      await sleep(190);

      // set cleared cells to null
      for (const key of clearSet){
        const [r,c] = key.split(',').map(Number);
        board[r][c] = null;
      }

      return clearedCount;
    }

    function dropTiles(){
      // For each column, compress non-null downward
      const moves = []; // track moves for animation
      for (let c=0; c<COLS; c++){
        let write = ROWS - 1;
        for (let r=ROWS-1; r>=0; r--){
          if (board[r][c] !== null){
            if (write !== r){
              board[write][c] = board[r][c];
              board[r][c] = null;
              moves.push({fromR:r, toR:write, c});
            }
            write--;
          }
        }
      }
      return moves;
    }

    function refillTiles(){
      // fill nulls at top with random colors
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          if (board[r][c] === null){
            board[r][c] = randColor();
          }
        }
      }
    }

    function hasValidMove(){
      // Try swapping each tile with right/down neighbor and check if any creates a match
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          const a = {r,c};
          const neighbors = [
            {r, c:c+1},
            {r:r+1, c}
          ];
          for (const b of neighbors){
            if (!inBounds(b.r,b.c)) continue;
            swapInBoard(a,b);
            const m = findMatches().size > 0;
            swapInBoard(a,b);
            if (m) return true;
          }
        }
      }
      return false;
    }

    function findAnyValidMove(){
      // Return a pair [{r,c},{r,c}] or null
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          const a = {r,c};
          const neighbors = [
            {r, c:c+1},
            {r, c:c-1},
            {r:r+1, c},
            {r:r-1, c},
          ];
          for (const b of neighbors){
            if (!inBounds(b.r,b.c)) continue;
            swapInBoard(a,b);
            const ok = findMatches().size > 0;
            swapInBoard(a,b);
            if (ok) return [a,b];
          }
        }
      }
      return null;
    }

    function reshuffleKeepScore(){
      // Flatten colors, shuffle, re-fill, ensure no matches and has move
      const flat = [];
      for (let r=0; r<ROWS; r++){
        for (let c=0; c<COLS; c++){
          flat.push(board[r][c]);
        }
      }

      for (let tries=0; tries<200; tries++){
        // Fisher-Yates
        for (let i=flat.length-1; i>0; i--){
          const j = Math.floor(Math.random() * (i+1));
          const t = flat[i]; flat[i] = flat[j]; flat[j] = t;
        }
        let idx = 0;
        for (let r=0; r<ROWS; r++){
          for (let c=0; c<COLS; c++){
            board[r][c] = flat[idx++];
          }
        }
        if (findMatches().size === 0 && hasValidMove()){
          toast('Board reshuffled (no moves).');
          beep(380, 0.06, 'sine', 0.035);
          return;
        }
      }

      // fallback: regenerate
      generateBoardNoMatches();
      toast('Board regenerated.');
    }

    // =========================
    // Game flow
    // =========================
    async function resolveBoard(){
      // clear any existing matches (cascades)
      setStatus('Cascading');
      let totalCleared = 0;
      for (let loop=0; loop<40; loop++){
        const matches = findMatches();
        if (matches.size === 0) break;

        totalCleared += await clearMatches(matches);

        // drop and refill
        const moves = dropTiles();
        refillTiles();

        // re-render with new colors, then animate drops
        render();
        await animateDrop(moves);
        await sleep(CASCADE_PAUSE_MS);
      }

      if (!hasValidMove()){
        reshuffleKeepScore();
        render();
      }

      if (totalCleared > 0){
        toast(`+${totalCleared * 10} points`);
      }

      setStatus('Ready');
    }

    async function trySwap(a,b){
      if (busy) return;
      if (!isAdjacent(a,b)) return;

      busy = true;
      clearHint();
      setStatus('Swapping');

      clickBeep();

      // animate visual swap first
      await animateSwap(a,b);

      // do swap in data
      swapInBoard(a,b);

      // validate
      const matches = findMatches();
      if (matches.size === 0){
        // swap back
        badBeep();
        toast('Swap must create a match.');
        swapInBoard(a,b);
        await animateSwap(a,b);
        busy = false;
        setStatus('Ready');
        return;
      }

      // valid move consumes a move
      movesLeft = Math.max(0, movesLeft - 1);
      updateHUD();

      // update UI for swapped state
      render();

      await resolveBoard();

      busy = false;

      if (movesLeft <= 0){
        endGame();
      }
    }

    function endGame(){
      setStatus('Done');
      finalScoreLine.textContent = `Final Score: ${score}`;
      overlayEl.classList.add('show');
      beep(300, 0.08, 'sine', 0.05);
      setTimeout(()=>beep(220, 0.10, 'sine', 0.04), 90);
    }

    function closeOverlay(){
      overlayEl.classList.remove('show');
    }

    function init(){
      clampTileSize();
      generateBoardNoMatches();
      buildBoardDOM();
      render();

      score = 0;
      movesLeft = MAX_MOVES;
      selected = null;
      busy = false;
      clearHint();
      closeOverlay();
      setStatus('Ready');
      updateHUD();

      // Make sure we start with no matches (safety pass)
      const pre = findMatches();
      if (pre.size > 0){
        // clear out quickly and re-resolve; very rare with generator, but safe
        resolveBoard();
      }

      // Ensure at least one move exists
      if (!hasValidMove()){
        reshuffleKeepScore();
        render();
      }

      toast('New game started.');
    }

    // =========================
    // Input handling
    // =========================
    function onTilePointerDown(e){
      e.preventDefault();
      if (busy) return;
      if (overlayEl.classList.contains('show')) return;

      const r = Number(e.currentTarget.dataset.r);
      const c = Number(e.currentTarget.dataset.c);

      // resume audio on first interaction
      if (soundOn) ensureAudio();

      if (movesLeft <= 0){
        endGame();
        return;
      }

      clearHint();

      // toggle selection
      if (!selected){
        selected = {r,c};
        tiles[r][c].classList.add('selected');
        clickBeep();
        return;
      }

      const prev = selected;
      if (prev.r === r && prev.c === c){
        tiles[r][c].classList.remove('selected');
        selected = null;
        return;
      }

      // if adjacent, attempt swap
      if (isAdjacent(prev, {r,c})){
        tiles[prev.r][prev.c].classList.remove('selected');
        selected = null;
        trySwap(prev, {r,c});
      } else {
        // move selection
        tiles[prev.r][prev.c].classList.remove('selected');
        selected = {r,c};
        tiles[r][c].classList.add('selected');
        clickBeep();
      }
    }

    // =========================
    // Hint
    // =========================
    function showHint(){
      if (busy) return;
      if (overlayEl.classList.contains('show')) return;

      clearSelection();
      const pair = findAnyValidMove();
      if (!pair){
        toast('No moves found. Reshuffling...');
        reshuffleKeepScore();
        render();
        return;
      }
      markHint(pair);
      toast('Hint highlighted.');
      beep(740, 0.05, 'triangle', 0.04);
    }

    // =========================
    // Buttons
    // =========================
    newBtn.addEventListener('click', () => init());

    hintBtn.addEventListener('click', () => showHint());

    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      updateHUD();
      toast(soundOn ? 'Sound on.' : 'Sound off.');
      if (soundOn) clickBeep();
    });

    playAgainBtn.addEventListener('click', () => init());
    closeOverlayBtn.addEventListener('click', () => closeOverlay());

    // =========================
    // Resize handling
    // =========================
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        clampTileSize();
      }, 120);
    });

    // =========================
    // Kickoff
    // =========================
    init();
  </script>
</body>
</html>