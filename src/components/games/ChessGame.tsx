import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useApp } from '../../context/AppContext';
import { ChessPieceIcons } from './ChessPieceIcons';

interface Props {
  gameState: any; // { fen: string }
  isMyTurn: boolean;
  isPlayer1: boolean;
  onMove: (newState: any, nextTurnId: string, winnerId?: string) => void;
  player1Id: string;
  player2Id: string;
}

const getThemeColors = (themeId: string) => {
  switch (themeId) {
    case 'dark': return { white: '#818cf8', black: '#1f2937' }; // Indigo-400 / Gray-800
    case 'forest': return { white: '#d1fae5', black: '#064e3b' }; // Emerald-100 / Emerald-900
    case 'wood': return { white: '#fde68a', black: '#451a03' }; // Amber-200 / Amber-950
    case 'sunset': return { white: '#fed7aa', black: '#581c87' }; // Orange-200 / Purple-900
    case 'silver': return { white: '#f3f4f6', black: '#1f2937' }; // Gray-100 / Gray-800
    case 'metal': return { white: '#d4d4d8', black: '#18181b' }; // Zinc-300 / Zinc-900
    default: return { white: undefined, black: undefined }; // Default
  }
};

export const ChessGame: React.FC<Props> = ({ gameState, isMyTurn, isPlayer1, onMove, player1Id, player2Id }) => {
  const [game, setGame] = useState(new Chess());
  const { activeThemeId } = useApp();
  const ChessboardAny = Chessboard as any;

  const customPieces = useMemo(() => {
    const pieces = ['p', 'n', 'b', 'r', 'q', 'k'];
    const themeColors = getThemeColors(activeThemeId);
    const pieceComponents: any = {};

    pieces.forEach((p) => {
      // White Pieces
      pieceComponents[`w${p.toUpperCase()}`] = ({ squareWidth }: any) => {
        const Icon = ChessPieceIcons.white[p];
        return (
          <div style={{ 
            width: squareWidth, 
            height: squareWidth, 
            color: themeColors.white,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Icon width="80%" height="80%" />
          </div>
        );
      };
      // Black Pieces
      pieceComponents[`b${p.toUpperCase()}`] = ({ squareWidth }: any) => {
        const Icon = ChessPieceIcons.black[p];
        return (
          <div style={{ 
            width: squareWidth, 
            height: squareWidth, 
            color: themeColors.black,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Icon width="80%" height="80%" />
          </div>
        );
      };
    });
    return pieceComponents;
  }, [activeThemeId]);

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
        customPieces={customPieces}
      />
    </div>
  );
};
