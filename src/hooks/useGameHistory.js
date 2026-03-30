const STORAGE_KEY = 'wordle_scramble_history';

export function getHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveGame(gameData) {
  const history = getHistory();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    ...gameData,
  };
  history.unshift(entry); // newest first
  // Keep last 100 games
  if (history.length > 100) history.length = 100;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full — silently fail
  }
  return entry;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
