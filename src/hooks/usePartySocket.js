import { useState, useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';

// In dev, use the same hostname the browser loaded from (so LAN access works)
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST
  || `${window.location.hostname}:1999`;

export function usePartySocket(roomCode, playerName) {
  const [roomState, setRoomState] = useState(null);
  const [myPlayerNumber, setMyPlayerNumber] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const sessionTokenRef = useRef(localStorage.getItem(`wordle_token_${roomCode}`));

  useEffect(() => {
    if (!roomCode || !playerName) return;

    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
    });

    ws.addEventListener('open', () => {
      setStatus('connected');
      setError(null);
      ws.send(JSON.stringify({
        type: 'join',
        name: playerName,
        sessionToken: sessionTokenRef.current,
      }));
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'assign':
          setMyPlayerNumber(msg.playerNumber);
          sessionTokenRef.current = msg.sessionToken;
          localStorage.setItem(`wordle_token_${roomCode}`, msg.sessionToken);
          break;
        case 'room_state':
          setRoomState(msg.state);
          break;
        case 'error':
          setError(msg.message);
          setTimeout(() => setError(null), 3000);
          break;
        default:
          break;
      }
    });

    ws.addEventListener('close', () => {
      setStatus('disconnected');
    });

    ws.addEventListener('error', () => {
      setStatus('error');
    });

    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, playerName]);

  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { roomState, myPlayerNumber, send, status, error };
}
