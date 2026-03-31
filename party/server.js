import { evaluateGuess, getScoreLabel, getHoleScore, getEffectiveHoles, isValidWord, getRandomWord, getDailyWords, MAX_GUESSES_PER_PLAYER } from '../src/gameLogic.js';
import { getMysteryWord } from '../src/words.js';

export default class WordleScrambleServer {
  constructor(room) {
    this.room = room;
    this.state = {
      phase: 'lobby',
      players: {},
      hostId: null,
      // Game config
      gameMode: 'scramble',
      totalHoles: 9,
      holesPerRound: 9,
      par: 4,
      // Game state
      currentHole: 1,
      targetWord: null,
      player1Guesses: [],
      player2Guesses: [],
      currentPlayer: 1,
      solved: false,
      solvedBy: null,
      revealedWord: null,
      scorecard: [],
      // Sequential mode
      activePlayerPhase: null,
      p1HoleGuessCount: null,
      p1HoleGuesses: null,
    };
    this.sessionTokens = {};
  }

  onConnect(conn) {}

  onClose(conn) {
    const player = this.state.players[conn.id];
    if (player) {
      player.connected = false;
      this.broadcast({ type: 'player_disconnected', playerNumber: player.playerNumber });
      this.broadcastState();
    }
  }

  onMessage(message, sender) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }

    switch (msg.type) {
      case 'join': return this.handleJoin(sender, msg);
      case 'start_game': return this.handleStartGame(sender, msg);
      case 'submit_guess': return this.handleSubmitGuess(sender, msg);
      case 'next_hole': return this.handleNextHole(sender);
      case 'play_again': return this.handlePlayAgain(sender);
    }
  }

  handleJoin(conn, msg) {
    const { name, sessionToken } = msg;

    if (sessionToken && this.sessionTokens[sessionToken]) {
      const playerNumber = this.sessionTokens[sessionToken];
      for (const [oldId, player] of Object.entries(this.state.players)) {
        if (player.playerNumber === playerNumber) {
          delete this.state.players[oldId];
          break;
        }
      }
      this.state.players[conn.id] = { name, playerNumber, connected: true };
      if (playerNumber === 1) this.state.hostId = conn.id;
      conn.send(JSON.stringify({ type: 'assign', playerNumber, roomCode: this.room.id, sessionToken }));
      this.broadcast({ type: 'player_reconnected', playerNumber, name });
      this.broadcastState();
      return;
    }

    // Check for disconnected player with same name (browser closed, token lost)
    const disconnectedSlot = Object.entries(this.state.players).find(
      ([, p]) => !p.connected && p.name === name
    );
    if (disconnectedSlot) {
      const [oldId, player] = disconnectedSlot;
      delete this.state.players[oldId];
      const token = this.generateToken();
      this.sessionTokens[token] = player.playerNumber;
      this.state.players[conn.id] = { name, playerNumber: player.playerNumber, connected: true };
      if (player.playerNumber === 1) this.state.hostId = conn.id;
      conn.send(JSON.stringify({ type: 'assign', playerNumber: player.playerNumber, roomCode: this.room.id, sessionToken: token }));
      this.broadcast({ type: 'player_reconnected', playerNumber: player.playerNumber, name });
      this.broadcastState();
      return;
    }

    const activePlayers = Object.values(this.state.players).filter(p => p.connected);
    const allPlayers = Object.values(this.state.players);
    if (activePlayers.length >= 2) {
      conn.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      conn.close();
      return;
    }

    // If there's a disconnected slot with a different name, take it
    const anyDisconnected = Object.entries(this.state.players).find(([, p]) => !p.connected);
    if (anyDisconnected && allPlayers.length >= 2) {
      const [oldId, player] = anyDisconnected;
      delete this.state.players[oldId];
      const token = this.generateToken();
      this.sessionTokens[token] = player.playerNumber;
      this.state.players[conn.id] = { name, playerNumber: player.playerNumber, connected: true };
      if (player.playerNumber === 1) this.state.hostId = conn.id;
      conn.send(JSON.stringify({ type: 'assign', playerNumber: player.playerNumber, roomCode: this.room.id, sessionToken: token }));
      this.broadcast({ type: 'player_reconnected', playerNumber: player.playerNumber, name });
      this.broadcastState();
      return;
    }

    const playerNumber = allPlayers.length === 0 ? 1 : 2;
    const token = this.generateToken();
    this.sessionTokens[token] = playerNumber;
    this.state.players[conn.id] = { name, playerNumber, connected: true };
    if (playerNumber === 1) this.state.hostId = conn.id;

    conn.send(JSON.stringify({ type: 'assign', playerNumber, roomCode: this.room.id, sessionToken: token }));
    this.broadcast({ type: 'player_joined', playerNumber, name });

    if (Object.values(this.state.players).length === 2) {
      this.state.phase = 'setup';
    }
    this.broadcastState();
  }

  handleStartGame(conn, msg) {
    if (conn.id !== this.state.hostId) {
      conn.send(JSON.stringify({ type: 'error', message: 'Only the host can start' }));
      return;
    }
    if (this.state.phase !== 'setup') return;

    const { totalHoles, par, gameMode, wordSource } = msg;
    const mode = gameMode || 'scramble';
    const source = wordSource || 'random';
    const holesPerRound = totalHoles || 9;
    const effectiveHoles = getEffectiveHoles(mode, holesPerRound);
    const isSequential = mode !== 'scramble';
    const dailyWords = source === 'daily' ? getDailyWords(effectiveHoles) : null;
    const mysteryWord = source === 'mystery' ? getMysteryWord() : null;
    const firstWord = dailyWords ? dailyWords[0] : mysteryWord ? mysteryWord : getRandomWord();

    Object.assign(this.state, {
      gameMode: mode,
      wordSource: source,
      dailyWords,
      totalHoles: effectiveHoles,
      holesPerRound,
      par: par || 4,
      currentHole: 1,
      targetWord: firstWord,
      player1Guesses: [],
      player2Guesses: [],
      currentPlayer: 1,
      solved: false,
      solvedBy: null,
      revealedWord: null,
      scorecard: [],
      activePlayerPhase: isSequential ? 1 : null,
      p1HoleGuessCount: null,
      p1HoleGuesses: null,
      phase: 'playing',
    });

    this.broadcastState();
  }

  handleSubmitGuess(conn, msg) {
    if (this.state.phase !== 'playing' || this.state.solved) return;

    const player = this.state.players[conn.id];
    if (!player) return;

    const isSequential = this.state.gameMode !== 'scramble';

    // Turn validation
    if (isSequential) {
      if (player.playerNumber !== this.state.activePlayerPhase) {
        conn.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        return;
      }
    } else {
      if (player.playerNumber !== this.state.currentPlayer) {
        conn.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        return;
      }
    }

    const guess = (msg.guess || '').toLowerCase();
    if (guess.length !== 5) {
      conn.send(JSON.stringify({ type: 'error', message: 'Guess must be 5 letters' }));
      return;
    }
    if (!isValidWord(guess)) {
      conn.send(JSON.stringify({ type: 'error', message: 'Not in word list' }));
      return;
    }

    const evaluation = evaluateGuess(guess, this.state.targetWord);
    const entry = { word: guess, evaluation };
    const isCorrect = guess === this.state.targetWord;

    if (isSequential) {
      this.handleSequentialGuess(player, entry, isCorrect);
    } else {
      this.handleScrambleGuess(player, entry, isCorrect);
    }

    this.broadcastState();
  }

  handleScrambleGuess(player, entry, isCorrect) {
    if (player.playerNumber === 1) {
      this.state.player1Guesses.push(entry);
    } else {
      this.state.player2Guesses.push(entry);
    }

    const p1Count = this.state.player1Guesses.length;
    const p2Count = this.state.player2Guesses.length;
    const bothMaxed = p1Count >= MAX_GUESSES_PER_PLAYER && p2Count >= MAX_GUESSES_PER_PLAYER;

    if (isCorrect || bothMaxed) {
      this.state.solved = true;
      this.state.solvedBy = isCorrect ? player.playerNumber : 0;
      this.state.revealedWord = this.state.targetWord;
      this.state.phase = 'hole_result';
    } else {
      let next = this.state.currentPlayer === 1 ? 2 : 1;
      const p1Maxed = p1Count >= MAX_GUESSES_PER_PLAYER;
      const p2Maxed = p2Count >= MAX_GUESSES_PER_PLAYER;
      if (next === 1 && p1Maxed && !p2Maxed) next = 2;
      if (next === 2 && p2Maxed && !p1Maxed) next = 1;
      this.state.currentPlayer = next;
    }
  }

  handleSequentialGuess(player, entry, isCorrect) {
    const phase = this.state.activePlayerPhase;
    const isP1Phase = phase === 1;

    if (isP1Phase) {
      this.state.player1Guesses.push(entry);
    } else {
      this.state.player2Guesses.push(entry);
    }

    const guesses = isP1Phase ? this.state.player1Guesses : this.state.player2Guesses;
    const guessCount = guesses.length;
    const maxedOut = guessCount >= MAX_GUESSES_PER_PLAYER;
    const phaseComplete = isCorrect || maxedOut;

    if (phaseComplete && isP1Phase) {
      // P1 done → transition to P2
      this.state.p1HoleGuessCount = guessCount;
      this.state.p1HoleGuesses = [...this.state.player1Guesses];
      this.state.player2Guesses = [];
      this.state.activePlayerPhase = 2;
      this.state.currentPlayer = 2;
      this.state.solved = false;
    } else if (phaseComplete && !isP1Phase) {
      // P2 done → hole complete
      this.state.solved = true;
      this.state.solvedBy = isCorrect ? 2 : 0;
      this.state.revealedWord = this.state.targetWord;
      this.state.phase = 'hole_result';
    }
    // If not complete, same player continues (no turn switch)
  }

  handleNextHole(conn) {
    if (this.state.phase !== 'hole_result') return;

    const p1Count = this.state.p1HoleGuessCount ?? this.state.player1Guesses.length;
    const p2Count = this.state.player2Guesses.length;
    const { gameMode, par } = this.state;

    if (gameMode === 'scramble') {
      const total = p1Count + p2Count;
      const scoreInfo = getScoreLabel(total, par);
      this.state.scorecard.push({
        hole: this.state.currentHole, par, gameMode,
        player1Guesses: p1Count, player2Guesses: p2Count,
        totalGuesses: total, score: total - par, label: scoreInfo.label,
      });
    } else {
      const bestScore = Math.min(p1Count, p2Count);
      const effectiveScore = gameMode === 'bestball' ? bestScore : bestScore;
      const scoreInfo = getScoreLabel(effectiveScore, par);
      this.state.scorecard.push({
        hole: this.state.currentHole, par, gameMode,
        player1Guesses: p1Count, player2Guesses: p2Count,
        totalGuesses: p1Count + p2Count,
        teamScore: gameMode === 'bestball' ? bestScore : null,
        score: effectiveScore - par, label: scoreInfo.label,
      });
    }

    if (this.state.currentHole >= this.state.totalHoles) {
      this.state.phase = 'scorecard';
    } else {
      const isSequential = gameMode !== 'scramble';
      const nextHole = this.state.currentHole + 1;
      const nextWord = this.state.dailyWords
        ? this.state.dailyWords[nextHole - 1]
        : getRandomWord();
      Object.assign(this.state, {
        currentHole: nextHole,
        targetWord: nextWord,
        player1Guesses: [],
        player2Guesses: [],
        currentPlayer: 1,
        solved: false,
        solvedBy: null,
        revealedWord: null,
        activePlayerPhase: isSequential ? 1 : null,
        p1HoleGuessCount: null,
        p1HoleGuesses: null,
        phase: 'playing',
      });
    }

    this.broadcastState();
  }

  handlePlayAgain(conn) {
    if (this.state.phase !== 'scorecard') return;
    Object.assign(this.state, {
      phase: 'setup',
      currentHole: 1, targetWord: null,
      player1Guesses: [], player2Guesses: [],
      currentPlayer: 1, solved: false, solvedBy: null, revealedWord: null,
      scorecard: [], activePlayerPhase: null, p1HoleGuessCount: null, p1HoleGuesses: null,
    });
    this.broadcastState();
  }

  getClientState(forPlayerNumber) {
    const players = {};
    for (const [id, p] of Object.entries(this.state.players)) {
      players[p.playerNumber] = { name: p.name, connected: p.connected };
    }

    const { gameMode, activePlayerPhase } = this.state;
    const isSequential = gameMode !== 'scramble';

    // Stroke play: hide P1's guesses from P2 during P1's phase
    let p1Guesses = this.state.player1Guesses;
    let p1HoleGuesses = this.state.p1HoleGuesses;
    if (gameMode === 'stroke' && isSequential && activePlayerPhase === 1 && forPlayerNumber === 2) {
      p1Guesses = []; // P2 can't see P1's active guesses
    }
    if (gameMode === 'stroke' && isSequential && activePlayerPhase === 2 && forPlayerNumber === 2) {
      p1HoleGuesses = null; // P2 can't see P1's stashed guesses in stroke mode
    }

    return {
      phase: this.state.phase,
      players,
      gameMode,
      wordSource: this.state.wordSource || 'random',
      totalHoles: this.state.totalHoles,
      holesPerRound: this.state.holesPerRound,
      par: this.state.par,
      currentHole: this.state.currentHole,
      player1Guesses: p1Guesses,
      player2Guesses: this.state.player2Guesses,
      currentPlayer: this.state.currentPlayer,
      solved: this.state.solved,
      solvedBy: this.state.solvedBy,
      revealedWord: this.state.revealedWord,
      scorecard: this.state.scorecard,
      activePlayerPhase,
      p1HoleGuessCount: this.state.p1HoleGuessCount,
      p1HoleGuesses,
    };
  }

  broadcastState() {
    for (const conn of this.room.getConnections()) {
      const player = this.state.players[conn.id];
      const pNum = player ? player.playerNumber : 1;
      conn.send(JSON.stringify({ type: 'room_state', state: this.getClientState(pNum) }));
    }
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }

  generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 24; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  }
}
