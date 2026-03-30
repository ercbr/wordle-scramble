import { useState, useEffect, useCallback } from 'react';
import PlayerBoard from './PlayerBoard';
import SharedKeyboard from './SharedKeyboard';
import HoleResultOverlay from './HoleResultOverlay';
import {
  evaluateGuess,
  mergeKeyboardState,
  getScoreLabel,
  getHoleScore,
  isValidWord,
  MAX_GUESSES_PER_PLAYER,
} from '../gameLogic';

export default function GameScreen({
  gameState, setGameState, onHoleComplete,
  onlineMode, myPlayerNumber, send, roomCode,
}) {
  const [currentGuess, setCurrentGuess] = useState('');
  const [shake, setShake] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState('');

  const {
    player1Name, player2Name, currentHole, totalHoles, par,
    targetWord, player1Guesses, player2Guesses, currentPlayer, solved,
    gameMode = 'scramble', activePlayerPhase, p1HoleGuessCount, p1HoleGuesses,
  } = gameState;

  const isSequential = gameMode !== 'scramble';

  // Reset local state when hole changes or phase changes
  useEffect(() => {
    setCurrentGuess('');
    setShowResult(false);
    setMessage('');
  }, [currentHole, activePlayerPhase]);

  // In online mode, guesses are [{word, evaluation}]. Extract just words for counting.
  const p1Words = onlineMode ? player1Guesses.map(g => g.word) : player1Guesses;
  const p2Words = onlineMode ? player2Guesses.map(g => g.word) : player2Guesses;

  // For sequential modes, "active guesses" are the current phase player's guesses
  const activeGuesses = isSequential
    ? (activePlayerPhase === 1 ? player1Guesses : player2Guesses)
    : [...player1Guesses, ...player2Guesses];
  const activeGuessCount = isSequential
    ? (activePlayerPhase === 1 ? p1Words.length : p2Words.length)
    : (p1Words.length + p2Words.length);

  // Build keyboard state — only show active player's letters in sequential mode
  const keyboardState = (() => {
    if (onlineMode) {
      const keyboard = {};
      // In sequential mode, only show current phase's guesses on keyboard
      const guessesToShow = isSequential
        ? (activePlayerPhase === 1 ? player1Guesses : player2Guesses)
        : [...player1Guesses, ...player2Guesses];
      for (const { word, evaluation } of guessesToShow) {
        for (let i = 0; i < 5; i++) {
          const letter = word[i];
          const status = evaluation[i];
          const current = keyboard[letter];
          if (!current || status === 'correct' || (status === 'present' && current === 'absent')) {
            keyboard[letter] = status;
          }
        }
      }
      return keyboard;
    }
    if (isSequential) {
      // Only show active player's keyboard state
      const guesses = activePlayerPhase === 1 ? player1Guesses : player2Guesses;
      return mergeKeyboardState(guesses, [], targetWord);
    }
    return mergeKeyboardState(player1Guesses, player2Guesses, targetWord);
  })();

  // In online mode, only allow input when it's my turn
  const isMyTurn = onlineMode ? (currentPlayer === myPlayerNumber) : true;
  const inputDisabled = solved || (onlineMode && !isMyTurn);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 1500);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submitGuess = useCallback(() => {
    if (solved || inputDisabled) return;
    if (currentGuess.length !== 5) return;

    const guess = currentGuess.toLowerCase();

    if (!isValidWord(guess)) {
      showMessage('Not in word list');
      triggerShake();
      return;
    }

    if (onlineMode) {
      send({ type: 'submit_guess', guess });
      setCurrentGuess('');
      return;
    }

    // --- Local mode ---
    const isCorrect = guess === targetWord;

    if (isSequential) {
      // Sequential mode: active player keeps guessing, no alternation
      const phase = activePlayerPhase;
      setGameState(prev => {
        const isP1Phase = phase === 1;
        const newGuesses = isP1Phase
          ? [...prev.player1Guesses, guess]
          : [...prev.player2Guesses, guess];
        const guessCount = newGuesses.length;
        const maxedOut = guessCount >= MAX_GUESSES_PER_PLAYER;
        const phaseComplete = isCorrect || maxedOut;

        if (phaseComplete && isP1Phase) {
          // P1 finished — transition to P2
          return {
            ...prev,
            player1Guesses: newGuesses,
            p1HoleGuessCount: guessCount,
            p1HoleGuesses: newGuesses, // stash for Best Ball display
            player2Guesses: [],
            activePlayerPhase: 2,
            currentPlayer: 2,
            solved: false, // reset for P2's turn
          };
        }

        if (phaseComplete && !isP1Phase) {
          // P2 finished — hole is complete
          return {
            ...prev,
            player2Guesses: newGuesses,
            solved: true,
            solvedBy: isCorrect ? 2 : 0,
          };
        }

        // Not complete yet — same player continues
        return {
          ...prev,
          ...(isP1Phase
            ? { player1Guesses: newGuesses }
            : { player2Guesses: newGuesses }),
        };
      });
    } else {
      // Scramble mode (original logic)
      const isP1 = currentPlayer === 1;
      setGameState(prev => {
        const newP1 = isP1 ? [...prev.player1Guesses, guess] : prev.player1Guesses;
        const newP2 = !isP1 ? [...prev.player2Guesses, guess] : prev.player2Guesses;
        const p1Maxed = newP1.length >= MAX_GUESSES_PER_PLAYER;
        const p2Maxed = newP2.length >= MAX_GUESSES_PER_PLAYER;
        const bothMaxed = p1Maxed && p2Maxed;

        let nextPlayer = prev.currentPlayer === 1 ? 2 : 1;
        if (nextPlayer === 1 && p1Maxed && !p2Maxed) nextPlayer = 2;
        if (nextPlayer === 2 && p2Maxed && !p1Maxed) nextPlayer = 1;

        return {
          ...prev,
          player1Guesses: newP1,
          player2Guesses: newP2,
          currentPlayer: isCorrect || bothMaxed ? prev.currentPlayer : nextPlayer,
          solved: isCorrect || bothMaxed,
          solvedBy: isCorrect ? prev.currentPlayer : (bothMaxed ? 0 : null),
        };
      });
    }

    setCurrentGuess('');
  }, [currentGuess, currentPlayer, solved, targetWord, setGameState, onlineMode, send, inputDisabled, isSequential, activePlayerPhase]);

  const handleKey = useCallback((key) => {
    if (inputDisabled) return;
    if (key === 'enter') {
      submitGuess();
    } else if (key === 'backspace') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (key.length === 1 && /^[a-z]$/i.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key.toLowerCase());
    }
  }, [currentGuess, inputDisabled, submitGuess]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') handleKey('enter');
      else if (e.key === 'Backspace') handleKey('backspace');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  // Show result overlay when solved
  useEffect(() => {
    if (solved && !showResult) {
      const t = setTimeout(() => setShowResult(true), 800);
      return () => clearTimeout(t);
    }
  }, [solved, showResult]);

  const handleNextHole = () => {
    if (onlineMode) {
      onHoleComplete();
      return;
    }

    const p1Count = p1HoleGuessCount ?? p1Words.length;
    const p2Count = p2Words.length;

    if (gameMode === 'scramble') {
      const total = p1Count + p2Count;
      const scoreInfo = getScoreLabel(total, par);
      onHoleComplete({
        hole: currentHole, par, gameMode,
        player1Guesses: p1Count, player2Guesses: p2Count,
        totalGuesses: total, score: total - par, label: scoreInfo.label,
      });
    } else {
      const holeScore = getHoleScore(gameMode, p1Count, p2Count, par);
      const effectiveScore = gameMode === 'bestball' ? holeScore.teamScore : Math.min(p1Count, p2Count);
      const scoreInfo = getScoreLabel(effectiveScore, par);
      onHoleComplete({
        hole: currentHole, par, gameMode,
        player1Guesses: p1Count, player2Guesses: p2Count,
        totalGuesses: p1Count + p2Count,
        teamScore: gameMode === 'bestball' ? holeScore.teamScore : null,
        score: effectiveScore - par,
        label: scoreInfo.label,
      });
    }
  };

  // Build current input row
  const buildCurrentInput = () => {
    const letters = currentGuess.split('');
    return (
      <div className={`tile-row current-input ${shake ? 'shake' : ''}`}>
        {Array(5).fill(null).map((_, i) => (
          <div key={i} className={`tile ${letters[i] ? 'filled-input' : 'blank'}`}>
            <div className="tile-inner">
              <div className="tile-front">{letters[i] || ''}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const activePlayerName = isSequential
    ? (activePlayerPhase === 1 ? player1Name : player2Name)
    : (currentPlayer === 1 ? player1Name : player2Name);

  // Determine which boards to show based on mode
  const showP1Board = (() => {
    if (!isSequential) return true; // scramble: always show both
    if (gameMode === 'stroke') {
      // Stroke: only show active phase's board
      return activePlayerPhase === 1 || solved;
    }
    // Best Ball: always show P1 (reference for P2)
    return true;
  })();

  const showP2Board = (() => {
    if (!isSequential) return true;
    if (gameMode === 'stroke') {
      return activePlayerPhase === 2 || solved;
    }
    // Best Ball: show P2 board during P2's phase or when solved
    return activePlayerPhase === 2 || solved;
  })();

  // For Best Ball P2 phase: show P1's stashed guesses as reference
  const p1DisplayGuesses = isSequential && activePlayerPhase === 2 && p1HoleGuesses
    ? p1HoleGuesses
    : player1Guesses;

  // Guess count display for header
  const headerGuessText = isSequential
    ? `${activeGuessCount} guess${activeGuessCount !== 1 ? 'es' : ''}`
    : `${p1Words.length + p2Words.length} guess${(p1Words.length + p2Words.length) !== 1 ? 'es' : ''}`;

  // Round indicator for best ball
  const roundLabel = gameMode === 'bestball' && gameState.holesPerRound
    ? (currentHole <= gameState.holesPerRound ? 'Round 1' : 'Round 2')
    : null;

  return (
    <div className="game-screen">
      <div className="hole-header">
        <div className="hole-number">Hole {currentHole} of {totalHoles}</div>
        <div className="hole-par">Par {par}</div>
        <div className="hole-guesses">{headerGuessText}</div>
        {roundLabel && <div className="hole-round">{roundLabel}</div>}
        {roomCode && <div className="hole-room-code">{roomCode}</div>}
      </div>

      {isSequential && !solved && (
        <div className="phase-indicator">
          <span className={`player-dot p${activePlayerPhase}`} />
          {activePlayerName}'s solo round
          {p1HoleGuessCount !== null && activePlayerPhase === 2 && (
            <span className="phase-p1-score"> — {player1Name} scored {p1HoleGuessCount}</span>
          )}
        </div>
      )}

      {message && <div className="game-message">{message}</div>}

      <div className="boards-container">
        {showP1Board && (
          <PlayerBoard
            playerName={player1Name}
            guesses={onlineMode ? p1DisplayGuesses : (p1DisplayGuesses || player1Guesses).map(w => typeof w === 'string' ? { word: w } : w)}
            targetWord={targetWord}
            isActive={!isSequential ? (currentPlayer === 1 && !solved) : (activePlayerPhase === 1 && !solved)}
            playerNumber={1}
            onlineMode={onlineMode}
            dimmed={isSequential && activePlayerPhase === 2 && !solved}
          />
        )}
        {showP2Board && (
          <PlayerBoard
            playerName={player2Name}
            guesses={onlineMode ? player2Guesses : player2Guesses.map(w => typeof w === 'string' ? { word: w } : w)}
            targetWord={targetWord}
            isActive={!isSequential ? (currentPlayer === 2 && !solved) : (activePlayerPhase === 2 && !solved)}
            playerNumber={2}
            onlineMode={onlineMode}
          />
        )}
      </div>

      {!solved && (
        <div className="input-section">
          <div className="active-player-label">
            <span className={`player-dot p${isSequential ? activePlayerPhase : currentPlayer}`} />
            {onlineMode && !isMyTurn
              ? `Waiting for ${activePlayerName}...`
              : `${activePlayerName}'s turn`}
          </div>
          {(!onlineMode || isMyTurn) && buildCurrentInput()}
        </div>
      )}

      {solved && !showResult && targetWord && (
        <div className="solved-word">
          The word was <strong>{targetWord.toUpperCase()}</strong>
        </div>
      )}

      <SharedKeyboard
        letterStates={keyboardState}
        onKey={handleKey}
        disabled={inputDisabled}
      />

      {showResult && (
        <HoleResultOverlay
          scoreInfo={isSequential
            ? getScoreLabel(Math.min(p1HoleGuessCount ?? p1Words.length, p2Words.length), par)
            : getScoreLabel(p1Words.length + p2Words.length, par)}
          totalGuesses={p1Words.length + p2Words.length}
          par={par}
          onNext={handleNextHole}
          isLastHole={currentHole === totalHoles}
          gameMode={gameMode}
          p1Count={p1HoleGuessCount ?? p1Words.length}
          p2Count={p2Words.length}
          player1Name={player1Name}
          player2Name={player2Name}
        />
      )}
    </div>
  );
}
