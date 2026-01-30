import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

interface Props {
  gameState: any; // { fen: string }
  isMyTurn: boolean;
  isPlayer1: boolean;
  onMove: (newState: any, nextTurnId: string, winnerId?: string) => void;
  player1Id: string;
  player2Id: string;
}

export const ChessGame: React.FC<Props> = ({ gameState, isMyTurn, isPlayer1, onMove, player1Id, player2Id }) => {
  const [game, setGame] = useState(new Chess());

  useEffect(() => {
    if (gameState?.fen) {
      const newGame = new Chess(gameState.fen);
      setGame(newGame);
    }
  }, [gameState]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move === null) return false;

      // Move was valid, update state
      const newFen = game.fen();
      const nextTurnId = isPlayer1 ? player2Id : player1Id;
      
      let winnerId = undefined;
      if (game.isCheckmate()) {
        winnerId = isPlayer1 ? player1Id : player2Id; // I just moved, so I won
      }
      
      onMove({ fen: newFen }, nextTurnId, winnerId);
      return true;
    } catch (e) {
      return false;
    }
  }

  return (
    <div className="w-full max-w-[400px] aspect-square mx-auto">
      <Chessboard 
        position={game.fen()} 
        onPieceDrop={onDrop}
        boardOrientation={isPlayer1 ? 'white' : 'black'}
        arePiecesDraggable={isMyTurn}
      />
    </div>
  );
};
