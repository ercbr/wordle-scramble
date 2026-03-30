import { usePartySocket } from '../hooks/usePartySocket';
import SetupScreen from './SetupScreen';
import GameScreen from './GameScreen';
import ScorecardScreen from './ScorecardScreen';

export default function OnlineGame({ roomCode, playerName, onLeave }) {
  const { roomState, myPlayerNumber, send, status, error } = usePartySocket(roomCode, playerName);

  // Waiting for connection
  if (status === 'connecting' || !roomState) {
    return (
      <div className="setup-screen">
        <div className="setup-logo">
          <div className="logo-icon">⛳</div>
          <h1>Connecting...</h1>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="setup-screen">
        <div className="setup-logo">
          <div className="logo-icon">⛳</div>
          <h1>Connection Error</h1>
          <p className="subtitle">Could not connect to room {roomCode}</p>
        </div>
        <div className="setup-card">
          <button className="start-btn" onClick={onLeave}>Back to Menu</button>
        </div>
      </div>
    );
  }

  const { phase, players } = roomState;
  const player1 = players[1];
  const player2 = players[2];
  const isHost = myPlayerNumber === 1;

  // --- Lobby: waiting for second player ---
  if (phase === 'lobby') {
    return (
      <div className="setup-screen">
        <div className="setup-logo">
          <div className="logo-icon">⛳</div>
          <h1>Wordle Scramble</h1>
          <p className="subtitle">Online Room</p>
        </div>
        <div className="setup-card">
          <div className="room-code-display">
            <label>Room Code</label>
            <div className="room-code-big">{roomCode}</div>
            <p className="room-code-hint">Share this code with your partner</p>
          </div>
          <div className="lobby-players">
            <div className="lobby-player joined">
              <span className="player-dot p1" /> {player1?.name || 'Waiting...'}
            </div>
            <div className={`lobby-player ${player2 ? 'joined' : 'waiting'}`}>
              <span className="player-dot p2" /> {player2?.name || 'Waiting for Player 2...'}
            </div>
          </div>
          <button className="back-link" onClick={onLeave}>← Leave Room</button>
        </div>
      </div>
    );
  }

  // --- Setup: host configures, guest waits ---
  if (phase === 'setup') {
    if (isHost) {
      return (
        <SetupScreen
          onStart={(_, __, holes, par, gameMode, wordSource) => {
            send({ type: 'start_game', totalHoles: holes, par, gameMode, wordSource });
          }}
          onBack={onLeave}
          onlineMode
          player1Name={player1?.name}
          player2Name={player2?.name}
        />
      );
    }

    return (
      <div className="setup-screen">
        <div className="setup-logo">
          <div className="logo-icon">⛳</div>
          <h1>Wordle Scramble</h1>
        </div>
        <div className="setup-card">
          <div className="waiting-message">
            Waiting for {player1?.name || 'host'} to start the game...
          </div>
          <div className="lobby-players">
            <div className="lobby-player joined">
              <span className="player-dot p1" /> {player1?.name}
            </div>
            <div className="lobby-player joined">
              <span className="player-dot p2" /> {player2?.name}
            </div>
          </div>
          <button className="back-link" onClick={onLeave}>← Leave Room</button>
        </div>
      </div>
    );
  }

  // --- Playing / Hole Result ---
  if (phase === 'playing' || phase === 'hole_result') {
    // Build a gameState-compatible object from roomState
    const gameState = {
      player1Name: player1?.name || 'Player 1',
      player2Name: player2?.name || 'Player 2',
      totalHoles: roomState.totalHoles,
      holesPerRound: roomState.holesPerRound,
      par: roomState.par,
      gameMode: roomState.gameMode || 'scramble',
      currentHole: roomState.currentHole,
      targetWord: roomState.revealedWord,
      player1Guesses: roomState.player1Guesses,
      player2Guesses: roomState.player2Guesses,
      currentPlayer: roomState.currentPlayer,
      solved: roomState.solved,
      solvedBy: roomState.solvedBy,
      activePlayerPhase: roomState.activePlayerPhase,
      p1HoleGuessCount: roomState.p1HoleGuessCount,
      p1HoleGuesses: roomState.p1HoleGuesses,
    };

    return (
      <>
        {error && <div className="game-message online-error">{error}</div>}
        {/* Disconnection banner */}
        {player1 && !player1.connected && (
          <div className="disconnect-banner">{player1.name} disconnected...</div>
        )}
        {player2 && !player2.connected && (
          <div className="disconnect-banner">{player2.name} disconnected...</div>
        )}
        <GameScreen
          gameState={gameState}
          setGameState={() => {}}
          onHoleComplete={() => send({ type: 'next_hole' })}
          onlineMode
          myPlayerNumber={myPlayerNumber}
          send={send}
          roomCode={roomCode}
        />
      </>
    );
  }

  // --- Scorecard ---
  if (phase === 'scorecard') {
    return (
      <ScorecardScreen
        scorecard={roomState.scorecard}
        player1Name={player1?.name || 'Player 1'}
        player2Name={player2?.name || 'Player 2'}
        par={roomState.par}
        gameMode={roomState.gameMode || 'scramble'}
        holesPerRound={roomState.holesPerRound}
        roomCode={roomCode}
        wordSource={roomState.wordSource || 'random'}
        onPlayAgain={() => send({ type: 'play_again' })}
      />
    );
  }

  return null;
}
