// game.js
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
const SWAP_MS = 130;
const DROP_MS = 140;
const CASCADE_PAUSE_MS = 55;

// Specials
// striped clears row/col, wrapped clears 3x3, bomb clears all of a color
const SPECIAL = {
  NONE: 'none',
  STRIPED_H: 'striped-h',
  STRIPED_V: 'striped-v',
  WRAPPED: 'wrapped',
  BOMB: 'bomb',
  CARGO: 'cargo', // big item to drop to bottom for bonus
};

const CARGO_BONUS = 250;
const CARGO_SPAWN_CHANCE_ON_REFILL = 0.06; // per refill cell, capped to 1 cargo
const COMBO_BONUS_STEP = 0.25; // x1, x1.25, x1.5...

// =========================
// State
// =========================
// Each cell is { color: number|null, special: string, id: number }
// cargo: color ignored; special=CARGO
let board = [];
let tiles = [];
let selected = null;
let busy = false;

let score = 0;
let movesLeft = MAX_MOVES;
let comboMult = 1;
let soundOn = true;

let hintPair = null;
let hintTimeout = null;

let audioCtx = null;

// Drag support (finger swap)
let drag = {
  active: false,
  startR: -1,
  startC: -1,
  startX: 0,
  startY: 0,
  lastOver: null,
  pointerId: null,
};

let uid = 1;

// =========================
// DOM
// =========================
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

// =========================
// Helpers
// =========================
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
function inBounds(r,c){ return r>=0 && r<ROWS && c>=0 && c<COLS; }
function isAdjacent(a,b){ return (Math.abs(a.r-b.r)+Math.abs(a.c-b.c))===1; }
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

function hexToRgba(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// Fit to iPhone Chrome viewport (portrait), no scroll: compute tile size
function clampTileSize(){
  const frame = document.querySelector('.frame');
  const header = frame.querySelector('header');
  const hud = frame.querySelector('.hud');
  const controls = frame.querySelector('.controls');
  const instruction = frame.querySelector('.subnote');

  const frameRect = frame.getBoundingClientRect();
  const used =
    header.getBoundingClientRect().height +
    hud.getBoundingClientRect().height +
    controls.getBoundingClientRect().height +
    instruction.getBoundingClientRect().height +
    10 * 4; // gaps

  const boardCardPadding = 12 * 2;
  const boardOuter = frameRect.height - used - 8;
  const available = Math.max(260, boardOuter - boardCardPadding);

  const gap = 8;
  const pad = 14*2;
  const maxTileByHeight = Math.floor((available - (gap*7) - pad) / 8);
  const maxTileByWidth = Math.floor(((frameRect.width - 28) - (gap*7) - pad) / 8);
  const tile = Math.max(34, Math.min(52, Math.min(maxTileByHeight, maxTileByWidth)));

  document.documentElement.style.setProperty('--tile', tile + 'px');
}

// =========================
// Board / DOM
// =========================
function makeCell(color, special = SPECIAL.NONE){
  return { color, special, id: uid++ };
}

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
        b[r][c] = makeCell(col, SPECIAL.NONE);
      }
    }
    board = b;
    if (findMatches().matches.size === 0 && hasValidMove()) return;
  }
}

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

      // Tap-to-select fallback
      div.addEventListener('pointerdown', onTilePointerDown, {passive:false});

      boardEl.appendChild(div);
      tiles[r][c] = div;
    }
  }

  // Drag swap from anywhere on board
  boardEl.addEventListener('pointerdown', onBoardPointerDown, {passive:false});
  boardEl.addEventListener('pointermove', onBoardPointerMove, {passive:false});
  boardEl.addEventListener('pointerup', onBoardPointerUp, {passive:true});
  boardEl.addEventListener('pointercancel', onBoardPointerUp, {passive:true});
}

function paintTile(el, cell){
  el.classList.remove('striped-h','striped-v','wrapped','bomb','cargo');

  // Cargo tile visual
  if (cell.special === SPECIAL.CARGO){
    el.classList.add('cargo');
    el.style.background = `linear-gradient(180deg, #ffe46b, #ff9f2c)`;
    el.style.boxShadow = `0 14px 26px rgba(0,0,0,.45), 0 0 18px rgba(255,230,120,.22)`;
    el.setAttribute('aria-label', 'Cargo tile');
  } else {
    const col = COLORS[cell.color];
    el.style.background = `linear-gradient(180deg, ${col.b}, ${col.a})`;
    el.style.boxShadow = `0 10px 22px rgba(0,0,0,.35), 0 0 20px rgba(255,255,255,.06), 0 0 18px ${hexToRgba(col.a, 0.16)}`;
    el.setAttribute('aria-label', `${col.name} tile`);
  }

  if (cell.special === SPECIAL.STRIPED_H) el.classList.add('striped-h');
  if (cell.special === SPECIAL.STRIPED_V) el.classList.add('striped-v');
  if (cell.special === SPECIAL.WRAPPED) el.classList.add('wrapped');
  if (cell.special === SPECIAL.BOMB) el.classList.add('bomb');
}

function render(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const cell = board[r][c];
      const el = tiles[r][c];
      paintTile(el, cell);
      el.style.opacity = '1';
      el.classList.remove('clearing');
    }
  }
  clearHint();
  updateHUD();
}

function updateHUD(){
  scoreVal.textContent = String(score);
  movesVal.textContent = String(movesLeft);
  comboVal.textContent = `x${comboMult.toFixed(2).replace(/\.00$/,'')}`;
  soundBtn.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
}

function clearSelection(){
  if (!selected) return;
  tiles[selected.r][selected.c].classList.remove('selected');
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
// Match detection + special creation
// =========================
function findMatches(){
  // returns:
  // - matches: Set("r,c") to clear
  // - groups: array of { cells:[{r,c}...], dir:'h'|'v'|'both', len, color }
  const matches = new Set();
  const groups = [];

  // horizontal groups
  for (let r=0; r<ROWS; r++){
    let runStart = 0;
    for (let c=1; c<=COLS; c++){
      const prev = board[r][c-1];
      const cur = (c<COLS) ? board[r][c] : null;

      const sameColor =
        c<COLS &&
        prev.special !== SPECIAL.CARGO &&
        cur.special !== SPECIAL.CARGO &&
        prev.color === cur.color;

      if (!sameColor){
        const runLen = c - runStart;
        if (runLen >= 3){
          const cells = [];
          const color = board[r][runStart].color;
          for (let k=runStart; k<c; k++){
            matches.add(`${r},${k}`);
            cells.push({r,c:k});
          }
          groups.push({ cells, dir:'h', len:runLen, color });
        }
        runStart = c;
      }
    }
  }

  // vertical groups
  for (let c=0; c<COLS; c++){
    let runStart = 0;
    for (let r=1; r<=ROWS; r++){
      const prev = board[r-1][c];
      const cur = (r<ROWS) ? board[r][c] : null;

      const sameColor =
        r<ROWS &&
        prev.special !== SPECIAL.CARGO &&
        cur.special !== SPECIAL.CARGO &&
        prev.color === cur.color;

      if (!sameColor){
        const runLen = r - runStart;
        if (runLen >= 3){
          const cells = [];
          const color = board[runStart][c].color;
          for (let k=runStart; k<r; k++){
            matches.add(`${k},${c}`);
            cells.push({r:k,c});
          }
          groups.push({ cells, dir:'v', len:runLen, color });
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

function pickSpecialFromGroups(groups, swapA, swapB){
  // Determine special creation from matched groups:
  // - 5+ in a line => Color Bomb at swapped tile position (prefer the tile involved)
  // - 4 in a line => Striped (dir-based) at swapped tile
  // - T/L (overlap) => Wrapped at swapped tile
  //
  // We'll compute:
  // - Find if any cell belongs to both a horizontal and vertical group => wrapped
  // - Else check for len>=5 or len==4
  const keyA = `${swapA.r},${swapA.c}`;
  const keyB = `${swapB.r},${swapB.c}`;

  const groupByKey = new Map(); // key -> {h:boolean, v:boolean}
  for (const g of groups){
    for (const p of g.cells){
      const k = `${p.r},${p.c}`;
      const cur = groupByKey.get(k) || {h:false,v:false};
      if (g.dir === 'h') cur.h = true;
      if (g.dir === 'v') cur.v = true;
      groupByKey.set(k, cur);
    }
  }

  // Wrapped if overlap exists; place at swapped tile if it is part of overlap, else first overlap.
  const overlaps = [];
  for (const [k,v] of groupByKey.entries()){
    if (v.h && v.v) overlaps.push(k);
  }
  if (overlaps.length){
    const placeKey = (groupByKey.get(keyA)?.h && groupByKey.get(keyA)?.v) ? keyA :
                     (groupByKey.get(keyB)?.h && groupByKey.get(keyB)?.v) ? keyB :
                     overlaps[0];
    const [r,c] = placeKey.split(',').map(Number);
    return { r, c, special: SPECIAL.WRAPPED };
  }

  // Bomb if 5+ exists
  const five = groups.find(g => g.len >= 5);
  if (five){
    const placeKey = groupByKey.has(keyA) ? keyA : groupByKey.has(keyB) ? keyB : `${five.cells[Math.floor(five.cells.length/2)].r},${five.cells[Math.floor(five.cells.length/2)].c}`;
    const [r,c] = placeKey.split(',').map(Number);
    return { r, c, special: SPECIAL.BOMB };
  }

  // Striped if 4 exists
  const four = groups.find(g => g.len === 4);
  if (four){
    const placeKey = groupByKey.has(keyA) ? keyA : groupByKey.has(keyB) ? keyB : `${four.cells[1].r},${four.cells[1].c}`;
    const [r,c] = placeKey.split(',').map(Number);
    return { r, c, special: (four.dir==='h' ? SPECIAL.STRIPED_H : SPECIAL.STRIPED_V) };
  }

  return null;
}

// =========================
// Special activation clearing
// =========================
function addToClearSet(clearSet, r, c){
  if (!inBounds(r,c)) return;
  clearSet.add(`${r},${c}`);
}

function expandSpecialClear(clearSet){
  // For any cell in clearSet that is special, expand the clear
  // Note: cargo does NOT clear by match; it only scores on reaching bottom.
  let changed = true;
  while (changed){
    changed = false;
    const keys = Array.from(clearSet);
    for (const key of keys){
      const [r,c] = key.split(',').map(Number);
      const cell = board[r][c];
      if (!cell) continue;
      if (cell.special === SPECIAL.CARGO) continue;

      if (cell.special === SPECIAL.STRIPED_H){
        for (let cc=0; cc<COLS; cc++){
          const k = `${r},${cc}`;
          if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
        }
        cell.special = SPECIAL.NONE; // consume
      } else if (cell.special === SPECIAL.STRIPED_V){
        for (let rr=0; rr<ROWS; rr++){
          const k = `${rr},${c}`;
          if (!clearSet.has(k)){ clearSet.add(k); changed = true; }
        }
        cell.special = SPECIAL.NONE;
      } else if (cell.special === SPECIAL.WRAPPED){
        for (let rr=r-1; rr<=r+1; rr++){
          for (let cc=c-1; cc<=c+1; cc++){
            const k = `${rr},${cc}`;
            if (inBounds(rr,cc) && !clearSet.has(k)){ clearSet.add(k); changed = true; }
          }
        }
        cell.special = SPECIAL.NONE;
      } else if (cell.special === SPECIAL.BOMB){
        // Bomb clears all of same color (based on current cell color)
        const targetColor = cell.color;
        for (let rr=0; rr<ROWS; rr++){
          for (let cc=0; cc<COLS; cc++){
            const other = board[rr][cc];
            if (other && other.special !== SPECIAL.CARGO && other.color === targetColor){
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

// =========================
// Animation helpers
// =========================
async function animateSwap(a,b){
  const elA = tiles[a.r][a.c];
  const elB = tiles[b.r][b.c];

  const dx = (b.c - a.c);
  const dy = (b.r - a.r);

  const tilePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
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
  const gapPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;

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

// =========================
// Clear / Drop / Refill + Cargo objective
// =========================
async function clearMatches(clearSet){
  if (clearSet.size === 0) return 0;

  // expand specials
  expandSpecialClear(clearSet);

  // mark clearing
  for (const key of clearSet){
    const [r,c] = key.split(',').map(Number);
    tiles[r][c].classList.add('clearing');
  }

  const clearedCount = clearSet.size;

  // scoring with combo multiplier
  const basePoints = clearedCount * 10;
  const points = Math.round(basePoints * comboMult);
  score += points;
  scoreBeep();

  await sleep(190);

  for (const key of clearSet){
    const [r,c] = key.split(',').map(Number);
    // Cargo never gets cleared by matches
    if (board[r][c].special === SPECIAL.CARGO) continue;
    board[r][c] = null;
  }

  toast(`+${points} points`);
  return clearedCount;
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

function maybeSpawnCargoOnce(){
  // Only one cargo on board at a time
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      if (board[r][c] && board[r][c].special === SPECIAL.CARGO) return;
    }
  }
  // Spawn at top row in a random column if empty; if not empty, skip
  const c = Math.floor(Math.random() * COLS);
  if (board[0][c] === null){
    board[0][c] = makeCell(0, SPECIAL.CARGO);
  }
}

function refillTiles(){
  // refill nulls with random colors
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      if (board[r][c] === null){
        board[r][c] = makeCell(randColor(), SPECIAL.NONE);
      }
    }
  }

  // chance to spawn cargo after refills (capped to one)
  if (Math.random() < 0.30) {
    if (Math.random() < CARGO_SPAWN_CHANCE_ON_REFILL * 10) maybeSpawnCargoOnce();
  }
}

function checkCargoAtBottom(){
  // If cargo reaches bottom row, award bonus and remove it.
  for (let c=0; c<COLS; c++){
    const cell = board[ROWS-1][c];
    if (cell && cell.special === SPECIAL.CARGO){
      score += Math.round(CARGO_BONUS * comboMult);
      toast(`Cargo delivered! +${Math.round(CARGO_BONUS * comboMult)} points`);
      beep(780, 0.06, 'triangle', 0.05);
      setTimeout(()=>beep(980, 0.06, 'triangle', 0.045), 60);
      board[ROWS-1][c] = null;
      return true;
    }
  }
  return false;
}

function hasValidMove(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const a = {r,c};
      const neighbors = [{r, c:c+1},{r:r+1, c}];
      for (const b of neighbors){
        if (!inBounds(b.r,b.c)) continue;

        // allow swaps even if cargo involved, but cargo never matches; still could enable match elsewhere
        swapInBoard(a,b);
        const ok = findMatches().matches.size > 0;
        swapInBoard(a,b);
        if (ok) return true;
      }
    }
  }
  return false;
}

function findAnyValidMove(){
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      const a = {r,c};
      const neighbors = [{r, c:c+1},{r, c:c-1},{r:r+1, c},{r:r-1, c}];
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

function reshuffleKeepScore(){
  const flat = [];
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<COLS; c++){
      flat.push(board[r][c]);
    }
  }

  for (let tries=0; tries<250; tries++){
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
    if (findMatches().matches.size === 0 && hasValidMove()){
      toast('Board reshuffled (no moves).');
      beep(380, 0.06, 'sine', 0.035);
      return;
    }
  }

  generateBoardNoMatches();
  toast('Board regenerated.');
}

// =========================
// Resolve cascades + combos + special creation
// =========================
async function resolveBoard(swapA=null, swapB=null){
  setStatus('Cascading');

  let cascades = 0;
  comboMult = 1;

  for (let loop=0; loop<40; loop++){
    const { matches, groups } = findMatches();
    if (matches.size === 0) break;

    cascades++;
    comboMult = 1 + (cascades - 1) * COMBO_BONUS_STEP;

    // Create special on first cascade from the swap move only
    if (cascades === 1 && swapA && swapB){
      const specialPlacement = pickSpecialFromGroups(groups, swapA, swapB);
      if (specialPlacement){
        const { r, c, special } = specialPlacement;
        // Only if that cell is being cleared by the match: keep tile, turn into special, remove from clear set
        const k = `${r},${c}`;
        if (matches.has(k) && board[r][c].special !== SPECIAL.CARGO){
          matches.delete(k);
          board[r][c].special = special;

          // If bomb: set color to a random visible color for "bomb color identity"
          // (Bomb uses its own color; keep current color from match)
          if (special === SPECIAL.BOMB){
            // keep color as-is
          }
          toast(
            special === SPECIAL.BOMB ? 'Color Bomb created!' :
            special === SPECIAL.WRAPPED ? 'Wrapped created!' :
            special === SPECIAL.STRIPED_H ? 'Striped (Row) created!' :
            'Striped (Col) created!'
          );
          beep(740, 0.05, 'triangle', 0.045);
        }
      }
    }

    await clearMatches(matches);

    // drop/refill
    const moves = dropTiles();
    refillTiles();

    // render then animate drop
    render();
    await animateDrop(moves);

    // cargo objective
    if (checkCargoAtBottom()){
      // drop again after removing cargo to settle
      const moves2 = dropTiles();
      refillTiles();
      render();
      await animateDrop(moves2);
    }

    await sleep(CASCADE_PAUSE_MS);
  }

  // Ensure playable
  if (!hasValidMove()){
    reshuffleKeepScore();
    render();
  }

  setStatus('Ready');
  updateHUD();
}

// =========================
// Swap flow
// =========================
async function trySwap(a,b){
  if (busy) return;
  if (!isAdjacent(a,b)) return;
  if (movesLeft <= 0) { endGame(); return; }

  busy = true;
  clearHint();
  setStatus('Swapping');

  clickBeep();

  // animate then swap data
  await animateSwap(a,b);
  swapInBoard(a,b);

  // validate match
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
  updateHUD();
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

// =========================
// Input: tap select + drag swap
// =========================
function onTilePointerDown(e){
  e.preventDefault();
  if (busy) return;
  if (overlayEl.classList.contains('show')) return;

  if (soundOn) ensureAudio();

  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);

  // Tap-to-select
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

  if (isAdjacent(prev, {r,c})){
    tiles[prev.r][prev.c].classList.remove('selected');
    selected = null;
    trySwap(prev, {r,c});
  } else {
    tiles[prev.r][prev.c].classList.remove('selected');
    selected = {r,c};
    tiles[r][c].classList.add('selected');
    clickBeep();
  }
}

function cellFromPoint(clientX, clientY){
  const rect = boardEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const tile = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44;
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 8;
  const pad = 14; // --board-pad is 14px; we use per side via CSS, but grid starts after padding
  // The grid container includes padding; so coordinates include padding.
  const innerX = x - pad;
  const innerY = y - pad;

  if (innerX < 0 || innerY < 0) return null;

  const step = tile + gap;
  const c = Math.floor(innerX / step);
  const r = Math.floor(innerY / step);

  // Must also be inside actual tile area (not in gap region)
  const withinTileX = (innerX % step) <= tile;
  const withinTileY = (innerY % step) <= tile;

  if (!withinTileX || !withinTileY) return null;
  if (!inBounds(r,c)) return null;
  return {r,c};
}

function onBoardPointerDown(e){
  if (busy) return;
  if (overlayEl.classList.contains('show')) return;
  if (e.button !== undefined && e.button !== 0) return;

  const p = cellFromPoint(e.clientX, e.clientY);
  if (!p) return;

  if (soundOn) ensureAudio();

  drag.active = true;
  drag.pointerId = e.pointerId;
  drag.startR = p.r;
  drag.startC = p.c;
  drag.startX = e.clientX;
  drag.startY = e.clientY;
  drag.lastOver = p;

  boardEl.setPointerCapture(e.pointerId);
  clearHint();

  // visual selection
  clearSelection();
  selected = {r:p.r, c:p.c};
  tiles[p.r][p.c].classList.add('selected');
}

function onBoardPointerMove(e){
  if (!drag.active) return;
  if (busy) return;
  if (e.pointerId !== drag.pointerId) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  const threshold = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 44) * 0.35;
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

  // Determine direction
  let dir = null;
  if (Math.abs(dx) > Math.abs(dy)){
    dir = dx > 0 ? {dr:0, dc:1} : {dr:0, dc:-1};
  } else {
    dir = dy > 0 ? {dr:1, dc:0} : {dr:-1, dc:0};
  }

  const a = {r:drag.startR, c:drag.startC};
  const b = {r:a.r + dir.dr, c:a.c + dir.dc};
  if (!inBounds(b.r,b.c)) return;

  // End drag immediately after one swap attempt
  drag.active = false;

  if (selected){
    tiles[selected.r][selected.c].classList.remove('selected');
    selected = null;
  }
  trySwap(a,b);
}

function onBoardPointerUp(e){
  if (!drag.active) return;
  if (e.pointerId !== drag.pointerId) return;
  drag.active = false;
  drag.pointerId = null;
  // keep selected for tap-based followup, but remove if no tap selection desired:
  // We'll clear selection to avoid "sticky" highlight after drag release.
  clearSelection();
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
// Init
// =========================
function init(){
  clampTileSize();
  score = 0;
  movesLeft = MAX_MOVES;
  comboMult = 1;
  selected = null;
  busy = false;
  clearHint();
  closeOverlay();
  setStatus('Ready');
  updateHUD();

  generateBoardNoMatches();
  buildBoardDOM();

  // Start with one cargo at top sometimes
  if (Math.random() < 0.55) {
    const c = Math.floor(Math.random() * COLS);
    board[0][c] = makeCell(0, SPECIAL.CARGO);
  }

  render();

  // Safety: resolve any accidental matches
  const pre = findMatches().matches;
  if (pre.size > 0) resolveBoard();

  if (!hasValidMove()){
    reshuffleKeepScore();
    render();
  }

  toast('New game started.');
}

// Buttons
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

// Resize
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => clampTileSize(), 120);
});

// Kickoff
init();