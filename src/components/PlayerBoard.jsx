import { evaluateGuess } from '../gameLogic';

export default function PlayerBoard({ playerName, guesses, targetWord, isActive, playerNumber, maxRows = 6, onlineMode, dimmed }) {
  const rows = [];
  for (let i = 0; i < maxRows; i++) {
    const entry = guesses[i];
    if (entry) {
      // guesses are now {word, evaluation?} objects from GameScreen
      const word = entry.word;
      const evaluation = entry.evaluation || evaluateGuess(word, targetWord);
      rows.push(
        <div key={i} className="tile-row filled">
          {word.split('').map((letter, j) => (
            <div
              key={j}
              className={`tile ${evaluation[j]} flip`}
              style={{ animationDelay: `${j * 0.15}s` }}
            >
              <div className="tile-inner">
                <div className="tile-front">{letter}</div>
                <div className={`tile-back ${evaluation[j]}`}>{letter}</div>
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      rows.push(
        <div key={i} className="tile-row empty">
          {Array(5).fill(null).map((_, j) => (
            <div key={j} className="tile blank">
              <div className="tile-inner">
                <div className="tile-front"></div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className={`player-board ${isActive ? 'active' : ''} ${dimmed ? 'dimmed' : ''}`}>
      <div className="player-header">
        <span className={`player-dot p${playerNumber}`} />
        <span className="player-name">{playerName}</span>
        {isActive && <span className="turn-badge">YOUR TURN</span>}
      </div>
      <div className="tile-grid">
        {rows}
      </div>
      <div className="guess-count">{guesses.length} guess{guesses.length !== 1 ? 'es' : ''}</div>
    </div>
  );
}
