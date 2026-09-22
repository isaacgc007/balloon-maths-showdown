import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, saveSettings, recordBest } from '../js/storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    value: key => data.get(key),
  };
}

test('corrupt storage falls back to safe defaults', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{not-json' });
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});

test('invalid values are sanitized', () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: JSON.stringify({ heroId: 'villain', soundOn: 'yes', bestScores: { 20: 99, 30: 4 } }),
  });
  const settings = loadSettings(storage);
  assert.equal(settings.heroId, 'sky');
  assert.equal(settings.soundOn, true);
  assert.equal(settings.bestScores[20], 0);
  assert.equal(settings.bestScores[30], 4);
});

test('best scores only move upward and are capped at five', () => {
  let settings = recordBest(DEFAULT_SETTINGS, 20, 4);
  settings = recordBest(settings, 20, 2);
  assert.equal(settings.bestScores[20], 4);
  settings = recordBest(settings, 20, 10);
  assert.equal(settings.bestScores[20], 5);
});

test('save works and storage failures do not break the game', () => {
  const storage = memoryStorage();
  saveSettings({ ...DEFAULT_SETTINGS, heroId: 'sunny' }, storage);
  assert.equal(JSON.parse(storage.value(STORAGE_KEY)).heroId, 'sunny');
  assert.doesNotThrow(() => saveSettings(DEFAULT_SETTINGS, { setItem() { throw new Error('blocked'); } }));
});
