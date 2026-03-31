import { getRandomWord, getDailyWords, fetchDailyWords, getMysteryWord, isValidWord } from './words';

export const GAME_MODES = {
  scramble: {
    id: 'scramble',
    label: 'Scramble',
    icon: '🔄',
    description: 'Alternate guesses, team score',
  },
  stroke: {
    id: 'stroke',
    label: 'Stroke Play',
    icon: '🏆',
    description: 'Play solo, lowest score wins',
  },
  bestball: {
    id: 'bestball',
    label: 'Best Ball',
    icon: '⛳',
    description: 'Solo play, best score counts (2 rounds)',
  },
};

export function evaluateGuess(guess, target) {
  const result = Array(5).fill('absent');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'correct';
      targetLetters[i] = null;
      guessLetters[i] = null;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === null) continue;
    const idx = targetLetters.indexOf(guessLetters[i]);
    if (idx !== -1) {
      result[i] = 'present';
      targetLetters[idx] = null;
    }
  }

  return result;
}

export function getScoreLabel(totalGuesses, par) {
  const diff = totalGuesses - par;
  if (totalGuesses === 1) return { label: 'Hole in One!', emoji: '🏆', diff: diff };
  if (diff <= -3) return { label: 'Albatross!', emoji: '🦅', diff: diff };
  if (diff === -2) return { label: 'Eagle!', emoji: '🦅', diff: diff };
  if (diff === -1) return { label: 'Birdie!', emoji: '🐦', diff: diff };
  if (diff === 0) return { label: 'Par', emoji: '🏌️', diff: diff };
  if (diff === 1) return { label: 'Bogey', emoji: '😤', diff: diff };
  if (diff === 2) return { label: 'Double Bogey', emoji: '😬', diff: diff };
  if (diff === 3) return { label: 'Triple Bogey', emoji: '😱', diff: diff };
  return { label: `+${diff}`, emoji: '💀', diff: diff };
}

export function formatScore(diff) {
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

// Returns the effective holes count (Best Ball plays 2 rounds)
export function getEffectiveHoles(gameMode, holesPerRound) {
  return gameMode === 'bestball' ? holesPerRound * 2 : holesPerRound;
}

// Get the hole score based on game mode
export function getHoleScore(gameMode, p1Count, p2Count, par) {
  if (gameMode === 'scramble') {
    const total = p1Count + p2Count;
    return { teamScore: total, diff: total - par, p1Count, p2Count };
  }
  // stroke and bestball: individual scores
  const bestScore = Math.min(p1Count, p2Count);
  if (gameMode === 'bestball') {
    return { teamScore: bestScore, diff: bestScore - par, p1Count, p2Count };
  }
  // stroke: no team score, individual comparison
  return { p1Score: p1Count, p2Score: p2Count, p1Diff: p1Count - par, p2Diff: p2Count - par, p1Count, p2Count };
}

export function createInitialGameState(player1Name, player2Name, totalHoles, par, gameMode = 'scramble', wordSource = 'random') {
  const effectiveHoles = getEffectiveHoles(gameMode, totalHoles);
  const isSequential = gameMode !== 'scramble';

  // Pre-generate all words for daily mode so every hole is deterministic
  const dailyWords = wordSource === 'daily' ? getDailyWords(effectiveHoles) : null;
  const mysteryWord = wordSource === 'mystery' ? getMysteryWord() : null;
  const firstWord = dailyWords ? dailyWords[0] : mysteryWord ? mysteryWord : getRandomWord();

  return {
    player1Name,
    player2Name,
    totalHoles: effectiveHoles,
    holesPerRound: totalHoles,
    par,
    gameMode,
    wordSource,
    dailyWords, // null for random, array for daily
    currentHole: 1,
    targetWord: firstWord,
    player1Guesses: [],
    player2Guesses: [],
    currentPlayer: 1,
    solved: false,
    solvedBy: null,
    scorecard: [],
    gameOver: false,
    // Sequential mode state
    activePlayerPhase: isSequential ? 1 : null, // 1 or 2 for who is currently playing solo
    p1HoleGuessCount: null, // stashed P1 guess count after P1 finishes
    p1HoleGuesses: null,    // stashed P1 guesses for display in Best Ball
  };
}

export function mergeKeyboardState(player1Guesses, player2Guesses, target) {
  const keyboard = {};
  const allGuesses = [...player1Guesses, ...player2Guesses];

  for (const guess of allGuesses) {
    const evaluation = evaluateGuess(guess, target);
    for (let i = 0; i < 5; i++) {
      const letter = guess[i];
      const status = evaluation[i];
      const current = keyboard[letter];
      if (!current || status === 'correct' || (status === 'present' && current === 'absent')) {
        keyboard[letter] = status;
      }
    }
  }

  return keyboard;
}

export const MAX_GUESSES_PER_PLAYER = 6;

// Async helper: pre-fetch daily words before creating game state
export async function prefetchDailyWords(totalHoles, gameMode) {
  const effectiveHoles = getEffectiveHoles(gameMode, totalHoles);
  return await fetchDailyWords(effectiveHoles);
}

export { getRandomWord, getDailyWords, fetchDailyWords, getMysteryWord, isValidWord };
