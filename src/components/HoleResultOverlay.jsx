import { useEffect, useState } from 'react';

export default function HoleResultOverlay({
  scoreInfo, totalGuesses, par, onNext, isLastHole,
  gameMode, p1Count, p2Count, player1Name, player2Name,
  suddenDeathRound,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const isSequential = ['stroke', 'bestball', 'relay', 'sudden_death'].includes(gameMode);
  const bestScore = isSequential ? Math.min(p1Count, p2Count) : null;

  return (
    <div className={`overlay ${visible ? 'show' : ''}`}>
      <div className="overlay-card">
        <div className="result-emoji">{scoreInfo.emoji}</div>
        <h2 className="result-label">{scoreInfo.label}</h2>

        {gameMode === 'sudden_death' ? (
          <div className="result-players">
            <div className="result-detail">
              {suddenDeathRound === 1 ? 'Solved in Round 1!' : `${suddenDeathRound} rounds`} — Par {par}
            </div>
            <div className={`result-player-score ${p1Count <= p2Count ? 'winner' : ''}`}>
              <span className="player-dot p1" />
              {player1Name}: {p1Count} guess{p1Count !== 1 ? 'es' : ''}
            </div>
            <div className={`result-player-score ${p2Count <= p1Count ? 'winner' : ''}`}>
              <span className="player-dot p2" />
              {player2Name}: {p2Count} guess{p2Count !== 1 ? 'es' : ''}
            </div>
          </div>
        ) : isSequential ? (
          <div className="result-players">
            <div className={`result-player-score ${p1Count <= p2Count ? 'winner' : ''}`}>
              <span className="player-dot p1" />
              {player1Name}: {p1Count} guess{p1Count !== 1 ? 'es' : ''}
            </div>
            <div className={`result-player-score ${p2Count <= p1Count ? 'winner' : ''}`}>
              <span className="player-dot p2" />
              {player2Name}: {p2Count} guess{p2Count !== 1 ? 'es' : ''}
            </div>
            {gameMode === 'bestball' && (
              <div className="result-detail" style={{ marginTop: '0.5rem' }}>
                Team score: {bestScore} — Par {par}
              </div>
            )}
            {gameMode === 'stroke' && (
              <div className="result-detail" style={{ marginTop: '0.5rem' }}>
                {p1Count === p2Count ? 'Tied!' : `${p1Count < p2Count ? player1Name : player2Name} wins the hole!`}
              </div>
            )}
            {gameMode === 'relay' && (
              <div className="result-detail" style={{ marginTop: '0.5rem' }}>
                {totalGuesses} total guesses — Par {par}
              </div>
            )}
          </div>
        ) : (
          <div className="result-detail">
            {totalGuesses} guess{totalGuesses !== 1 ? 'es' : ''} — Par {par}
          </div>
        )}

        <div className={`result-score ${scoreInfo.diff < 0 ? 'under' : scoreInfo.diff > 0 ? 'over' : 'even'}`}>
          {scoreInfo.diff === 0 ? 'Even' : scoreInfo.diff > 0 ? `+${scoreInfo.diff}` : scoreInfo.diff}
        </div>
        <button className="next-btn" onClick={onNext}>
          {isLastHole ? 'View Scorecard' : 'Next Hole →'}
        </button>
      </div>
    </div>
  );
}
