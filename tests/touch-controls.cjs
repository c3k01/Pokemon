const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let directory, input, keyboard;
before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pika-controls-'));
  await fs.writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
  for (const name of ['keyboard', 'physics', 'rand', 'touch_input']) {
    await fs.copyFile(path.join(__dirname, '../src/resources/js', name + '.js'), path.join(directory, name + '.js'));
  }
  global.window = new EventTarget();
  input = await import(pathToFileURL(path.join(directory, 'touch_input.js')));
  const { PikaKeyboard } = await import(pathToFileURL(path.join(directory, 'keyboard.js')));
  keyboard = new PikaKeyboard('KeyD', 'KeyG', 'KeyR', 'KeyV', 'KeyZ', 'KeyF');
});
after(async () => {
  keyboard.unsubscribe();
  delete global.window;
  await fs.rm(directory, { recursive: true, force: true });
});
function physical(type, code) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'code', { value: code });
  window.dispatchEvent(event);
}
function reset() {
  input.clearTouchInput();
  for (const code of ['KeyD', 'KeyG', 'KeyR', 'KeyV', 'KeyZ', 'KeyF']) physical('keyup', code);
  keyboard.getInput();
}

test('movement changes direction and stops immediately on release', () => {
  reset();
  input.setTouchKeys(1, ['KeyD']);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, -1);
  input.setTouchKeys(1, ['KeyG']);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 1);
  input.setTouchKeys(1, []);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 0);
});

test('a jump or hit shorter than one frame still registers exactly once', () => {
  reset();
  input.setTouchKeys(1, ['KeyR', 'KeyZ']);
  input.setTouchKeys(1, []);
  keyboard.getInput();
  assert.equal(keyboard.yDirection, -1);
  assert.equal(keyboard.powerHit, 1);
  keyboard.getInput();
  assert.equal(keyboard.yDirection, 0);
  assert.equal(keyboard.powerHit, 0);
});

test('diagonal movement, jump and hit combine across fingers', () => {
  reset();
  input.setTouchKeys(1, ['KeyG', 'KeyV']);
  input.setTouchKeys(2, ['KeyZ']);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 1);
  assert.equal(keyboard.yDirection, 1);
  assert.equal(keyboard.powerHit, 1);
  keyboard.getInput();
  assert.equal(keyboard.powerHit, 0);
  input.setTouchKeys(2, []);
  input.setTouchKeys(2, ['KeyZ']);
  keyboard.getInput();
  assert.equal(keyboard.powerHit, 1);
  input.setTouchKeys(1, ['KeyG']);
  input.setTouchKeys(3, ['KeyR']);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 1);
  assert.equal(keyboard.yDirection, -1);
});

test('releasing one of two fingers on jump keeps the other held', () => {
  reset();
  input.setTouchKeys(1, ['KeyR']);
  input.setTouchKeys(2, ['KeyR']);
  keyboard.getInput();
  input.setTouchKeys(1, []);
  keyboard.getInput();
  assert.equal(keyboard.yDirection, -1);
  input.setTouchKeys(2, []);
  keyboard.getInput();
  assert.equal(keyboard.yDirection, 0);
});

test('touch release does not release a physical key; physical hit stays edge-triggered', () => {
  reset();
  physical('keydown', 'KeyG');
  input.setTouchKeys(1, ['KeyG']);
  input.setTouchKeys(1, []);
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 1);
  physical('keydown', 'KeyZ');
  keyboard.getInput();
  assert.equal(keyboard.powerHit, 1);
  keyboard.getInput();
  assert.equal(keyboard.powerHit, 0);
  reset();
});

test('reset drops held keys and unread actions after interruption', () => {
  reset();
  input.setTouchKeys(1, ['KeyD', 'KeyR', 'KeyZ']);
  input.clearTouchInput();
  keyboard.getInput();
  assert.equal(keyboard.xDirection, 0);
  assert.equal(keyboard.yDirection, 0);
  assert.equal(keyboard.powerHit, 0);
});
