'use strict';

// Feed touch controls through the same keyboard path as the original game.
// This preserves its menu timing, movement, jump, and directional power hits.
const pressed = new Map();
const active = new Map();
const pending = new Map();
const MIN_PRESS_MS = 90;

function send(code, type) {
  window.dispatchEvent(new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    key: code,
  }));
}

function press(button, pointerId) {
  const code = button.dataset.gameKey;
  if (pending.has(code)) {
    clearTimeout(pending.get(code));
    pending.delete(code);
  }
  let pointers = active.get(code);
  if (!pointers) {
    pointers = new Set();
    active.set(code, pointers);
  }
  if (!pointers.size) send(code, 'keydown');
  pointers.add(pointerId);
  pressed.set(pointerId, { button, code, time: performance.now() });
  button.classList.add('pressed');
}

function release(pointerId) {
  const item = pressed.get(pointerId);
  if (!item) return;
  pressed.delete(pointerId);
  const { button, code, time } = item;
  button.classList.remove('pressed');
  const pointers = active.get(code);
  pointers.delete(pointerId);
  if (pointers.size) return;
  active.delete(code);
  const remaining = Math.max(0, MIN_PRESS_MS - (performance.now() - time));
  pending.set(code, setTimeout(() => {
    if (!active.has(code)) send(code, 'keyup');
    pending.delete(code);
  }, remaining));
}

document.querySelectorAll('[data-game-key]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(button, event.pointerId);
  });
  button.addEventListener('pointerup', event => { event.preventDefault(); release(event.pointerId); });
  button.addEventListener('pointercancel', event => { event.preventDefault(); release(event.pointerId); });
  button.addEventListener('lostpointercapture', event => release(event.pointerId));
});
window.addEventListener('blur', () => {
  for (const code of pending.keys()) send(code, 'keyup');
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
  for (const code of active.keys()) send(code, 'keyup');
  active.clear();
  pressed.clear();
  document.querySelectorAll('.touch-controls .pressed').forEach(button => button.classList.remove('pressed'));
});
