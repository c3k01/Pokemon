'use strict';

import { setTouchKeys, clearTouchInput } from './touch_input.js';

const controls = document.querySelector('.touch-controls');
const pointers = new Map();

function paint() {
  const held = new Set();
  for (const item of pointers.values()) {
    for (const code of item.codes) held.add(code);
  }
  controls.querySelectorAll('[data-game-key]').forEach(button => {
    button.classList.toggle('pressed', held.has(button.dataset.gameKey));
  });
}

function updatePointer(event, item) {
  if (item.pad) {
    const rect = item.pad.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const distance = Math.hypot(x, y);
    const codes = [];
    // Eight directions, with a neutral centre. Sliding keeps pointer capture.
    if (distance > 0.22) {
      if (Math.abs(x) / distance > 0.38) codes.push(x < 0 ? 'KeyD' : 'KeyG');
      if (Math.abs(y) / distance > 0.38) codes.push(y < 0 ? 'KeyR' : 'KeyV');
    }
    item.codes = codes;
  } else {
    // A thumb can roll from jump to hit without lifting and aiming again.
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const button = target && target.closest('.touch-actions [data-game-key]');
    item.codes = button ? [button.dataset.gameKey] : [];
  }
  setTouchKeys(event.pointerId, item.codes);
  paint();
}

function release(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  setTouchKeys(event.pointerId, []);
  paint();
}

function reset() {
  pointers.clear();
  clearTouchInput();
  if (controls) paint();
}

if (controls) {
  controls.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const pad = event.target.closest('.touch-directions');
    const button = event.target.closest('.touch-actions [data-game-key]');
    if (!pad && !button) return;
    event.preventDefault();
    const element = pad || button;
    element.setPointerCapture(event.pointerId);
    const item = { pad, codes: [] };
    pointers.set(event.pointerId, item);
    updatePointer(event, item);
  });
  controls.addEventListener('pointermove', event => {
    const item = pointers.get(event.pointerId);
    if (!item) return;
    event.preventDefault();
    updatePointer(event, item);
  });
  controls.addEventListener('pointerup', release);
  controls.addEventListener('pointercancel', reset);
  controls.addEventListener('lostpointercapture', event => {
    if (pointers.has(event.pointerId)) reset();
  });
  controls.addEventListener('contextmenu', event => event.preventDefault());
  // Native button activation works with keyboard/assistive technology too.
  controls.addEventListener('click', event => {
    if (event.detail !== 0) return;
    const button = event.target.closest('[data-game-key]');
    if (!button) return;
    const owner = Symbol('activation');
    setTouchKeys(owner, [button.dataset.gameKey]);
    setTimeout(() => setTouchKeys(owner, []), 50);
  });
  document.getElementById('menu-bar').addEventListener('pointerdown', reset);
}
window.addEventListener('blur', reset);
window.addEventListener('pagehide', reset);
window.addEventListener('resize', reset);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) reset();
});
