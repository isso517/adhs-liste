import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useApp } from '../../context/AppContext';
import { ChessPieceIcons } from './ChessPieceIcons';

interface Props {
  gameState: any; // { fen: string }
  isMyTurn: boolean;
  isPlayer1: boolean; // Determines orientation: true = white at bottom, false = black at bottom
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
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});
  const { activeThemeId } = useApp();
  
  // Update game instance when FEN changes from props
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

  function getMoveOptions(square: string) {
    const moves = (game as any).moves({
      square,
      verbose: true,
    });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: Record<string, any> = {};
    moves.map((move: any) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(255,0,0,.5) 25%, transparent 25%)'
            : 'radial-gradient(circle, rgba(0,0,0,.5) 25%, transparent 25%)',
        borderRadius: '50%',
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onPieceDragBegin(piece: string, sourceSquare: string) {
    if (!isMyTurn) return;
    // Only allow moving own pieces
    const pieceColor = piece[0]; // 'w' or 'b'
    const myColor = isPlayer1 ? 'w' : 'b'; // Assuming isPlayer1=true means White
    
    // Check if orientation matches piece color
    // If isPlayer1 is true, we are White. If piece starts with 'w', it's ours.
    // If isPlayer1 is false, we are Black. If piece starts with 'b', it's ours.
    if ((isPlayer1 && pieceColor !== 'w') || (!isPlayer1 && pieceColor !== 'b')) {
        return;
    }

    getMoveOptions(sourceSquare);
  }

  function onPieceDragEnd() {
    setOptionSquares({});
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn) return false;

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', 
      });

      if (move === null) return false;

      setGame(gameCopy);
      
      const newFen = gameCopy.fen();
      const nextTurnId = isPlayer1 ? player2Id : player1Id;
      let winnerId = undefined;
      
      if (gameCopy.isCheckmate()) {
        winnerId = isPlayer1 ? player1Id : player2Id; 
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
        // @ts-ignore
        position={game.fen()} 
        onPieceDrop={onDrop}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        boardOrientation={isPlayer1 ? 'white' : 'black'}
        arePiecesDraggable={isMyTurn}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
        }}
        customSquareStyles={optionSquares}
        customPieces={customPieces}
        animationDuration={200}
      />
    </div>
  );
};
