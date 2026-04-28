// Simple Theme Manager for BetLeague
// Handles light/dark/auto with system preference sync and persistence

const STORAGE_KEY = 'betleague-theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredTheme(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage errors (Safari private mode, etc.)
  }
}

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
    const system = getSystemPreference();
    if (system === 'dark') root.setAttribute('data-theme', 'dark');
    return;
  }
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

function handleSystemChange(e) {
  const current = getTheme();
  if (current === 'auto') {
    applyTheme('auto');
  }
}

export function initTheme() {
  const stored = getStoredTheme();
  const theme = stored || 'auto';
  applyTheme(theme);

  if (window && window.matchMedia) {
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      if (mql.addEventListener) {
        mql.addEventListener('change', handleSystemChange);
      } else if (mql.addListener) {
        // Safari
        mql.addListener(handleSystemChange);
      }
    } catch {
      // ignore
    }
  }
}

export function setTheme(theme) {
  const valid = ['light', 'dark', 'auto'];
  const value = valid.includes(theme) ? theme : 'auto';
  setStoredTheme(value);
  applyTheme(value);
}

export function getTheme() {
  return getStoredTheme() || 'auto';
}

