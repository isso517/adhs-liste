import { Chess } from 'chess.js';
import { isValidMove, resolveCombat } from './freestyleChess';
import type { GameState, PieceWithPos } from './freestyleChess';

// Tic-Tac-Toe AI
export const getTicTacToeMove = (board: (string | null)[]) => {
  const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
  if (emptyIndices.length === 0) return -1;
  return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
};

// RPS AI
export const getRPSMove = () => {
  const moves = ['rock', 'paper', 'scissors'];
  return moves[Math.floor(Math.random() * moves.length)];
};

// Chess AI
export const getChessMove = (fen: string): string | null => {
  try {
    const game = new Chess(fen);
    const moves = game.moves();
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  } catch (e) {
    console.error("Chess AI Error", e);
    return null;
  }
};

// Freestyle Chess AI

export const performFreestyleSetup = (gameState: GameState, playerId: string): GameState => {
  const newState = JSON.parse(JSON.stringify(gameState)); // Deep copy
  const myPieces = newState.board.filter((p: PieceWithPos) => p.owner === playerId);
  
  // 1. Assign random roles to the 3 customizable pieces (initially random, but let's reshuffle to be "smart" or just random)
  // Actually, initGame already assigns random roles. 
  // We just need to set the Flag.
  
  // 2. Set Flag on a back row piece
  // AI is usually Player 2 (Top), rows 0-1.
  // Back row is 0.
  const backRowPieces = myPieces.filter((p: PieceWithPos) => p.row === 0 || p.row === 7); // Handle both sides
  if (backRowPieces.length > 0) {
    const flagPiece = backRowPieces[Math.floor(Math.random() * backRowPieces.length)];
    flagPiece.hasFlag = true;
  }
  
  // 3. Mark ready
  newState.setup[playerId] = { ready: true, piecesSet: true };
  
  return newState;
};

export const getFreestyleMove = (gameState: GameState, playerId: string): { newState: GameState, moveDescription: string } | null => {
  const board = gameState.board;
  const myPieces = board.filter(p => p.owner === playerId && !p.isDead);
  
  const validMoves: { piece: PieceWithPos, toRow: number, toCol: number }[] = [];
  
  // Generate all valid moves
  myPieces.forEach(piece => {
    // Optimization: Check reasonable range instead of full board?
    // Board is 8x8.
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(piece, r, c, board)) {
           validMoves.push({ piece, toRow: r, toCol: c });
        }
      }
    }
  });
  
  if (validMoves.length === 0) return null;
  
  // Pick random move
  const move = validMoves[Math.floor(Math.random() * validMoves.length)];
  
  // Execute move (copy-paste logic from FreestyleChessGame essentially, or manual state update)
  // We need to return the NEW state.
  
  const newState = JSON.parse(JSON.stringify(gameState));
  const movingPieceIndex = newState.board.findIndex((p: PieceWithPos) => p.id === move.piece.id);
  const movingPiece = newState.board[movingPieceIndex];
  
  // Check for capture/combat
  const targetIndex = newState.board.findIndex((p: PieceWithPos) => p.row === move.toRow && p.col === move.toCol && !p.isDead);
  const targetPiece = targetIndex !== -1 ? newState.board[targetIndex] : null;
  
  let moveDesc = `AI moved piece to ${move.toRow},${move.toCol}`;

  if (targetPiece) {
    // Combat!
    const result = resolveCombat(movingPiece, targetPiece);
    
    // Reveal roles
    movingPiece.revealed = true;
    targetPiece.revealed = true;
    
    if (result.winner === movingPiece) {
      // Attacker wins
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
      // Defender wins
      movingPiece.isDead = true;
      moveDesc += " and died in combat";
    } else {
      // Draw - both die
      movingPiece.isDead = true;
      targetPiece.isDead = true;
      moveDesc += " and both died";
    }
    
    newState.log.push(`Combat: ${movingPiece.role} vs ${targetPiece.role} -> ${result.draw ? 'Draw' : (result.winner === movingPiece ? 'Attacker wins' : 'Defender wins')}`);
    
  } else {
    // Simple move
    movingPiece.row = move.toRow;
    movingPiece.col = move.toCol;
  }
  
  return { newState, moveDescription: moveDesc };
};
