// Sample touch and physical keys together at the original game frame rate.
// Preserve short action taps for one frame without delaying movement releases.
const owners = new Map();
const presses = new Set();

export function setTouchKeys(owner, codes) {
  const previous = owners.get(owner) || [];
  for (const code of codes) {
    if (!previous.includes(code) && !isTouchKeyDown(code)) presses.add(code);
  }
  if (codes.length) owners.set(owner, codes);
  else owners.delete(owner);
}

function isTouchKeyDown(code) {
  for (const codes of owners.values()) {
    if (codes.includes(code)) return true;
  }
  return false;
}

export function readTouchKey(code) {
  const state = { isDown: isTouchKeyDown(code), pressed: presses.has(code) };
  presses.delete(code);
  return state;
}

export function clearTouchInput() {
  owners.clear();
  presses.clear();
}
