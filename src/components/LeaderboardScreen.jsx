import { useLeaderboard } from '../hooks/useLeaderboard';
import { GAME_MODES } from '../gameLogic';
import { getTodayET } from '../words';

export default function LeaderboardScreen({ onBack }) {
  const { scores, currentDate, dates, connected, fetchDate } = useLeaderboard();

  const today = getTodayET();
  const isToday = currentDate === today;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const getScoreLabel = (guesses) => {
    const par = 4;
    const diff = guesses - par;
    if (guesses === 1) return { text: 'HIO', cls: 'under' };
    if (diff <= -2) return { text: `${diff}`, cls: 'under' };
    if (diff === -1) return { text: '-1', cls: 'under' };
    if (diff === 0) return { text: 'E', cls: 'even' };
    return { text: `+${diff}`, cls: 'over' };
  };

  return (
    <div className="leaderboard-screen">
      <h1 className="scorecard-title">Daily Leaderboard</h1>

      <div className="leaderboard-date-nav">
        <button
          className="date-nav-btn"
          onClick={() => {
            const idx = dates.indexOf(currentDate);
            if (idx < dates.length - 1) fetchDate(dates[idx + 1]);
          }}
          disabled={dates.indexOf(currentDate) >= dates.length - 1}
        >
          ←
        </button>
        <div className="leaderboard-date">
          {formatDate(currentDate)}
          {isToday && <span className="today-badge">Today</span>}
        </div>
        <button
          className="date-nav-btn"
          onClick={() => {
            const idx = dates.indexOf(currentDate);
            if (idx > 0) fetchDate(dates[idx - 1]);
          }}
          disabled={dates.indexOf(currentDate) <= 0}
        >
          →
        </button>
      </div>

      {!connected && (
        <div className="leaderboard-status">Connecting to leaderboard...</div>
      )}

      {connected && scores.length === 0 && (
        <div className="history-empty">
          No scores for {formatDate(currentDate)} yet.
          {isToday && ' Play a Daily game to be the first!'}
        </div>
      )}

      {scores.length > 0 && (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>Mode</th>
                <th>Guesses</th>
                <th>Score</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, i) => {
                const label = getScoreLabel(entry.guessCount);
                return (
                  <tr key={entry.id} className={i === 0 ? 'leader' : ''}>
                    <td className="rank">{i + 1}</td>
                    <td className="team-name">
                      {entry.team}
                      {entry.roomCode && (
                        <span className="lb-room-code">{entry.roomCode}</span>
                      )}
                    </td>
                    <td className="mode-cell">
                      {GAME_MODES[entry.gameMode]?.icon || ''} {GAME_MODES[entry.gameMode]?.label || entry.gameMode}
                      {entry.wordSource === 'mystery' && <span className="lb-mystery-tag">Mystery</span>}
                    </td>
                    <td className="guesses-cell">{entry.guessCount}</td>
                    <td className={`score-cell ${label.cls}`}>{label.text}</td>
                    <td className="time-cell">{formatTime(entry.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button className="back-link" onClick={onBack}>← Back to menu</button>
    </div>
  );
}
