export const STORAGE_KEY = 'balloon-maths-showdown-v1';
export const HERO_IDS = Object.freeze(['sky', 'sunny', 'blaze']);
export const LEVELS = Object.freeze([20, 30, 40, 50, 60]);

export const DEFAULT_SETTINGS = Object.freeze({
  heroId: 'sky',
  soundOn: true,
  bestScores: { 20: 0, 30: 0, 40: 0, 50: 0, 60: 0 },
});

function sanitize(value) {
  const bestScores = {};
  for (const level of LEVELS) {
    const score = Number(value?.bestScores?.[level]);
    bestScores[level] = Number.isInteger(score) && score >= 0 && score <= 5 ? score : 0;
  }
  return {
    heroId: HERO_IDS.includes(value?.heroId) ? value.heroId : DEFAULT_SETTINGS.heroId,
    soundOn: typeof value?.soundOn === 'boolean' ? value.soundOn : DEFAULT_SETTINGS.soundOn,
    bestScores,
  };
}

export function loadSettings(storage) {
  try {
    const activeStorage = storage ?? globalThis.localStorage;
    return sanitize(JSON.parse(activeStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return sanitize(null);
  }
}

export function saveSettings(settings, storage) {
  const clean = sanitize(settings);
  try {
    const activeStorage = storage ?? globalThis.localStorage;
    activeStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // The game still works when private browsing blocks storage.
  }
  return clean;
}

export function recordBest(settings, level, playerScore) {
  const regulationScore = Math.max(0, Math.min(5, playerScore));
  return sanitize({
    ...settings,
    bestScores: {
      ...settings.bestScores,
      [level]: Math.max(settings.bestScores[level] || 0, regulationScore),
    },
  });
}
