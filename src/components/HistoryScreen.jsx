import { useState } from 'react';
import { getHistory, clearHistory } from '../hooks/useGameHistory';
import { formatScore, GAME_MODES } from '../gameLogic';

export default function HistoryScreen({ onBack }) {
  const [history, setHistory] = useState(() => getHistory());
  const [selectedGame, setSelectedGame] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? history : history.filter(g => g.gameMode === filter);

  const handleClear = () => {
    if (window.confirm('Clear all game history?')) {
      clearHistory();
      setHistory([]);
      setSelectedGame(null);
    }
  };

  // Drill-down view
  if (selectedGame) {
    const g = selectedGame;
    const totalPar = g.scorecard.length * g.par;
    const isBestBall = g.gameMode === 'bestball';
    const isStroke = g.gameMode === 'stroke';
    const isSequential = isStroke || isBestBall;

    const bestBallScores = isBestBall ? g.scorecard.map(h => Math.min(h.player1Guesses, h.player2Guesses)) : [];
    const bestBallTotal = bestBallScores.reduce((s, v) => s + v, 0);

    return (
      <div className="history-screen">
        <button className="back-link" onClick={() => setSelectedGame(null)}>← Back to history</button>

        <h2 className="history-detail-title">
          {g.player1Name} {isStroke ? 'vs' : '&'} {g.player2Name}
        </h2>
        <div className="history-detail-meta">
          {GAME_MODES[g.gameMode]?.label || g.gameMode} — {new Date(g.date).toLocaleDateString()}
          {g.roomCode && <span className="history-room-code">{g.roomCode}</span>}
        </div>

        <div className="scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th>Hole</th>
                {g.scorecard.map((_, i) => <th key={i}>{i + 1}</th>)}
                <th className="total-col">TOT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="par-row">
                <td>Par</td>
                {g.scorecard.map((_, i) => <td key={i}>{g.par}</td>)}
                <td className="total-col">{totalPar}</td>
              </tr>
              <tr>
                <td>{g.player1Name}</td>
                {g.scorecard.map((h, i) => {
                  const isWinner = isSequential && h.player1Guesses <= h.player2Guesses;
                  return <td key={i} className={isWinner ? 'hole-winner' : ''}>{h.player1Guesses}</td>;
                })}
                <td className="total-col">{g.scorecard.reduce((s, h) => s + h.player1Guesses, 0)}</td>
              </tr>
              <tr>
                <td>{g.player2Name}</td>
                {g.scorecard.map((h, i) => {
                  const isWinner = isSequential && h.player2Guesses <= h.player1Guesses;
                  return <td key={i} className={isWinner ? 'hole-winner' : ''}>{h.player2Guesses}</td>;
                })}
                <td className="total-col">{g.scorecard.reduce((s, h) => s + h.player2Guesses, 0)}</td>
              </tr>
              {!isStroke && (
                <tr className="team-row">
                  <td>Team</td>
                  {g.scorecard.map((h, i) => {
                    const score = isBestBall ? bestBallScores[i] : (h.totalGuesses || h.player1Guesses + h.player2Guesses);
                    const diff = score - g.par;
                    return <td key={i} className={diff < 0 ? 'under' : diff > 0 ? 'over' : 'even'}>{score}</td>;
                  })}
                  <td className="total-col">
                    {isBestBall ? bestBallTotal : g.scorecard.reduce((s, h) => s + (h.totalGuesses || h.player1Guesses + h.player2Guesses), 0)}
                  </td>
                </tr>
              )}
              <tr className="score-row">
                <td>+/-</td>
                {g.scorecard.map((h, i) => {
                  const score = isBestBall ? bestBallScores[i] : isStroke ? Math.min(h.player1Guesses, h.player2Guesses) : (h.totalGuesses || h.player1Guesses + h.player2Guesses);
                  const diff = score - g.par;
                  return <td key={i} className={diff < 0 ? 'under' : diff > 0 ? 'over' : 'even'}>{formatScore(diff)}</td>;
                })}
                <td className={`total-col ${g.finalScore < 0 ? 'under' : g.finalScore > 0 ? 'over' : 'even'}`}>
                  {formatScore(g.finalScore)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="final-result">
          <div className="final-score">{formatScore(g.finalScore)}</div>
          <div className="final-label">
            {isStroke
              ? (() => {
                  const p1w = g.scorecard.filter(h => h.player1Guesses < h.player2Guesses).length;
                  const p2w = g.scorecard.filter(h => h.player2Guesses < h.player1Guesses).length;
                  return p1w === p2w ? 'Tied' : `${p1w > p2w ? g.player1Name : g.player2Name} wins`;
                })()
              : g.finalScore < 0 ? 'Under Par' : g.finalScore > 0 ? 'Over Par' : 'Even Par'}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="history-screen">
      <h1 className="scorecard-title">Game History</h1>

      <div className="history-filters">
        {['all', 'scramble', 'stroke', 'bestball'].map(f => (
          <button
            key={f}
            className={`option-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : GAME_MODES[f]?.label || f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">No games yet. Play a round to see your history here!</div>
      ) : (
        <div className="history-list">
          {filtered.map(game => (
            <button
              key={game.id}
              className="history-item"
              onClick={() => setSelectedGame(game)}
            >
              <div className="history-item-header">
                <span className="history-item-players">
                  {game.player1Name} {game.gameMode === 'stroke' ? 'vs' : '&'} {game.player2Name}
                </span>
                <span className={`history-item-score ${game.finalScore < 0 ? 'under' : game.finalScore > 0 ? 'over' : 'even'}`}>
                  {formatScore(game.finalScore)}
                </span>
              </div>
              <div className="history-item-meta">
                <span>{GAME_MODES[game.gameMode]?.icon} {GAME_MODES[game.gameMode]?.label}</span>
                <span>{game.totalHoles} holes, Par {game.par}</span>
                <span>{new Date(game.date).toLocaleDateString()}</span>
                {game.roomCode && <span className="history-room-badge">{game.roomCode}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="history-actions">
        {history.length > 0 && (
          <button className="back-link" onClick={handleClear}>Clear History</button>
        )}
        <button className="back-link" onClick={onBack}>← Back to menu</button>
      </div>
    </div>
  );
}
