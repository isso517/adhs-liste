import { Chess } from 'chess.js';
import { isValidMove, resolveCombat } from './freestyleChess';
import type { GameState, PieceWithPos } from './freestyleChess';

export type Difficulty = 'easy' | 'medium' | 'hard';

// --- Tic-Tac-Toe AI ---

const checkWinner = (board: (string | null)[]): string | null => {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

// Minimax for TTT
const minimaxTTT = (board: (string | null)[], depth: number, isMaximizing: boolean, aiSymbol: string, playerSymbol: string): number => {
  const winner = checkWinner(board);
  if (winner === aiSymbol) return 10 - depth;
  if (winner === playerSymbol) return depth - 10;
  if (!board.includes(null)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimaxTTT(board, depth + 1, false, aiSymbol, playerSymbol);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = playerSymbol;
        const score = minimaxTTT(board, depth + 1, true, aiSymbol, playerSymbol);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
};

export const getTicTacToeMove = (board: (string | null)[], difficulty: Difficulty = 'medium'): number => {
  const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
  if (emptyIndices.length === 0) return -1;

  if (difficulty === 'easy') {
    // Random
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // AI is always 'O' in our logic for now, Player is 'X'
  const aiSymbol = 'O';
  const playerSymbol = 'X';

  // Medium: 30% chance to make a random mistake, otherwise optimal
  if (difficulty === 'medium' && Math.random() < 0.3) {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  // Hard: Minimax
  let bestScore = -Infinity;
  let move = -1;
  
  // Optimization: If empty board or first move, pick center or corner to save calc
  if (emptyIndices.length >= 8) {
      if (board[4] === null) return 4;
      return 0; 
  }

  for (let i = 0; i < emptyIndices.length; i++) {
    const idx = emptyIndices[i];
    const newBoard = [...board];
    newBoard[idx] = aiSymbol;
    const score = minimaxTTT(newBoard, 0, false, aiSymbol, playerSymbol);
    if (score > bestScore) {
      bestScore = score;
      move = idx;
    }
  }
  return move;
};

// --- RPS AI ---

export const getRPSMove = (history: string[], difficulty: Difficulty = 'medium'): string => {
  const moves = ['rock', 'paper', 'scissors'];
  
  if (difficulty === 'easy' || history.length === 0) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === 'medium') {
    // Beat the player's last move (assuming they repeat it)
    // Or if they just won, they might keep it. If they lost, they might switch.
    // Simple Heuristic: Assume player repeats last move.
    const lastPlayerMove = history[history.length - 1]; // We need player history actually
    // History here is mixed? We need specific player moves.
    // Let's assume input history is just last moves of *player*.
    // Counter last move:
    if (lastPlayerMove === 'rock') return 'paper';
    if (lastPlayerMove === 'paper') return 'scissors';
    if (lastPlayerMove === 'scissors') return 'rock';
  }

  if (difficulty === 'hard') {
    // Beat the move that beats the player's last move (assuming they switch to what beat them? No that's too complex)
    // Nash Equilibrium: Random is actually best.
    // But let's try to detect frequency.
    // Count player moves
    const counts: Record<string, number> = { rock: 0, paper: 0, scissors: 0 };
    history.forEach(m => { if (counts[m] !== undefined) counts[m]++ });
    
    // Predict player will choose their most frequent move
    const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    
    // Counter it
    if (mostFrequent === 'rock') return 'paper';
    if (mostFrequent === 'paper') return 'scissors';
    return 'rock';
  }

  return moves[Math.floor(Math.random() * moves.length)];
};

// --- Chess AI ---

const evaluateBoard = (game: Chess): number => {
  const pieceValues: Record<string, number> = {
    p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 // King value irrelevant for material sum usually
  };
  
  let score = 0;
  const board = game.board();
  
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const val = pieceValues[piece.type] || 0;
        score += piece.color === 'w' ? val : -val;
      }
    }
  }
  // Return positive if Black is winning (since AI is Black/CPU usually? Or we pass color)
  // Let's return White perspective score.
  return score;
};

// Improved Minimax for Chess with Alpha-Beta Pruning
const minimaxChess = (game: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean): number => {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves();
  
  if (isMaximizing) { // White
    let bestScore = -Infinity;
    for (const move of moves) {
      game.move(move);
      const score = minimaxChess(game, depth - 1, alpha, beta, false);
      game.undo();
      bestScore = Math.max(score, bestScore);
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break; // Beta cut-off
    }
    return bestScore;
  } else { // Black
    let bestScore = Infinity;
    for (const move of moves) {
      game.move(move);
      const score = minimaxChess(game, depth - 1, alpha, beta, true);
      game.undo();
      bestScore = Math.min(score, bestScore);
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break; // Alpha cut-off
    }
    return bestScore;
  }
};

export const getChessMove = (fen: string, difficulty: Difficulty = 'medium'): string | null => {
  try {
    const game = new Chess(fen);
    const moves = game.moves();
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      // 80% Random, 20% Best move to not be totally stupid
      if (Math.random() > 0.2) return moves[Math.floor(Math.random() * moves.length)];
    }

    // Determine AI color
    const turn = game.turn(); // 'w' or 'b'
    const isWhite = turn === 'w';

    // Difficulty Settings
    // Medium: Depth 2 (Anticipate opponent's response)
    // Hard: Depth 3 (Anticipate opponent's response to AI's response)
    // Note: Depth 3 in JS can be slow. We might need to optimize or limit moves.
    const depth = difficulty === 'hard' ? 3 : 2;

    let bestMove = null;
    let bestValue = isWhite ? -Infinity : Infinity;
    
    // Sort moves to improve Alpha-Beta pruning efficiency
    // Captures first, then checks, etc.
    // Simple heuristic: Captures first
    const sortedMoves = moves.sort((a, b) => {
        const isCaptureA = a.includes('x');
        const isCaptureB = b.includes('x');
        if (isCaptureA && !isCaptureB) return -1;
        if (!isCaptureA && isCaptureB) return 1;
        return 0;
    });

    for (const move of sortedMoves) {
      game.move(move);
      const boardValue = minimaxChess(game, depth - 1, -Infinity, Infinity, !isWhite);
      game.undo();

      if (isWhite) {
        if (boardValue > bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      } else {
        if (boardValue < bestValue) {
          bestValue = boardValue;
          bestMove = move;
        }
      }
    }

    return bestMove || moves[0];
  } catch (e) {
    console.error("Chess AI Error", e);
    return null;
  }
};

// --- Freestyle Chess AI ---
// (Keeping basic logic but adding aggression scaling)

export const performFreestyleSetup = (gameState: GameState, playerId: string): GameState => {
  const newState = JSON.parse(JSON.stringify(gameState)); // Deep copy
  const myPieces = newState.board.filter((p: PieceWithPos) => p.owner === playerId);
  
  // 2. Set Flag on a back row piece
  const backRowPieces = myPieces.filter((p: PieceWithPos) => p.row === 0 || p.row === 7); 
  if (backRowPieces.length > 0) {
    const flagPiece = backRowPieces[Math.floor(Math.random() * backRowPieces.length)];
    flagPiece.hasFlag = true;
  }
  
  // 3. Mark ready
  newState.setup[playerId] = { ready: true, piecesSet: true };
  
  return newState;
};

export const getFreestyleMove = (gameState: GameState, playerId: string, difficulty: Difficulty = 'medium'): { newState: GameState, moveDescription: string } | null => {
  const board = gameState.board;
  const myPieces = board.filter(p => p.owner === playerId && !p.isDead);
  
  const validMoves: { piece: PieceWithPos, toRow: number, toCol: number, score: number }[] = [];
  
  myPieces.forEach(piece => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(piece, r, c, board)) {
           // Heuristic Scoring
           let score = 0;
           // Check target
           const target = board.find(p => p.row === r && p.col === c && !p.isDead && p.owner !== playerId);
           
           if (target) {
             // Attack!
             score += 10;
             if (target.revealed) {
                // Rock vs Scissors logic
                const wins = (piece.role === 'rock' && target.role === 'scissors') ||
                             (piece.role === 'scissors' && target.role === 'paper') ||
                             (piece.role === 'paper' && target.role === 'rock');
                if (wins) score += 50;
                else if (piece.role !== target.role) score -= 50; // Don't suicide
             } else {
                 // Unknown target
                 score += 5; // Curiosity
             }
           }
           
           // Positional: Advance towards enemy?
           // Assuming CPU is Top (Row 0), Enemy Bottom (Row 7). Advance Row++.
           // If CPU is Bottom, Advance Row--.
           // How to know direction?
           // playerId vs pieces.
           // Heuristic: Move closer to center or enemy side.
           // Center: 3,4.
           const distToCenter = Math.abs(r - 3.5) + Math.abs(c - 3.5);
           score -= distToCenter * 0.5;

           if (difficulty === 'easy') score = Math.random() * 100; // Randomize

           validMoves.push({ piece, toRow: r, toCol: c, score });
        }
      }
    }
  });
  
  if (validMoves.length === 0) return null;
  
  // Sort by score
  validMoves.sort((a, b) => b.score - a.score);
  
  // Pick best (or top 3 random for variety)
  const topMoves = validMoves.slice(0, 3);
  const move = topMoves[Math.floor(Math.random() * topMoves.length)];
  
  // Execute move 
  const newState = JSON.parse(JSON.stringify(gameState));
  const movingPieceIndex = newState.board.findIndex((p: PieceWithPos) => p.id === move.piece.id);
  const movingPiece = newState.board[movingPieceIndex];
  
  const targetIndex = newState.board.findIndex((p: PieceWithPos) => p.row === move.toRow && p.col === move.toCol && !p.isDead);
  const targetPiece = targetIndex !== -1 ? newState.board[targetIndex] : null;
  
  let moveDesc = `AI moved piece to ${move.toRow},${move.toCol}`;

  if (targetPiece) {
    const result = resolveCombat(movingPiece, targetPiece);
    movingPiece.revealed = true;
    targetPiece.revealed = true;
    newState.lastCombat = {
      attackerId: movingPiece.id,
      defenderId: targetPiece.id,
      attackerRole: movingPiece.role,
      defenderRole: targetPiece.role,
      winnerOwnerId: result.draw ? undefined : result.winner?.owner,
      draw: result.draw
    };
    
    if (result.winner === movingPiece) {
      targetPiece.isDead = true;
      movingPiece.row = move.toRow;
      movingPiece.col = move.toCol;
      if (targetPiece.hasFlag) {
        newState.winner = playerId;
        moveDesc += " and captured the Flag!";
      } else {
        moveDesc += " and won combat";
      }
    } else if (result.winner === targetPiece) {
      movingPiece.isDead = true;
      moveDesc += " and died in combat";
    } else {
      movingPiece.isDead = true;
      targetPiece.isDead = true;
      moveDesc += " and both died";
    }
    
    newState.log.push(`Combat: ${movingPiece.role} vs ${targetPiece.role} -> ${result.draw ? 'Draw' : (result.winner === movingPiece ? 'Attacker wins' : 'Defender wins')}`);
    
  } else {
    movingPiece.row = move.toRow;
    movingPiece.col = move.toCol;
    newState.lastCombat = undefined;
  }
  
  return { newState, moveDescription: moveDesc };
};
