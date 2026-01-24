// game.js (fixed input + stable sizing for iPhone Chrome)
'use strict';

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
const SWAP_MS = 130;
const DROP_MS = 140;
const CASCADE_PAUSE_MS = 55;

const SPECIAL = {
  NONE: 'none',
  STRIPED_H: 'striped-h',
  STRIPED_V: 'striped-v',
  WRAPPED: 'wrapped',
  BOMB: 'bomb',
  CARGO: 'cargo',
};

const CARGO_BONUS = 250;
const CARGO_SPAWN_CHANCE = 0.06; // chance per cascade end to spawn if none exists
const COMBO_BONUS_STEP = 0.25;   // x1, x1.25, x1.5...

let board = [];   // {color:number, special:string, id:number} or null during clears
let tiles = [];   // DOM grid cells
let selected = null;
let busy = false;

let score = 0;
let movesLeft = MAX_MOVES;
let comboMult = 1;

let soundOn = true;
let audioCtx = null;

let uid = 1;

// Drag state
let drag = {
  active: false,
  pointerId: null,
  startCell: null,
  startX: 0,
  startY: 0,
};

const boardEl = document.getElementById('board');
const boardWrap = document.getElementById('boardWrap');

const scoreVal = document.getElementById('scoreVal');
const movesVal = document.getElementById('movesVal');
const comboVal = document.getElementById('comboVal');

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

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const inBounds = (r,c)=> r>=0 && r<ROWS && c>=0 && c<COLS;
const isAdjacent = (a,b)=> (Math.abs(a.r-b.r)+Math.abs(a.c-b.c))===1;

function setStatus(t){ statusBadge.textContent = t; }

let toastTimer = null;
function toast(msg){
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  srAnnounce.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(()=>toastEl.classList.remove('show'), 1200);
}

function ensureAudio(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
function clickBeep(){ beep(520, 0.035, 'sine', 0.03); }
function badBeep(){ beep(220, 0.08, 'sawtooth', 0.04); }
function scoreBeep(){
  beep(660, 0.05, 'triangle', 0.05);
  setTimeout(()=>beep(880, 0.05, 'triangle', 0.045), 55);
}

function randColor(){ return Math.floor(Math.random() * COLORS.length); }
function makeCell(color, special=SPECIAL.NONE){ return { color, special, id: uid++ }; }

function hexToRgba(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---- SIZING: clamp --tile based on real available size ---- */
function clampTileSize(){
  const wrapRect = boardWrap.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
  const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-pad')) || 14;

  // available inner size for the board (within card)
  const availW = Math.max(240, wrapRect.width);
  const availH = Math.max(240, wrapRect.height);

  // board = tile*8 + gap*7 + pad*2
  const maxTileW = Math.floor((availW - (gap*7) - (pad*2)) / 8);
  const maxTileH = Math.floor((availH - (gap*7) - (pad*2)) / 8);
  const tile = Math.max(30, Math.min(52, Math.min(maxTileW, maxTileH)));

  document.documentElement.style.setProperty('--tile', tile + 'px');
}

/* ---- BOARD GENERATION ---- */
function generateBoardNoMatches(){
  let tries = 0;
  while (tries++ < 2000){
    const b = Array.from({length: ROWS}, ()=>Array(COLS).fill(null));
    for (let r=0; r<ROWS; r++){
      for (let c=0; c<COLS; c++){
        let col = randColor();
        let safety = 0;
        while (safety++ < 25){
          const left1 = (c>=1) ? b[r][c-1]?.color : null;
          const left2 = (c>=2) ? b[r][c-2]?.color : null;
          const up1 = (r>=1) ? b[r-1][c]?.color : null;
          const up2 = (r>=2) ? b[r-2][c]?.color : null;
          const makesRow = (left1!==null && left2!==null && left1===col && left2===col);
          const makesCol = (up1!==null && up2!==null && up1===col && up2===col);
          if (!makesRow && !makesCol) break;
          col = randColor();
        }
        b[r][c] = makeCell(col);
      }
    }
    board = b;
    if (findMatches().matches.size === 0 && hasValidMove()) return;
  }
}

/* ---- DOM BUILD ---- */
function buildBoardDOM(){
  boardEl.innerHTML = '';
  tiles = Array.from({length: ROWS}, ()=>Array(COLS).fill(null));

  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const div = document.createElement('div');
      div.className = 'tile';
      div.setAttribute('role', 'gridcell');
      div.dataset.r = String(r);
      div.dataset.c = String(c);
      div.tabIndex = -1;

      const mark = document.createElement('div');
      mark.className = 'mark';
      div.appendChild(mark);

      boardEl.appendChild(div);
      tiles[r][c] = div;
    }
  }

  // Single unified input handlers on the board
  boardEl.addEventListener('pointerdown', onPointerDown, {passive:false});
  boardEl.addEventListener('pointermove', onPointerMove, {passive:false});
  boardEl.addEventListener('pointerup', onPointerUp, {passive:true});
  boardEl.addEventListener('pointercancel', onPointerUp, {passive:true});
}

function paintTile(el, cell){
  el.classList.remove('striped-h','striped-v','wrapped','bomb','cargo','selected','hint','clearing');

  if (cell.special === SPECIAL.CARGO){
    el.classList.add('cargo');
    el.style.background = `linear-gradient(180deg, #ffe46b, #ff9f2c)`;
    el.style.boxShadow = `0 14px 26px rgba(0,0,0,.45), 0 0 18px rgba(255,230,120,.22)`;
  } else {
    const col = COLORS[cell.color];
    el.style.background = `linear-gradient(180deg, ${col.b}, ${col.a})`;
    el.style.boxShadow = `0 10px 22px rgba(0,0,0,.35), 0 0 18px ${hexToRgba(col.a, 0.16)}`;
  }

  if (cell.special === SPECIAL.STRIPED_H) el.classList.add('striped-h');
  if (cell.special === SPECIAL.STRIPED_V) el.classList.add('striped-v');
  if (cell.special === SPECIAL.WRAPPED) el.classList.add('wrapped');
  if (cell.special === SPECIAL.BOMB) el.classList.add('bomb');
}

function render(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      paintTile(tiles[r][c], board[r][c]);
    }
  }
  if (selected){
    tiles[selected.r][selected.c].classList.add('selected');
  }
  updateHUD();
}

function updateHUD(){
  scoreVal.textContent = String(score);
  movesVal.textContent = String(movesLeft);
  comboVal.textContent = `x${comboMult.toFixed(2).replace(/\.00$/,'')}`;
  soundBtn.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
}

function clearSelection(){
  selected = null;
}

/* ---- MATCHING ---- */
function findMatches(){
  const matches = new Set();
  const groups = [];

  // horizontal
  for (let r=0; r<ROWS; r++){
    let runStart = 0;
    for (let c=1; c<=COLS; c++){
      const prev = board[r][c-1];
      const cur = (c<COLS) ? board[r][c] : null;

      const sameColor =
        c<COLS &&
        prev && cur &&
        prev.special !== SPECIAL.CARGO &&
        cur.special !== SPECIAL.CARGO &&
        prev.color === cur.color;

      if (!sameColor){
        const len = c - runStart;
        if (len >= 3){
          const color = board[r][runStart].color;
          const cells = [];
          for (let k=runStart; k<c; k++){
            matches.add(`${r},${k}`);
            cells.push({r,c:k});
          }
          groups.push({cells, dir:'h', len, color});
        }
        runStart = c;
      }
    }
  }

  // vertical
  for (let c=0; c<COLS; c++){
    let runStart = 0;
    for (let r=1; r<=ROWS; r++){
      const prev = board[r-1][c];
      const cur = (r<ROWS) ? board[r][c] : null;

      const sameColor =
        r<ROWS &&
        prev && cur &&
        prev.special !== SPECIAL.CARGO &&
        cur.special !== SPECIAL.CARGO &&
        prev.color === cur.color;

      if (!sameColor){
        const len = r - runStart;
        if (len >= 3){
          const color = board[runStart][c].color;
          const cells = [];
          for (let k=runStart; k<r; k++){
            matches.add(`${k},${c}`);
            cells.push({r:k,c});
          }
          groups.push({cells, dir:'v', len, color});
        }
        runStart = r;
      }
    }
  }

  return { matches, groups };
}

function swapInBoard(a,b){
  const t = board[a.r][a.c];
  board[a.r][a.c] = board[b.r][b.c];
  board[b.r][b.c] = t;
}

function hasValidMove(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const a = {r,c};
      const neigh = [{r, c:c+1},{r:r+1, c}];
      for (const b of neigh){
        if (!inBounds(b.r,b.c)) continue;
        swapInBoard(a,b);
        const ok = findMatches().matches.size > 0;
        swapInBoard(a,b);
        if (ok) return true;
      }
    }
  }
  return false;
}

/* ---- SPECIAL CREATION (from initial swap only) ---- */
function pickSpecialFromGroups(groups, swapA, swapB){
  const keyA = `${swapA.r},${swapA.c}`;
  const keyB = `${swapB.r},${swapB.c}`;

  const seen = new Map(); // key -> {h,v}
  for (const g of groups){
    for (const p of g.cells){
      const k = `${p.r},${p.c}`;
      const cur = seen.get(k) || {h:false,v:false};
      if (g.dir==='h') cur.h = true;
      if (g.dir==='v') cur.v = true;
      seen.set(k, cur);
    }
  }

  const overlaps = [];
  for (const [k,v] of seen.entries()){
    if (v.h && v.v) overlaps.push(k);
  }
  if (overlaps.length){
    const placeKey =
      (seen.get(keyA)?.h && seen.get(keyA)?.v) ? keyA :
      (seen.get(keyB)?.h && seen.get(keyB)?.v) ? keyB :
      overlaps[0];
    const [r,c] = placeKey.split(',').map(Number);
    return {r,c,special:SPECIAL.WRAPPED};
  }

  const five = groups.find(g=>g.len>=5);
  if (five){
    const placeKey = seen.has(keyA) ? keyA : (seen.has(keyB) ? keyB : `${five.cells[Math.floor(five.cells.length/2)].r},${five.cells[Math.floor(five.cells.length/2)].c}`);
    const [r,c] = placeKey.split(',').map(Number);
    return {r,c,special:SPECIAL.BOMB};
  }

  const four = groups.find(g=>g.len===4);
  if (four){
    const placeKey = seen.has(keyA) ? keyA : (seen.has(keyB) ? keyB : `${four.cells[1].r},${four.cells[1].c}`);
    const [r,c] = placeKey.split(',').map(Number);
    return {r,c,special: (four.dir==='h' ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V)};
  }

  return null;
}

/* ---- SPECIAL ACTIVATION EXPANSION ---- */
function expandSpecialClear(clearSet){
  let changed = true;
  while (changed){
    changed = false;
    const keys = Array.from(clearSet);
    for (const key of keys){
      const [r,c] = key.split(',').map(Number);
      const cell = board[r]?.[c];
      if (!cell) continue;
      if (cell.special === SPECIAL.CARGO) continue;

      if (cell.special === SPECIAL.STRIPED_H){
        for (let cc=0; cc<COLS; cc++){
          const k = `${r},${cc}`;
          if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
        }
        cell.special = SPECIAL.NONE;
      } else if (cell.special === SPECIAL.STRIPED_V){
        for (let rr=0; rr<ROWS; rr++){
          const k = `${rr},${c}`;
          if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
        }
        cell.special = SPECIAL.NONE;
      } else if (cell.special === SPECIAL.WRAPPED){
        for (let rr=r-1; rr<=r+1; rr++){
          for (let cc=c-1; cc<=c+1; cc++){
            if (!inBounds(rr,cc)) continue;
            const k = `${rr},${cc}`;
            if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
          }
        }
        cell.special = SPECIAL.NONE;
      } else if (cell.special === SPECIAL.BOMB){
        const target = cell.color;
        for (let rr=0; rr<ROWS; rr++){
          for (let cc=0; cc<COLS; cc++){
            const other = board[rr][cc];
            if (other && other.special !== SPECIAL.CARGO && other.color === target){
              const k = `${rr},${cc}`;
              if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
            }
          }
        }
        cell.special = SPECIAL.NONE;
      }
    }
  }
}

/* ---- ANIMATION ---- */
async function animateSwap(a,b){
  const elA = tiles[a.r][a.c];
  const elB = tiles[b.r][b.c];

  const dx = b.c - a.c;
  const dy = b.r - a.r;

  const tilePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const gapPx  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
  const stepX = dx * (tilePx + gapPx);
  const stepY = dy * (tilePx + gapPx);

  elA.style.transition = `transform ${SWAP_MS}ms ease`;
  elB.style.transition = `transform ${SWAP_MS}ms ease`;
  elA.style.transform = `translate3d(${stepX}px, ${stepY}px, 0)`;
  elB.style.transform = `translate3d(${-stepX}px, ${-stepY}px, 0)`;

  await sleep(SWAP_MS);

  elA.style.transition = '';
  elB.style.transition = '';
  elA.style.transform = 'translate3d(0,0,0)';
  elB.style.transform = 'translate3d(0,0,0)';
}

async function animateDrop(moves){
  const tilePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const gapPx  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;

  for (const m of moves){
    const dest = tiles[m.toR][m.c];
    const delta = (m.fromR - m.toR) * (tilePx + gapPx);
    dest.style.transition = '';
    dest.style.transform = `translate3d(0, ${delta}px, 0)`;
  }

  boardEl.getBoundingClientRect();

  for (const m of moves){
    const dest = tiles[m.toR][m.c];
    dest.style.transition = `transform ${DROP_MS}ms ease`;
    dest.style.transform = 'translate3d(0,0,0)';
  }

  await sleep(DROP_MS);

  for (const m of moves){
    tiles[m.toR][m.c].style.transition = '';
  }
}

/* ---- CLEAR / DROP / REFILL ---- */
async function clearMatches(clearSet){
  if (clearSet.size === 0) return 0;

  expandSpecialClear(clearSet);

  for (const key of clearSet){
    const [r,c] = key.split(',').map(Number);
    tiles[r][c].classList.add('clearing');
  }

  const cleared = clearSet.size;
  const basePoints = cleared * 10;
  const points = Math.round(basePoints * comboMult);
  score += points;
  scoreBeep();

  await sleep(190);

  for (const key of clearSet){
    const [r,c] = key.split(',').map(Number);
    const cell = board[r][c];
    if (!cell) continue;
    if (cell.special === SPECIAL.CARGO) continue;
    board[r][c] = null;
  }

  toast(`+${points} points`);
  return cleared;
}

function dropTiles(){
  const moves = [];
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

function hasCargo(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      if (board[r][c] && board[r][c].special === SPECIAL.CARGO) return true;
    }
  }
  return false;
}

function trySpawnCargo(){
  if (hasCargo()) return;
  if (Math.random() > CARGO_SPAWN_CHANCE) return;
  const c = Math.floor(Math.random() * COLS);
  if (board[0][c] === null){
    board[0][c] = makeCell(0, SPECIAL.CARGO);
  }
}

function refillTiles(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      if (board[r][c] === null){
        board[r][c] = makeCell(randColor(), SPECIAL.NONE);
      }
    }
  }
}

function checkCargoBottom(){
  for (let c=0; c<COLS; c++){
    const cell = board[ROWS-1][c];
    if (cell && cell.special === SPECIAL.CARGO){
      const bonus = Math.round(CARGO_BONUS * comboMult);
      score += bonus;
      toast(`Cargo delivered! +${bonus}`);
      beep(780, 0.06, 'triangle', 0.05);
      board[ROWS-1][c] = null;
      return true;
    }
  }
  return false;
}

/* ---- RESOLVE CASCADES ---- */
async function resolveBoard(swapA=null, swapB=null){
  setStatus('Cascading');
  let cascades = 0;
  comboMult = 1;

  for (let loop=0; loop<40; loop++){
    const { matches, groups } = findMatches();
    if (matches.size === 0) break;

    cascades++;
    comboMult = 1 + (cascades - 1) * COMBO_BONUS_STEP;

    // create special only on first cascade after a player swap
    if (cascades === 1 && swapA && swapB){
      const placement = pickSpecialFromGroups(groups, swapA, swapB);
      if (placement){
        const k = `${placement.r},${placement.c}`;
        if (matches.has(k) && board[placement.r][placement.c].special !== SPECIAL.CARGO){
          matches.delete(k);
          board[placement.r][placement.c].special = placement.special;
          toast(
            placement.special === SPECIAL.BOMB ? 'Color Bomb created!' :
            placement.special === SPECIAL.WRAPPED ? 'Wrapped created!' :
            placement.special === SPECIAL.STRIPED_H ? 'Striped (Row) created!' :
            'Striped (Col) created!'
          );
          beep(740, 0.05, 'triangle', 0.045);
        }
      }
    }

    await clearMatches(matches);

    const moves = dropTiles();
    refillTiles();
    render();
    await animateDrop(moves);

    if (checkCargoBottom()){
      const moves2 = dropTiles();
      refillTiles();
      render();
      await animateDrop(moves2);
    }

    await sleep(CASCADE_PAUSE_MS);
  }

  trySpawnCargo();

  if (!hasValidMove()){
    // simple reshuffle: regenerate safely
    generateBoardNoMatches();
    render();
    toast('Board refreshed (no moves).');
  }

  setStatus('Ready');
  updateHUD();
}

/* ---- SWAP FLOW ---- */
async function trySwap(a,b){
  if (busy) return;
  if (!isAdjacent(a,b)) return;
  if (movesLeft <= 0){ endGame(); return; }

  busy = true;
  setStatus('Swapping');

  clickBeep();
  await animateSwap(a,b);
  swapInBoard(a,b);

  const { matches } = findMatches();
  if (matches.size === 0){
    badBeep();
    toast('Swap must create a match.');
    swapInBoard(a,b);
    await animateSwap(a,b);
    busy = false;
    setStatus('Ready');
    return;
  }

  movesLeft = Math.max(0, movesLeft - 1);
  clearSelection();
  render();

  await resolveBoard(a,b);

  busy = false;
  if (movesLeft <= 0) endGame();
}

function endGame(){
  setStatus('Done');
  finalScoreLine.textContent = `Final Score: ${score}`;
  overlayEl.classList.add('show');
  beep(300, 0.08, 'sine', 0.05);
  setTimeout(()=>beep(220, 0.10, 'sine', 0.04), 90);
}

function closeOverlay(){ overlayEl.classList.remove('show'); }

/* ---- INPUT: unified tap + drag ---- */
function getCellFromPoint(clientX, clientY){
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const tile = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const gap  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
  const pad  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-pad')) || 14;

  const innerX = x - pad;
  const innerY = y - pad;
  if (innerX < 0 || innerY < 0) return null;

  const step = tile + gap;
  const c = Math.floor(innerX / step);
  const r = Math.floor(innerY / step);

  const withinX = (innerX % step) <= tile;
  const withinY = (innerY % step) <= tile;

  if (!withinX || !withinY) return null;
  if (!inBounds(r,c)) return null;
  return {r,c};
}

function onPointerDown(e){
  e.preventDefault();
  if (busy) return;
  if (overlayEl.classList.contains('show')) return;

  if (soundOn) ensureAudio();

  const cell = getCellFromPoint(e.clientX, e.clientY);
  if (!cell) return;

  drag.active = true;
  drag.pointerId = e.pointerId;
  drag.startCell = cell;
  drag.startX = e.clientX;
  drag.startY = e.clientY;

  boardEl.setPointerCapture(e.pointerId);

  // tap-select behavior
  if (!selected){
    selected = cell;
  } else {
    if (selected.r === cell.r && selected.c === cell.c){
      selected = null;
    } else if (isAdjacent(selected, cell)){
      const a = selected;
      selected = null;
      render();
      trySwap(a, cell);
      return;
    } else {
      selected = cell;
    }
  }
  render();
  clickBeep();
}

function onPointerMove(e){
  if (!drag.active) return;
  if (busy) return;
  if (e.pointerId !== drag.pointerId) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  const tile = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const threshold = tile * 0.35;

  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

  // drag swap: determine direction from initial cell
  let dir;
  if (Math.abs(dx) > Math.abs(dy)){
    dir = dx > 0 ? {dr:0, dc:1} : {dr:0, dc:-1};
  } else {
    dir = dy > 0 ? {dr:1, dc:0} : {dr:-1, dc:0};
  }

  const a = drag.startCell;
  const b = { r: a.r + dir.dr, c: a.c + dir.dc };
  if (!inBounds(b.r,b.c)) return;

  drag.active = false;
  drag.pointerId = null;

  selected = null;
  render();
  trySwap(a,b);
}

function onPointerUp(e){
  if (!drag.active) return;
  if (e.pointerId !== drag.pointerId) return;
  drag.active = false;
  drag.pointerId = null;
}

/* ---- HINT (simple) ---- */
function findAnyValidMove(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const a = {r,c};
      const neighbors = [{r, c:c+1},{r:r+1, c},{r, c:c-1},{r:r-1, c}];
      for (const b of neighbors){
        if (!inBounds(b.r,b.c)) continue;
        swapInBoard(a,b);
        const ok = findMatches().matches.size > 0;
        swapInBoard(a,b);
        if (ok) return [a,b];
      }
    }
  }
  return null;
}

function showHint(){
  if (busy) return;
  if (overlayEl.classList.contains('show')) return;

  const pair = findAnyValidMove();
  if (!pair){
    toast('No moves. Refreshing board.');
    generateBoardNoMatches();
    render();
    return;
  }
  toast('Try swapping those two tiles.');
  beep(740, 0.05, 'triangle', 0.04);
}

/* ---- INIT ---- */
function init(){
  clampTileSize();

  score = 0;
  movesLeft = MAX_MOVES;
  comboMult = 1;
  selected = null;
  busy = false;
  closeOverlay();
  setStatus('Ready');

  generateBoardNoMatches();
  // sometimes start with cargo
  if (Math.random() < 0.55){
    const c = Math.floor(Math.random() * COLS);
    board[0][c] = makeCell(0, SPECIAL.CARGO);
  }

  buildBoardDOM();
  render();

  toast('New game started.');
}

// Buttons
newBtn.addEventListener('click', () => init());
hintBtn.addEventListener('click', () => showHint());
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  render();
  toast(soundOn ? 'Sound on.' : 'Sound off.');
  if (soundOn) clickBeep();
});
playAgainBtn.addEventListener('click', () => init());
closeOverlayBtn.addEventListener('click', () => closeOverlay());

// Resize
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { clampTileSize(); }, 120);
});

// Start
init();