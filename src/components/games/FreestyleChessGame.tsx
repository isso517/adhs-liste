import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Crown, Flag, Square, Hand, Scissors, HelpCircle } from 'lucide-react';
import { initGame, isValidMove, resolveCombat } from '../../lib/freestyleChess';
import type { GameState, PieceWithPos, Role } from '../../lib/freestyleChess';

interface Props {
  gameState: any; 
  isMyTurn: boolean;
  isPlayer1: boolean; // I am Player 1 (Bottom)
  onMove: (newState: any, nextTurnId: string, winnerId?: string) => void;
  player1Id: string;
  player2Id: string;
  myPlayerId: string;
}

export const FreestyleChessGame: React.FC<Props> = ({ 
  gameState, isMyTurn, isPlayer1, onMove, player1Id, player2Id, myPlayerId 
}) => {
  const [localState, setLocalState] = useState<GameState | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<PieceWithPos | null>(null);
  const [setupMode, setSetupMode] = useState<'role' | 'flag'>('role'); // For setup phase

  useEffect(() => {
    if (!gameState || Object.keys(gameState).length === 0) {
      // Init game if empty
      const initial = initGame(player1Id, player2Id);
      onMove(initial, player1Id); // Sync init
    } else {
      setLocalState(gameState);
    }
  }, [gameState]);

  if (!localState) return <div>Loading...</div>;

  const myReady = localState.setup[myPlayerId]?.ready;
  const opponentReady = localState.setup[myPlayerId === player1Id ? player2Id : player1Id]?.ready;
  const gameStarted = myReady && opponentReady;

  // --- SETUP PHASE HANDLERS ---
  const handleSetupClick = (piece: PieceWithPos) => {
    if (myReady || piece.owner !== myPlayerId) return;

    const newBoard = [...localState.board];
    const pIndex = newBoard.findIndex(p => p.id === piece.id);
    const p = newBoard[pIndex];

    if (setupMode === 'role') {
      // Cycle roles: Rock -> Paper -> Scissors -> Rock
      const roles: Role[] = ['rock', 'paper', 'scissors'];
      const currentIdx = roles.indexOf(p.role);
      p.role = roles[(currentIdx + 1) % 3];
    } else {
      // Toggle flag (only 1 allowed)
      if (p.hasFlag) {
        p.hasFlag = false;
      } else {
        // Remove flag from others
        newBoard.forEach(op => { if (op.owner === myPlayerId) op.hasFlag = false; });
        p.hasFlag = true;
      }
    }
    
    // Update local state temporarily (actually we should sync setup changes too)
    // But for MVP we sync on "Ready" or just local state?
    // Let's sync every change so persistence works if page reload.
    // Ideally setup state should be private until game starts, but Supabase Realtime broadcasts everything.
    // Security Note: Opponent can see this traffic. Accepted for MVP.
    onMove({ ...localState, board: newBoard }, localState.turn);
  };

  const handleReady = () => {
    // Validate: 1 flag set?
    const myPieces = localState.board.filter(p => p.owner === myPlayerId);
    if (!myPieces.some(p => p.hasFlag)) {
      alert('Du musst eine Flagge zuweisen!');
      return;
    }

    const newSetup = {
      ...localState.setup,
      [myPlayerId]: { ready: true }
    };
    onMove({ ...localState, setup: newSetup }, localState.turn);
  };

  // --- GAME PHASE HANDLERS ---
  const handleSquareClick = (row: number, col: number) => {
    if (!gameStarted) return;

    const clickedPiece = localState.board.find(p => p.row === row && p.col === col && !p.isDead);

    // Select own piece
    if (clickedPiece?.owner === myPlayerId) {
      if (isMyTurn) setSelectedPiece(clickedPiece);
      return;
    }

    // Move to target (empty or enemy)
    if (selectedPiece) {
      if (isValidMove(selectedPiece, row, col, localState.board)) {
        executeMove(selectedPiece, row, col, clickedPiece);
        setSelectedPiece(null);
      }
    }
  };

  const executeMove = (piece: PieceWithPos, toRow: number, toCol: number, target?: PieceWithPos) => {
    let newBoard = [...localState.board];
    let log = [...localState.log];
    let winnerId: string | undefined = undefined;
    // Determine next turn: if current is player1, next is player2
    const nextTurn = localState.turn === player1Id ? player2Id : player1Id;

    // Update piece position
    const pIndex = newBoard.findIndex(p => p.id === piece.id);
    newBoard[pIndex] = { ...piece, row: toRow, col: toCol };

    if (target) {
      // COMBAT
      const { winner, draw } = resolveCombat(piece, target);
      
      // Reveal roles
      newBoard[pIndex].revealed = true;
      const tIndex = newBoard.findIndex(p => p.id === target.id);
      newBoard[tIndex].revealed = true;

      log.push(`Kampf: ${piece.role} vs ${target.role}`);

      if (draw) {
        newBoard[pIndex].isDead = true;
        newBoard[tIndex].isDead = true;
        log.push('Unentschieden! Beide vernichtet.');
      } else if (winner?.id === piece.id) {
        newBoard[tIndex].isDead = true;
        log.push(`Angreifer gewinnt!`);
        if (target.hasFlag) winnerId = myPlayerId;
      } else {
        newBoard[pIndex].isDead = true;
        log.push(`Verteidiger gewinnt!`);
        if (piece.hasFlag) winnerId = target.owner; // Attacker lost flag carrier? No, flag carrier doesn't die if attacking unless it loses.
        // "Wird die Flaggenfigur geschlagen, endet das Spiel sofort" -> Yes.
      }
    }

    // Check Flag captured (Attacker moved to empty square? No flag capture there)
    // Only combat captures flags.

    onMove({ ...localState, board: newBoard, log, turn: nextTurn }, nextTurn, winnerId);
  };

  // --- RENDER HELPERS ---
  const renderSquare = (row: number, col: number) => {
    const piece = localState.board.find(p => p.row === row && p.col === col && !p.isDead);
    const isSelected = selectedPiece?.id === piece?.id;
    const isTarget = selectedPiece && isValidMove(selectedPiece, row, col, localState.board);

    // Orientation: If I am P1 (Bottom), row 7 is bottom. 
    // If I am P2 (Top), row 0 is bottom? No, usually board is flipped.
    // Let's keep it simple: Row 0 top, Row 7 bottom always. P1 starts at bottom. P2 at top.
    // If I am P2, I might want to see my pieces at bottom.
    // Let's flip for P2.
    // But logic uses absolute coords. Visual mapping needed.
    
    return (
      <div 
        key={`${row}-${col}`}
        onClick={() => gameStarted ? handleSquareClick(row, col) : (piece && handleSetupClick(piece))}
        className={clsx(
          "w-full h-full flex items-center justify-center relative",
          (row + col) % 2 === 0 ? "bg-amber-100" : "bg-amber-800",
          isSelected && "ring-4 ring-blue-500 z-10",
          isTarget && !piece && "after:content-[''] after:w-4 after:h-4 after:bg-green-500/50 after:rounded-full",
          isTarget && piece && "ring-4 ring-red-500 z-10"
        )}
      >
        {piece && <PieceComponent piece={piece} isMine={piece.owner === myPlayerId} gameStarted={gameStarted} />}
        {/* Coord labels for debugging */}
        {/* <span className="absolute bottom-0 right-0 text-[8px] opacity-50">{row},{col}</span> */}
      </div>
    );
  };

  // Flip board if P2
  const rows = isPlayer1 ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = isPlayer1 ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0]; // Mirror cols too for correct left/right?
  // Actually chess usually only flips rows. Left is still A.
  // Let's stick to standard view: Row 0 top.
  // If I am P2, I want Row 0 at bottom.
  
  return (
    <div className="flex flex-col gap-4 w-full max-w-[600px] mx-auto">
      {!gameStarted && (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-yellow-200">
          <h3 className="font-bold text-lg mb-2">Setup Phase</h3>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setSetupMode('role')} 
              className={clsx("px-4 py-2 rounded-lg flex items-center gap-2", setupMode === 'role' ? "bg-blue-500 text-white" : "bg-gray-100")}
            >
              <HelpCircle size={16} /> Rollen ändern
            </button>
            <button 
              onClick={() => setSetupMode('flag')} 
              className={clsx("px-4 py-2 rounded-lg flex items-center gap-2", setupMode === 'flag' ? "bg-red-500 text-white" : "bg-gray-100")}
            >
              <Flag size={16} /> Flagge setzen
            </button>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Klicke auf deine Figuren, um sie anzupassen.
            </div>
            {!myReady ? (
              <button onClick={handleReady} className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-green-600">
                Bereit!
              </button>
            ) : (
              <span className="text-green-600 font-bold">Warte auf Gegner...</span>
            )}
          </div>
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-8 gap-0 border-4 border-amber-900 rounded-sm shadow-2xl aspect-square bg-amber-100">
        {rows.map(r => (
          cols.map(c => renderSquare(r, c)) // Note: cols should probably not be reversed for Chess standard view, but for P2 view maybe? Let's assume standard Chessboard.tsx behavior: White at bottom.
          // If I am P2 (Black), I want my pieces (Row 0,1) at bottom. So I need to iterate Rows 0->7? No, Row 0 is Top normally.
          // Standard: Row 0 is Top (Black). Row 7 is Bottom (White).
          // If I am P2 (Black), I want Row 0 at Bottom. So I render 0..7.
          // If I am P1 (White), I want Row 7 at Bottom. So I render 0..7? No, HTML renders top-down.
          // HTML: First div is Top.
          // P1 View: Top is Row 0 (Enemy). Bottom is Row 7 (Me). -> Render 0 to 7.
          // P2 View: Top is Row 7 (Enemy). Bottom is Row 0 (Me). -> Render 7 to 0.
        ))}
      </div>

      {/* Log */}
      <div className="bg-black/80 text-white p-2 rounded-lg text-xs h-24 overflow-y-auto font-mono">
        {localState.log.map((entry, i) => <div key={i}>{entry}</div>)}
      </div>
    </div>
  );
};

const PieceComponent: React.FC<{ piece: PieceWithPos, isMine: boolean, gameStarted: boolean }> = ({ piece, isMine }) => {
  // Logic for displaying icon
  // If Mine: Show Role + Flag (if set)
  // If Enemy: Show '?' unless revealed
  // If Game not started: Show everything for mine
  
  const showRole = isMine || piece.revealed;
  const showFlag = isMine && piece.hasFlag;

  const getIcon = () => {
    if (!showRole) return <HelpCircle size={24} className="text-gray-400" />;
    switch (piece.role) {
      case 'rock': return <Square size={24} fill="currentColor" />;
      case 'paper': return <Hand size={24} fill="currentColor" />;
      case 'scissors': return <Scissors size={24} />;
    }
  };

  return (
    <div className={clsx(
      "w-4/5 h-4/5 rounded-full flex items-center justify-center relative shadow-sm border-2 transition-transform",
      isMine ? "bg-white border-blue-500 text-blue-600" : "bg-gray-800 border-gray-600 text-gray-200",
      piece.type === 'king' && "ring-2 ring-yellow-400"
    )}>
      {getIcon()}
      {piece.type === 'king' && <Crown size={12} className="absolute -top-2 text-yellow-500 fill-yellow-500" />}
      {showFlag && <Flag size={12} className="absolute -bottom-1 right-0 text-red-500 fill-red-500" />}
    </div>
  );
};
