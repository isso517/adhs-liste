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
  const ChessboardAny = Chessboard as any;

  useEffect(() => {
    if (gameState?.fen) {
      try {
        const newGame = new Chess(gameState.fen);
        setGame(newGame);
      } catch (e) {
        console.error("Invalid FEN:", gameState.fen);
      }
    }
  }, [gameState]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn) {
        console.log("Not my turn!");
        return false;
    }

    try {
      console.log("Attempting move:", sourceSquare, targetSquare, game.fen());
      // Create a copy to manipulate
      const gameCopy = new Chess(game.fen());
      
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to queen for simplicity
      });

      if (move === null) {
          console.log("Invalid move according to chess.js");
          return false;
      }

      // Move was valid, update local state IMMEDIATELY to prevent snapback
      setGame(gameCopy);

      // Notify parent
      const newFen = gameCopy.fen();
      const nextTurnId = isPlayer1 ? player2Id : player1Id;
      
      let winnerId = undefined;
      if (gameCopy.isCheckmate()) {
        winnerId = isPlayer1 ? player1Id : player2Id; // I just moved, so I won
      }
      
      onMove({ fen: newFen }, nextTurnId, winnerId);
      return true;
    } catch (e) {
      console.error("Move error:", e);
      return false;
    }
  }

  return (
    <div className="w-full max-w-[400px] aspect-square mx-auto">
      <ChessboardAny 
        position={game.fen()} 
        onPieceDrop={onDrop}
        boardOrientation={(isPlayer1 ? 'white' : 'black') as 'white' | 'black'}
        arePiecesDraggable={isMyTurn}
        animationDuration={200}
      />
    </div>
  );
};
