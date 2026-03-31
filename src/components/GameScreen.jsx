import { useState, useEffect, useCallback, useRef } from 'react';
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
  RELAY_GUESSES_PER_PLAYER,
  SPEED_ROUND_TIME,
  SUDDEN_DEATH_MAX_ROUNDS,
  getBotGuess,
} from '../gameLogic';

export default function GameScreen({
  gameState, setGameState, onHoleComplete,
  onlineMode, myPlayerNumber, send, roomCode,
}) {
  const [currentGuess, setCurrentGuess] = useState('');
  const [shake, setShake] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(SPEED_ROUND_TIME);
  const timerRef = useRef(null);

  const {
    player1Name, player2Name, currentHole, totalHoles, par,
    targetWord, player1Guesses, player2Guesses, currentPlayer, solved,
    gameMode = 'scramble', activePlayerPhase, p1HoleGuessCount, p1HoleGuesses,
    suddenDeathRound,
  } = gameState;

  const isSequential = ['stroke', 'bestball', 'relay', 'sudden_death'].includes(gameMode);
  const isScrambleLike = ['scramble', 'handicap', 'speed_round', 'practice'].includes(gameMode);
  const isPractice = gameMode === 'practice';

  // Reset local state when hole changes or phase changes
  useEffect(() => {
    setCurrentGuess('');
    setShowResult(false);
    setMessage('');
  }, [currentHole, activePlayerPhase]);

  // --- Practice mode: Bot auto-plays when it's Player 2's turn ---
  useEffect(() => {
    if (!isPractice || onlineMode || solved) return;
    if (currentPlayer !== 2) return;

    const allGuesses = [...player1Guesses, ...player2Guesses];
    const botDelay = 800 + Math.random() * 700; // 0.8-1.5s delay for realism

    const timeout = setTimeout(() => {
      const botWord = getBotGuess(allGuesses, targetWord);
      const isCorrect = botWord === targetWord;
      setGameState(prev => {
        const newP2 = [...prev.player2Guesses, botWord];
        const p1Maxed = prev.player1Guesses.length >= MAX_GUESSES_PER_PLAYER;
        const p2Maxed = newP2.length >= MAX_GUESSES_PER_PLAYER;
        const bothMaxed = p1Maxed && p2Maxed;

        return {
          ...prev,
          player2Guesses: newP2,
          currentPlayer: isCorrect || bothMaxed ? prev.currentPlayer : 1,
          solved: isCorrect || bothMaxed,
          solvedBy: isCorrect ? 2 : (bothMaxed ? 0 : null),
        };
      });
    }, botDelay);

    return () => clearTimeout(timeout);
  }, [isPractice, currentPlayer, solved, onlineMode, player1Guesses, player2Guesses, targetWord]);

  // --- Speed Round Timer ---
  useEffect(() => {
    if (gameMode !== 'speed_round' || solved || onlineMode) return;
    setTimer(SPEED_ROUND_TIME);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Time's up — skip this turn
          setGameState(prevState => {
            const next = prevState.currentPlayer === 1 ? 2 : 1;
            return { ...prevState, currentPlayer: next, timerStart: Date.now() };
          });
          setCurrentGuess('');
          setTimer(SPEED_ROUND_TIME);
          return SPEED_ROUND_TIME;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameMode, solved, currentPlayer, currentHole, onlineMode]);

  // In online mode, guesses are [{word, evaluation}]. Extract just words for counting.
  const p1Words = onlineMode ? player1Guesses.map(g => g.word) : player1Guesses;
  const p2Words = onlineMode ? player2Guesses.map(g => g.word) : player2Guesses;

  // For sequential modes, "active guesses" are the current phase player's guesses
  const activeGuessCount = isSequential
    ? (activePlayerPhase === 1 ? p1Words.length : p2Words.length)
    : (p1Words.length + p2Words.length);

  // Build keyboard state
  const keyboardState = (() => {
    if (onlineMode) {
      const keyboard = {};
      // Stroke/bestball: only show current phase. Relay/sudden_death/others: show all.
      const hideOther = gameMode === 'stroke';
      const guessesToShow = (isSequential && hideOther)
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
    if (gameMode === 'stroke') {
      const guesses = activePlayerPhase === 1 ? player1Guesses : player2Guesses;
      return mergeKeyboardState(guesses, [], targetWord);
    }
    // All other modes: show all guesses on keyboard
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

    if (gameMode === 'sudden_death') {
      // Sudden Death: 1 guess per phase, then round advances
      const phase = activePlayerPhase;
      setGameState(prev => {
        const isP1Phase = phase === 1;
        const newP1 = isP1Phase ? [...prev.player1Guesses, guess] : prev.player1Guesses;
        const newP2 = !isP1Phase ? [...prev.player2Guesses, guess] : prev.player2Guesses;

        if (isCorrect) {
          return {
            ...prev,
            player1Guesses: newP1,
            player2Guesses: newP2,
            solved: true,
            solvedBy: phase,
          };
        }

        if (isP1Phase) {
          // P1 guessed, not correct → P2's turn
          return {
            ...prev,
            player1Guesses: newP1,
            activePlayerPhase: 2,
            currentPlayer: 2,
          };
        }

        // P2 guessed, not correct → new round (or max rounds reached)
        const nextRound = (prev.suddenDeathRound || 1) + 1;
        if (nextRound > SUDDEN_DEATH_MAX_ROUNDS) {
          return {
            ...prev,
            player2Guesses: newP2,
            solved: true,
            solvedBy: 0, // nobody solved
          };
        }
        return {
          ...prev,
          player2Guesses: newP2,
          suddenDeathRound: nextRound,
          activePlayerPhase: 1,
          currentPlayer: 1,
        };
      });
    } else if (gameMode === 'relay') {
      // Relay: P1 gets first 3, P2 gets next 3
      const phase = activePlayerPhase;
      setGameState(prev => {
        const isP1Phase = phase === 1;
        const newGuesses = isP1Phase
          ? [...prev.player1Guesses, guess]
          : [...prev.player2Guesses, guess];
        const guessCount = newGuesses.length;
        const maxForRelay = RELAY_GUESSES_PER_PLAYER;
        const maxedOut = guessCount >= maxForRelay;
        const phaseComplete = isCorrect || maxedOut;

        if (isCorrect) {
          return {
            ...prev,
            ...(isP1Phase ? { player1Guesses: newGuesses } : { player2Guesses: newGuesses }),
            solved: true,
            solvedBy: phase,
            p1HoleGuessCount: isP1Phase ? guessCount : prev.p1HoleGuessCount,
          };
        }

        if (phaseComplete && isP1Phase) {
          return {
            ...prev,
            player1Guesses: newGuesses,
            p1HoleGuessCount: guessCount,
            p1HoleGuesses: newGuesses,
            activePlayerPhase: 2,
            currentPlayer: 2,
          };
        }

        if (phaseComplete && !isP1Phase) {
          return {
            ...prev,
            player2Guesses: newGuesses,
            solved: true,
            solvedBy: 0,
          };
        }

        return {
          ...prev,
          ...(isP1Phase ? { player1Guesses: newGuesses } : { player2Guesses: newGuesses }),
        };
      });
    } else if (isSequential) {
      // Stroke Play / Best Ball: existing sequential logic
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
          return {
            ...prev,
            player1Guesses: newGuesses,
            p1HoleGuessCount: guessCount,
            p1HoleGuesses: newGuesses,
            player2Guesses: [],
            activePlayerPhase: 2,
            currentPlayer: 2,
            solved: false,
          };
        }

        if (phaseComplete && !isP1Phase) {
          return {
            ...prev,
            player2Guesses: newGuesses,
            solved: true,
            solvedBy: isCorrect ? 2 : 0,
          };
        }

        return {
          ...prev,
          ...(isP1Phase ? { player1Guesses: newGuesses } : { player2Guesses: newGuesses }),
        };
      });
    } else {
      // Scramble / Handicap / Speed Round (alternating turns)
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
          timerStart: gameMode === 'speed_round' ? Date.now() : prev.timerStart,
        };
      });
    }

    setCurrentGuess('');
    // Reset speed round timer on successful guess
    if (gameMode === 'speed_round') setTimer(SPEED_ROUND_TIME);
  }, [currentGuess, currentPlayer, solved, targetWord, setGameState, onlineMode, send, inputDisabled, isSequential, activePlayerPhase, gameMode]);

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

    if (gameMode === 'sudden_death') {
      const rounds = gameState.suddenDeathRound || 1;
      const scoreInfo = getScoreLabel(rounds, par);
      onHoleComplete({
        hole: currentHole, par, gameMode,
        player1Guesses: p1Count, player2Guesses: p2Count,
        totalGuesses: p1Count + p2Count,
        score: rounds - par, label: scoreInfo.label,
        suddenDeathRounds: rounds,
      });
    } else if (isScrambleLike || gameMode === 'relay') {
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

  // Determine which boards to show
  const showP1Board = (() => {
    if (isScrambleLike) return true;
    if (gameMode === 'stroke') return activePlayerPhase === 1 || solved;
    // relay, bestball, sudden_death: always show both
    return true;
  })();

  const showP2Board = (() => {
    if (isScrambleLike) return true;
    if (gameMode === 'stroke') return activePlayerPhase === 2 || solved;
    if (gameMode === 'relay' || gameMode === 'sudden_death') return true;
    return activePlayerPhase === 2 || solved; // bestball
  })();

  // For relay/bestball P2 phase: show P1's stashed guesses as reference
  const p1DisplayGuesses = isSequential && activePlayerPhase === 2 && p1HoleGuesses
    ? p1HoleGuesses
    : player1Guesses;

  // Header text
  const headerGuessText = (() => {
    if (gameMode === 'sudden_death') return `Round ${suddenDeathRound || 1}`;
    if (isSequential) return `${activeGuessCount} guess${activeGuessCount !== 1 ? 'es' : ''}`;
    return `${p1Words.length + p2Words.length} guess${(p1Words.length + p2Words.length) !== 1 ? 'es' : ''}`;
  })();

  const roundLabel = gameMode === 'bestball' && gameState.holesPerRound
    ? (currentHole <= gameState.holesPerRound ? 'Round 1' : 'Round 2')
    : null;

  // Phase indicator text
  const phaseText = (() => {
    if (!isSequential || solved) return null;
    if (gameMode === 'sudden_death') return `${activePlayerName}'s guess — Round ${suddenDeathRound || 1}`;
    if (gameMode === 'relay') {
      const remaining = RELAY_GUESSES_PER_PLAYER - (activePlayerPhase === 1 ? p1Words.length : p2Words.length);
      return `${activePlayerName}'s segment — ${remaining} guess${remaining !== 1 ? 'es' : ''} left`;
    }
    let text = `${activePlayerName}'s solo round`;
    if (p1HoleGuessCount !== null && activePlayerPhase === 2) {
      text += ` — ${player1Name} scored ${p1HoleGuessCount}`;
    }
    return text;
  })();

  // Score info for overlay
  const overlayScoreInfo = (() => {
    if (gameMode === 'sudden_death') {
      return getScoreLabel(suddenDeathRound || 1, par);
    }
    if (isSequential && !isScrambleLike) {
      return getScoreLabel(Math.min(p1HoleGuessCount ?? p1Words.length, p2Words.length), par);
    }
    return getScoreLabel(p1Words.length + p2Words.length, par);
  })();

  return (
    <div className="game-screen">
      <div className="hole-header">
        <div className="hole-number">Hole {currentHole} of {totalHoles}</div>
        <div className="hole-par">Par {par}</div>
        <div className="hole-guesses">{headerGuessText}</div>
        {roundLabel && <div className="hole-round">{roundLabel}</div>}
        {roomCode && <div className="hole-room-code">{roomCode}</div>}
      </div>

      {phaseText && (
        <div className="phase-indicator">
          <span className={`player-dot p${activePlayerPhase}`} />
          {phaseText}
        </div>
      )}

      {message && <div className="game-message">{message}</div>}

      <div className="boards-container">
        {showP1Board && (
          <PlayerBoard
            playerName={player1Name}
            guesses={onlineMode ? p1DisplayGuesses : (p1DisplayGuesses || player1Guesses).map(w => typeof w === 'string' ? { word: w } : w)}
            targetWord={targetWord}
            isActive={isSequential ? (activePlayerPhase === 1 && !solved) : (currentPlayer === 1 && !solved)}
            playerNumber={1}
            onlineMode={onlineMode}
            dimmed={isSequential && activePlayerPhase === 2 && !solved && gameMode !== 'sudden_death'}
          />
        )}
        {showP2Board && (
          <PlayerBoard
            playerName={player2Name}
            guesses={onlineMode ? player2Guesses : player2Guesses.map(w => typeof w === 'string' ? { word: w } : w)}
            targetWord={targetWord}
            isActive={isSequential ? (activePlayerPhase === 2 && !solved) : (currentPlayer === 2 && !solved)}
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
            {gameMode === 'speed_round' && !onlineMode && (
              <span className={`speed-timer ${timer <= 10 ? 'warning' : ''} ${timer <= 5 ? 'danger' : ''}`}>
                {timer}s
              </span>
            )}
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
          scoreInfo={overlayScoreInfo}
          totalGuesses={p1Words.length + p2Words.length}
          par={par}
          onNext={handleNextHole}
          isLastHole={currentHole === totalHoles}
          gameMode={gameMode}
          p1Count={p1HoleGuessCount ?? p1Words.length}
          p2Count={p2Words.length}
          player1Name={player1Name}
          player2Name={player2Name}
          suddenDeathRound={suddenDeathRound}
        />
      )}
    </div>
  );
}
