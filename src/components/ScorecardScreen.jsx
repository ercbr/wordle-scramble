import { useState, useEffect, useRef } from 'react';
import { formatScore } from '../gameLogic';
import { saveGame } from '../hooks/useGameHistory';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { getTodayET } from '../words';

export default function ScorecardScreen({ scorecard, player1Name, player2Name, par, gameMode = 'scramble', holesPerRound, roomCode, wordSource, onPlayAgain }) {
  const saved = useRef(false);
  const [postedToLeaderboard, setPostedToLeaderboard] = useState(false);
  const isLeaderboardMode = wordSource === 'daily' || wordSource === 'mystery';
  const { postScore, connected: lbConnected } = useLeaderboard(isLeaderboardMode);
  const totalP1 = scorecard.reduce((sum, h) => sum + h.player1Guesses, 0);
  const totalP2 = scorecard.reduce((sum, h) => sum + h.player2Guesses, 0);
  const totalPar = scorecard.length * par;

  // Scoring depends on mode
  const isStroke = gameMode === 'stroke';
  const isBestBall = gameMode === 'bestball';
  const isSequential = isStroke || isBestBall;

  // For stroke play: count holes won by each player
  const p1Wins = isStroke ? scorecard.filter(h => h.player1Guesses < h.player2Guesses).length : 0;
  const p2Wins = isStroke ? scorecard.filter(h => h.player2Guesses < h.player1Guesses).length : 0;
  const ties = isStroke ? scorecard.filter(h => h.player1Guesses === h.player2Guesses).length : 0;

  // For best ball: team score = min of each hole
  const bestBallScores = isBestBall ? scorecard.map(h => Math.min(h.player1Guesses, h.player2Guesses)) : [];
  const bestBallTotal = bestBallScores.reduce((s, v) => s + v, 0);
  const bestBallDiff = bestBallTotal - totalPar;

  // For scramble: team total
  const scrambleTotal = scorecard.reduce((sum, h) => sum + (h.totalGuesses || h.player1Guesses + h.player2Guesses), 0);
  const scrambleDiff = scrambleTotal - totalPar;

  // The "main" diff for display
  const mainDiff = isStroke ? (totalP1 - totalPar) : isBestBall ? bestBallDiff : scrambleDiff;

  // Auto-save game to history + post to leaderboard for daily
  useEffect(() => {
    if (!saved.current && scorecard.length > 0) {
      saved.current = true;
      saveGame({
        gameMode,
        player1Name,
        player2Name,
        par,
        totalHoles: scorecard.length,
        scorecard,
        roomCode: roomCode || null,
        wordSource: wordSource || 'random',
        finalScore: mainDiff,
      });
    }
  }, []);

  // Post to leaderboard when daily and connected
  useEffect(() => {
    if (isLeaderboardMode && lbConnected && !postedToLeaderboard && scorecard.length > 0) {
      const guessCount = gameMode === 'scramble'
        ? scrambleTotal
        : Math.min(totalP1, totalP2);
      postScore({
        player1: player1Name,
        player2: player2Name,
        gameMode,
        wordSource: wordSource || 'daily',
        guessCount,
        roomCode: roomCode || null,
        date: getTodayET(),
      });
      setPostedToLeaderboard(true);
    }
  }, [isLeaderboardMode, lbConnected, postedToLeaderboard]);

  return (
    <div className="scorecard-screen">
      <h1 className="scorecard-title">Scorecard</h1>
      <div className="scorecard-players">
        {player1Name} {isStroke ? 'vs' : '&'} {player2Name}
        <span className="scorecard-mode"> — {gameMode === 'scramble' ? 'Scramble' : isStroke ? 'Stroke Play' : 'Best Ball'}</span>
      </div>

      <div className="scorecard-table-wrap">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Hole</th>
              {scorecard.map((_, i) => (
                <th key={i} className={isBestBall && holesPerRound && i === holesPerRound ? 'round-sep' : ''}>
                  {i + 1}
                </th>
              ))}
              <th className="total-col">TOT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="par-row">
              <td>Par</td>
              {scorecard.map((_, i) => <td key={i}>{par}</td>)}
              <td className="total-col">{totalPar}</td>
            </tr>

            {/* Player 1 row */}
            <tr>
              <td>{player1Name}</td>
              {scorecard.map((h, i) => {
                const isWinner = isSequential && h.player1Guesses <= h.player2Guesses;
                return (
                  <td key={i} className={isWinner ? 'hole-winner' : ''}>
                    {h.player1Guesses}
                  </td>
                );
              })}
              <td className="total-col">{totalP1}</td>
            </tr>

            {/* Player 2 row */}
            <tr>
              <td>{player2Name}</td>
              {scorecard.map((h, i) => {
                const isWinner = isSequential && h.player2Guesses <= h.player1Guesses;
                return (
                  <td key={i} className={isWinner ? 'hole-winner' : ''}>
                    {h.player2Guesses}
                  </td>
                );
              })}
              <td className="total-col">{totalP2}</td>
            </tr>

            {/* Team row (scramble and best ball) */}
            {!isStroke && (
              <tr className="team-row">
                <td>Team</td>
                {scorecard.map((h, i) => {
                  const score = isBestBall ? bestBallScores[i] : (h.totalGuesses || h.player1Guesses + h.player2Guesses);
                  const diff = score - par;
                  return (
                    <td key={i} className={diff < 0 ? 'under' : diff > 0 ? 'over' : 'even'}>
                      {score}
                    </td>
                  );
                })}
                <td className={`total-col ${(isBestBall ? bestBallDiff : scrambleDiff) < 0 ? 'under' : (isBestBall ? bestBallDiff : scrambleDiff) > 0 ? 'over' : 'even'}`}>
                  {isBestBall ? bestBallTotal : scrambleTotal}
                </td>
              </tr>
            )}

            {/* +/- row */}
            <tr className="score-row">
              <td>+/-</td>
              {scorecard.map((h, i) => {
                const score = isBestBall ? bestBallScores[i] : isStroke ? Math.min(h.player1Guesses, h.player2Guesses) : (h.totalGuesses || h.player1Guesses + h.player2Guesses);
                const diff = score - par;
                return (
                  <td key={i} className={diff < 0 ? 'under' : diff > 0 ? 'over' : 'even'}>
                    {formatScore(diff)}
                  </td>
                );
              })}
              <td className={`total-col ${mainDiff < 0 ? 'under' : mainDiff > 0 ? 'over' : 'even'}`}>
                {formatScore(mainDiff)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="final-result">
        {isStroke ? (
          <>
            <div className="final-score stroke-result">
              {p1Wins === p2Wins
                ? 'Tied!'
                : `${p1Wins > p2Wins ? player1Name : player2Name} Wins!`}
            </div>
            <div className="final-label">
              {p1Wins}–{p2Wins}{ties > 0 ? `–${ties}` : ''} (W–L{ties > 0 ? '–T' : ''})
            </div>
          </>
        ) : (
          <>
            <div className="final-score">
              {formatScore(isBestBall ? bestBallDiff : scrambleDiff)}
            </div>
            <div className="final-label">
              {(isBestBall ? bestBallDiff : scrambleDiff) < 0 ? 'Under Par' : (isBestBall ? bestBallDiff : scrambleDiff) > 0 ? 'Over Par' : 'Even Par'}
            </div>
          </>
        )}
      </div>

      {isLeaderboardMode && postedToLeaderboard && (
        <div className="leaderboard-posted">Posted to Daily Leaderboard</div>
      )}

      <button className="start-btn scorecard-btn" onClick={onPlayAgain}>
        Play Again
      </button>
    </div>
  );
}
