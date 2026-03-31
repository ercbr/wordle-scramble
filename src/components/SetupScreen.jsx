import { useState } from 'react';
import { GAME_MODES } from '../gameLogic';

const modeList = Object.values(GAME_MODES);

export default function SetupScreen({ onStart, onBack, onlineMode, player1Name, player2Name }) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [holes, setHoles] = useState(9);
  const [par, setPar] = useState(4);
  const [gameMode, setGameMode] = useState('scramble');
  const [wordSource, setWordSource] = useState('random');

  const canStart = onlineMode || (player1.trim() && player2.trim());

  const handleStart = () => {
    const isLocked = wordSource === 'daily' || wordSource === 'mystery';
    const h = isLocked ? 1 : holes;
    const p = isLocked ? 4 : par;
    if (onlineMode) {
      onStart(player1Name, player2Name, h, p, gameMode, wordSource);
    } else {
      onStart(player1.trim(), player2.trim(), h, p, gameMode, wordSource);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-logo">
        <div className="logo-icon">⛳</div>
        <h1>Wordle Scramble</h1>
        <p className="subtitle">{onlineMode ? 'Configure Game' : 'Team Wordle with Golf Scoring'}</p>
      </div>

      <div className="setup-card">
        {!onlineMode && (
          <>
            <div className="setup-section">
              <label>Player 1</label>
              <input
                type="text"
                value={player1}
                onChange={e => setPlayer1(e.target.value)}
                placeholder="Enter name..."
                maxLength={16}
                autoFocus
              />
            </div>

            <div className="setup-section">
              <label>Player 2</label>
              <input
                type="text"
                value={player2}
                onChange={e => setPlayer2(e.target.value)}
                placeholder="Enter name..."
                maxLength={16}
              />
            </div>
          </>
        )}

        {onlineMode && (
          <div className="lobby-players" style={{ marginBottom: '1rem' }}>
            <div className="lobby-player joined">
              <span className="player-dot p1" /> {player1Name}
            </div>
            <div className="lobby-player joined">
              <span className="player-dot p2" /> {player2Name}
            </div>
          </div>
        )}

        <div className="setup-section">
          <label>Game Mode</label>
          <div className="mode-selector">
            {modeList.map(m => (
              <button
                key={m.id}
                className={`mode-btn ${gameMode === m.id ? 'active' : ''}`}
                onClick={() => setGameMode(m.id)}
              >
                <span className="mode-icon">{m.icon}</span>
                <span className="mode-label">{m.label}</span>
                <span className="mode-desc">{m.description}</span>
              </button>
            ))}
          </div>
          {gameMode === 'bestball' && (
            <p className="mode-note">2 rounds will be played ({holes * 2} holes total)</p>
          )}
        </div>

        <div className="setup-section">
          <label>Words</label>
          <div className="button-group word-source-group">
            <button
              className={`option-btn ${wordSource === 'random' ? 'active' : ''}`}
              onClick={() => setWordSource('random')}
            >
              Random
            </button>
            <button
              className={`option-btn ${wordSource === 'daily' ? 'active' : ''}`}
              onClick={() => setWordSource('daily')}
            >
              Daily
            </button>
            <button
              className={`option-btn ${wordSource === 'mystery' ? 'active' : ''}`}
              onClick={() => setWordSource('mystery')}
            >
              Mystery
            </button>
          </div>
          {wordSource === 'daily' && (
            <p className="mode-note">Today's official Wordle — 1 hole, Par 4. Scores posted to leaderboard.</p>
          )}
          {wordSource === 'mystery' && (
            <p className="mode-note">Same mystery word for everyone today — not the NYT word. Scores posted to leaderboard.</p>
          )}
        </div>

        {wordSource !== 'daily' && wordSource !== 'mystery' && (
          <div className="setup-row">
            <div className="setup-section">
              <label>Holes{gameMode === 'bestball' ? ' per Round' : ''}</label>
              <div className="button-group">
                {[1, 3, 6, 9, 18].map(n => (
                  <button
                    key={n}
                    className={`option-btn ${holes === n ? 'active' : ''}`}
                    onClick={() => setHoles(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-section">
              <label>Par</label>
              <div className="button-group">
                {[3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    className={`option-btn ${par === n ? 'active' : ''}`}
                    onClick={() => setPar(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          className="start-btn"
          disabled={!canStart}
          onClick={handleStart}
        >
          Tee Off
        </button>

        {onBack && (
          <button className="back-link" onClick={onBack}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
