// Leaderboard server — persists daily scores using Cloudflare Durable Object storage
// Single room "daily-leaderboard" stores all tournament data

export default class LeaderboardServer {
  constructor(room) {
    this.room = room;
  }

  async onConnect(conn) {
    // Send today's scores on connect
    const today = new Date().toISOString().slice(0, 10);
    const scores = await this.getScoresForDate(today);
    conn.send(JSON.stringify({ type: 'scores', date: today, scores }));

    // Also send available dates
    const dates = await this.getDates();
    conn.send(JSON.stringify({ type: 'dates', dates }));
  }

  onClose(conn) {}

  async onMessage(message, sender) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }

    switch (msg.type) {
      case 'post_score': return await this.handlePostScore(sender, msg);
      case 'get_scores': return await this.handleGetScores(sender, msg);
      case 'get_dates': return await this.handleGetDates(sender);
    }
  }

  async handlePostScore(conn, msg) {
    const { player1, player2, gameMode, wordSource, guessCount, roomCode, date } = msg;
    const scoreDate = date || new Date().toISOString().slice(0, 10);
    const key = `scores:${scoreDate}`;

    // Get existing scores for this date
    const existing = (await this.room.storage.get(key)) || [];

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      team: `${player1} & ${player2}`,
      player1,
      player2,
      gameMode,
      wordSource: wordSource || 'daily',
      guessCount,
      roomCode: roomCode || null,
      timestamp: new Date().toISOString(),
    };

    existing.push(entry);
    await this.room.storage.put(key, existing);

    // Track this date in the dates index
    const datesKey = 'dates_index';
    const dates = (await this.room.storage.get(datesKey)) || [];
    if (!dates.includes(scoreDate)) {
      dates.push(scoreDate);
      dates.sort().reverse(); // newest first
      await this.room.storage.put(datesKey, dates);
    }

    // Broadcast updated scores to all connected clients
    const allScores = await this.getScoresForDate(scoreDate);
    this.broadcast({ type: 'scores', date: scoreDate, scores: allScores });
    this.broadcast({ type: 'dates', dates: await this.getDates() });
  }

  async handleGetScores(conn, msg) {
    const date = msg.date || new Date().toISOString().slice(0, 10);
    const scores = await this.getScoresForDate(date);
    conn.send(JSON.stringify({ type: 'scores', date, scores }));
  }

  async handleGetDates(conn) {
    const dates = await this.getDates();
    conn.send(JSON.stringify({ type: 'dates', dates }));
  }

  async getScoresForDate(date) {
    const key = `scores:${date}`;
    const scores = (await this.room.storage.get(key)) || [];
    // Sort by guess count (ascending = best first)
    return scores.sort((a, b) => a.guessCount - b.guessCount);
  }

  async getDates() {
    const datesKey = 'dates_index';
    return (await this.room.storage.get(datesKey)) || [];
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }
}
