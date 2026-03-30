import { useState } from 'react';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function LobbyScreen({ onJoinRoom, onBack }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    const code = generateRoomCode();
    onJoinRoom(code, name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || roomCode.trim().length < 3) return;
    onJoinRoom(roomCode.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="setup-screen">
      <div className="setup-logo">
        <div className="logo-icon">⛳</div>
        <h1>Wordle Scramble</h1>
        <p className="subtitle">Online Multiplayer</p>
      </div>

      <div className="setup-card">
        <div className="setup-section">
          <label>Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={16}
            autoFocus
          />
        </div>

        {!mode && (
          <div className="lobby-buttons">
            <button
              className="start-btn"
              disabled={!name.trim()}
              onClick={() => handleCreate()}
            >
              Create Room
            </button>
            <button
              className="start-btn secondary-btn"
              disabled={!name.trim()}
              onClick={() => setMode('join')}
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'join' && (
          <>
            <div className="setup-section">
              <label>Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. G7K2M"
                maxLength={5}
                className="room-code-input"
                autoFocus
              />
            </div>
            <button
              className="start-btn"
              disabled={!name.trim() || roomCode.trim().length < 3}
              onClick={handleJoin}
            >
              Join
            </button>
          </>
        )}

        <button className="back-link" onClick={onBack}>
          ← Back to menu
        </button>
      </div>
    </div>
  );
}
