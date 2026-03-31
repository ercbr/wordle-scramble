import { getRandomWord, getDailyWords, fetchDailyWords, getMysteryWord, isValidWord, SOLUTION_WORDS } from './words';

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
  handicap: {
    id: 'handicap',
    label: 'Handicap',
    icon: '👀',
    description: 'P1 guesses first, P2 sees it before guessing',
  },
  relay: {
    id: 'relay',
    label: 'Relay',
    icon: '🎯',
    description: 'P1 gets 3 guesses, then P2 gets 3',
  },
  sudden_death: {
    id: 'sudden_death',
    label: 'Sudden Death',
    icon: '⚡',
    description: '1 guess each per round, first to solve wins',
  },
  speed_round: {
    id: 'speed_round',
    label: 'Speed Round',
    icon: '⏱️',
    description: 'Scramble with a 30-second shot clock',
  },
  practice: {
    id: 'practice',
    label: 'Practice',
    icon: '🤖',
    description: 'Solo play with a virtual partner',
    singlePlayer: true,
  },
};

export const RELAY_GUESSES_PER_PLAYER = 3;
export const SPEED_ROUND_TIME = 30; // seconds
export const SUDDEN_DEATH_MAX_ROUNDS = 6;

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
  const isSequential = ['stroke', 'bestball', 'relay', 'sudden_death'].includes(gameMode);

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
    activePlayerPhase: isSequential ? 1 : null,
    p1HoleGuessCount: null,
    p1HoleGuesses: null,
    // Sudden Death
    suddenDeathRound: gameMode === 'sudden_death' ? 1 : null,
    // Speed Round
    timerStart: gameMode === 'speed_round' ? Date.now() : null,
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

// Bot guess for Practice mode — picks a reasonable word based on known constraints
export function getBotGuess(previousGuesses, target) {
  // First guess: use a strong opener
  const openers = ['crane', 'slate', 'trace', 'audio', 'raise'];
  if (previousGuesses.length === 0) {
    return openers[Math.floor(Math.random() * openers.length)];
  }

  // Build constraints from previous guesses
  // Two passes: first collect greens/yellows, then determine grays
  const greens = {};    // position -> letter (must be here)
  const yellows = {};   // letter -> Set of positions it's NOT at
  const grays = new Set(); // letters confirmed not in the word
  const presentLetters = new Set(); // letters confirmed IN the word (green or yellow)

  // Pass 1: collect all green and yellow info
  for (const word of previousGuesses) {
    const eval_ = evaluateGuess(word, target);
    for (let i = 0; i < 5; i++) {
      const letter = word[i];
      if (eval_[i] === 'correct') {
        greens[i] = letter;
        presentLetters.add(letter);
      } else if (eval_[i] === 'present') {
        if (!yellows[letter]) yellows[letter] = new Set();
        yellows[letter].add(i);
        presentLetters.add(letter);
      }
    }
  }

  // Pass 2: mark grays (only letters that are NEVER green or yellow)
  for (const word of previousGuesses) {
    const eval_ = evaluateGuess(word, target);
    for (let i = 0; i < 5; i++) {
      const letter = word[i];
      if (eval_[i] === 'absent' && !presentLetters.has(letter)) {
        grays.add(letter);
      }
    }
  }

  // Filter candidates
  const guessedWords = new Set(previousGuesses);
  const candidates = SOLUTION_WORDS.filter(word => {
    if (guessedWords.has(word)) return false;
    for (let i = 0; i < 5; i++) {
      const letter = word[i];
      // Must match greens
      if (greens[i] && word[i] !== greens[i]) return false;
      // Must not have gray letters
      if (grays.has(letter)) return false;
      // Yellow letters must not be in the positions we know they're NOT at
      if (yellows[letter] && yellows[letter].has(i)) return false;
    }
    // Must contain all yellow/green letters somewhere
    for (const yl of presentLetters) {
      if (!word.includes(yl)) return false;
    }
    return true;
  });

  if (candidates.length > 0) {
    // Pick from top candidates — slight randomization for variety
    if (candidates.length <= 3 || Math.random() < 0.7) {
      return candidates[0]; // best matching candidate
    }
    // Pick randomly from the top 5 to add variety
    return candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
  }

  // Fallback: random word
  return getRandomWord();
}

export const MAX_GUESSES_PER_PLAYER = 6;

// Async helper: pre-fetch daily words before creating game state
export async function prefetchDailyWords(totalHoles, gameMode) {
  const effectiveHoles = getEffectiveHoles(gameMode, totalHoles);
  return await fetchDailyWords(effectiveHoles);
}

export { getRandomWord, getDailyWords, fetchDailyWords, getMysteryWord, isValidWord };
