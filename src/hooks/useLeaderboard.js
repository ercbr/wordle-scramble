import { useState, useEffect, useRef, useCallback } from 'react';
import PartySocket from 'partysocket';
import { getTodayET } from '../words';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST
  || `${window.location.hostname}:1999`;

export function useLeaderboard(enabled = true) {
  const [scores, setScores] = useState([]);
  const [currentDate, setCurrentDate] = useState(getTodayET());
  const [dates, setDates] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const ws = new PartySocket({
      host: PARTYKIT_HOST,
      room: 'daily-leaderboard',
      party: 'leaderboard',
    });

    ws.addEventListener('open', () => setConnected(true));
    ws.addEventListener('close', () => setConnected(false));

    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'scores') {
        setScores(msg.scores);
        setCurrentDate(msg.date);
      }
      if (msg.type === 'dates') {
        setDates(msg.dates);
      }
    });

    wsRef.current = ws;
    return () => { ws.close(); wsRef.current = null; };
  }, [enabled]);

  const postScore = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'post_score', ...data }));
    }
  }, []);

  const fetchDate = useCallback((date) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_scores', date }));
    }
  }, []);

  return { scores, currentDate, dates, connected, postScore, fetchDate };
}
