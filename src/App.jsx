import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import GameScreen from './components/GameScreen';
import ScorecardScreen from './components/ScorecardScreen';
import LobbyScreen from './components/LobbyScreen';
import OnlineGame from './components/OnlineGame';
import HistoryScreen from './components/HistoryScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import { createInitialGameState, getRandomWord, prefetchDailyWords } from './gameLogic';
import './App.css';

function App() {
  const [mode, setMode] = useState('menu'); // menu | local | online
  const [screen, setScreen] = useState('setup');
  const [gameState, setGameState] = useState(null);
  const [scorecard, setScorecard] = useState([]);

  // Online state
  const [roomCode, setRoomCode] = useState(null);
  const [playerName, setPlayerName] = useState(null);

  // --- Local mode handlers (unchanged) ---
  const handleStart = async (p1, p2, holes, par, gameMode = 'scramble', wordSource = 'random') => {
    setScorecard([]);
    if (wordSource === 'daily') {
      // Fetch real NYT words before starting
      setScreen('loading');
      const dailyWords = await prefetchDailyWords(holes, gameMode);
      const state = createInitialGameState(p1, p2, holes, par, gameMode, wordSource);
      state.dailyWords = dailyWords;
      state.targetWord = dailyWords[0];
      setGameState(state);
    } else {
      setGameState(createInitialGameState(p1, p2, holes, par, gameMode, wordSource));
    }
    setScreen('game');
  };

  const handleHoleComplete = (holeResult) => {
    const newScorecard = [...scorecard, holeResult];
    setScorecard(newScorecard);

    if (gameState.currentHole >= gameState.totalHoles) {
      setScreen('scorecard');
    } else {
      const isSequential = gameState.gameMode !== 'scramble';
      setGameState(prev => {
        const nextHole = prev.currentHole + 1;
        const nextWord = prev.dailyWords
          ? prev.dailyWords[nextHole - 1]
          : getRandomWord();
        return {
          ...prev,
          currentHole: nextHole,
          targetWord: nextWord,
          player1Guesses: [],
          player2Guesses: [],
          currentPlayer: 1,
          solved: false,
          solvedBy: null,
          activePlayerPhase: isSequential ? 1 : null,
          p1HoleGuessCount: null,
          p1HoleGuesses: null,
        };
      });
    }
  };

  const handlePlayAgain = () => {
    setScreen('setup');
    setGameState(null);
    setScorecard([]);
  };

  // --- Online mode handlers ---
  const handleJoinRoom = (code, name) => {
    setRoomCode(code);
    setPlayerName(name);
  };

  const handleLeaveOnline = () => {
    setRoomCode(null);
    setPlayerName(null);
    setMode('menu');
  };

  // --- Menu screen ---
  if (mode === 'menu') {
    return (
      <div className="app">
        <div className="setup-screen">
          <div className="setup-logo">
            <div className="logo-icon">⛳</div>
            <h1>Wordle Scramble</h1>
            <p className="subtitle">Team Wordle with Golf Scoring</p>
          </div>
          <div className="setup-card menu-card">
            <button className="start-btn" onClick={() => { setMode('local'); setScreen('setup'); }}>
              Play Local
            </button>
            <p className="menu-desc">Two players, one screen</p>
            <button className="start-btn online-btn" onClick={() => setMode('online')}>
              Play Online
            </button>
            <p className="menu-desc">Create or join a room</p>
            <button className="start-btn online-btn" onClick={() => setMode('history')}>
              History
            </button>
            <p className="menu-desc">Past games & scores</p>
            <button className="start-btn online-btn" onClick={() => setMode('leaderboard')}>
              Leaderboard
            </button>
            <p className="menu-desc">Daily tournament scores</p>
          </div>
        </div>
      </div>
    );
  }

  // --- History ---
  if (mode === 'history') {
    return (
      <div className="app">
        <HistoryScreen onBack={() => setMode('menu')} />
      </div>
    );
  }

  // --- Leaderboard ---
  if (mode === 'leaderboard') {
    return (
      <div className="app">
        <LeaderboardScreen onBack={() => setMode('menu')} />
      </div>
    );
  }

  // --- Online mode ---
  if (mode === 'online') {
    if (!roomCode) {
      return (
        <div className="app">
          <LobbyScreen
            onJoinRoom={handleJoinRoom}
            onBack={() => setMode('menu')}
          />
        </div>
      );
    }

    return (
      <div className="app">
        <OnlineGame
          roomCode={roomCode}
          playerName={playerName}
          onLeave={handleLeaveOnline}
        />
      </div>
    );
  }

  // --- Local mode ---
  return (
    <div className="app">
      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} onBack={() => setMode('menu')} />
      )}
      {screen === 'loading' && (
        <div className="setup-screen">
          <div className="setup-logo">
            <div className="logo-icon">⛳</div>
            <h1>Loading daily words...</h1>
          </div>
        </div>
      )}
      {screen === 'game' && gameState && (
        <GameScreen
          gameState={gameState}
          setGameState={setGameState}
          onHoleComplete={handleHoleComplete}
        />
      )}
      {screen === 'scorecard' && (
        <ScorecardScreen
          scorecard={scorecard}
          player1Name={gameState.player1Name}
          player2Name={gameState.player2Name}
          par={gameState.par}
          gameMode={gameState.gameMode}
          holesPerRound={gameState.holesPerRound}
          wordSource={gameState.wordSource}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}

export default App;
