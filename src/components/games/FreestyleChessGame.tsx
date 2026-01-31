import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Flag, Square, Hand, Scissors, HelpCircle } from 'lucide-react';
import { initGame, isValidMove, resolveCombat } from '../../lib/freestyleChess';
import type { GameState, PieceWithPos, Role } from '../../lib/freestyleChess';
import { ChessPieceIcons } from './ChessPieceIcons';

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
  const [modifiedPieceIds, setModifiedPieceIds] = useState<Set<string>>(new Set()); // Track unique pieces modified
  const [combatAnim, setCombatAnim] = useState<{ attacker: PieceWithPos, defender: PieceWithPos, result: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prevLogLength, setPrevLogLength] = useState(0);

  useEffect(() => {
    if (!gameState || Object.keys(gameState).length === 0) {
      // Init game if empty
      const initial = initGame(player1Id, player2Id);
      onMove(initial, player1Id); // Sync init
    } else {
      setLocalState(gameState);
      // Reset modification tracking on reload? 
      // Ideally we persist this in GameState setupPhase, but for now we keep local session state.
    }
  }, [gameState]);

  // Watch for combat logs to trigger animation
  useEffect(() => {
    if (gameState?.log && gameState.log.length > prevLogLength) {
       // Check for new combat entries
       for (let i = prevLogLength; i < gameState.log.length; i++) {
         const entry = gameState.log[i];
         if (entry.startsWith('Kampf:')) {
            const parts = entry.split(' '); // "Kampf: rock vs paper"
            const attackerRole = parts[1] as Role;
            const defenderRole = parts[3] as Role;
            
            let resultText = "Kampf!";
            if (i + 1 < gameState.log.length) {
               resultText = gameState.log[i + 1];
            }
            
            setCombatAnim({ 
               attacker: { role: attackerRole } as any, 
               defender: { role: defenderRole } as any, 
               result: resultText 
            });
            setCountdown(3);
         }
       }
       setPrevLogLength(gameState.log.length);
    } else if (gameState?.log) {
       if (prevLogLength === 0) setPrevLogLength(gameState.log.length);
    }
  }, [gameState?.log]);

  // Countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
       const timer = setTimeout(() => {
         setCombatAnim(null);
         setCountdown(null);
       }, 3000);
       return () => clearTimeout(timer);
    }
  }, [countdown]);


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
      if (modifiedPieceIds.size >= 3 && !modifiedPieceIds.has(p.id)) {
        alert("Du darfst nur bei 3 Figuren die Rollen ändern!");
        return;
      }
      
      // Cycle roles: Rock -> Paper -> Scissors -> Rock
      const roles: Role[] = ['rock', 'paper', 'scissors'];
      const currentIdx = roles.indexOf(p.role);
      p.role = roles[(currentIdx + 1) % 3];
      
      // Add to modified set
      setModifiedPieceIds(prev => new Set(prev).add(p.id));
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
      } else {
        // If clicking another square and it's invalid, deselect
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
      // COMBAT ANIMATION TRIGGER
      const { winner, draw } = resolveCombat(piece, target);
      let resultText = '';
      if (draw) resultText = 'Unentschieden!';
      else if (winner?.id === piece.id) resultText = 'Angreifer gewinnt!';
      else resultText = 'Verteidiger gewinnt!';

      // Show animation overlay
      setCombatAnim({ attacker: piece, defender: target, result: resultText });

      // Delay actual update to show animation
      setTimeout(() => {
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
          if (piece.hasFlag) winnerId = target.owner; 
        }

        onMove({ ...localState, board: newBoard, log, turn: nextTurn }, nextTurn, winnerId);
        setCombatAnim(null); // Hide animation
      }, 2000); // 2 seconds animation
    } else {
      // Simple move, immediate
      onMove({ ...localState, board: newBoard, log, turn: nextTurn }, nextTurn, winnerId);
    }
  };

  // --- RENDER HELPERS ---
  const renderSquare = (row: number, col: number) => {
    const piece = localState.board.find(p => p.row === row && p.col === col && !p.isDead);
    const isSelected = selectedPiece?.id === piece?.id;
    const isTarget = selectedPiece && isValidMove(selectedPiece, row, col, localState.board);
    const isPossibleMove = isTarget && !piece;
    const isPossibleAttack = isTarget && piece;

    return (
      <div 
        key={`${row}-${col}`}
        onClick={() => gameStarted ? handleSquareClick(row, col) : (piece && handleSetupClick(piece))}
        className={clsx(
          "relative flex items-center justify-center w-full h-full", // Ensure full filling
          (row + col) % 2 === 0 ? "bg-[#EBECD0]" : "bg-[#779556]", // Classic chess colors
          isSelected && "after:content-[''] after:absolute after:inset-0 after:bg-yellow-400/50", // Highlight selection
          isPossibleMove && "after:content-[''] after:absolute after:w-1/3 after:h-1/3 after:bg-black/20 after:rounded-full", // Dot for move
          isPossibleAttack && "after:content-[''] after:absolute after:inset-0 after:border-4 after:border-red-500/50" // Ring for attack
        )}
      >
        {piece && (
          <PieceComponent 
            piece={piece} 
            isMine={piece.owner === myPlayerId} 
            gameStarted={gameStarted}
            pieceColor={piece.owner === player1Id ? 'white' : 'black'} 
          />
        )}
      </div>
    );
  };

  // Flip board if P2 (Standard: White at bottom)
  const rows = isPlayer1 ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = [0,1,2,3,4,5,6,7]; 
  
  return (
    <div className="flex flex-col gap-4 w-full max-w-[800px] mx-auto relative">
      {combatAnim && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-lg">
          <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-300 w-full">
            
            {/* Countdown or Result */}
            {countdown !== null && countdown > 0 ? (
               <div className="text-9xl font-black text-white animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                 {countdown}
               </div>
            ) : (
               <>
                 <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-600 animate-pulse text-center px-4">
                    {combatAnim.result}
                 </h2>
               </>
            )}
            
            <div className="flex items-center gap-12">
              <div className="flex flex-col items-center gap-2 animate-shake-left">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center border-4 border-blue-500 shadow-lg">
                   <span className="text-4xl capitalize">{combatAnim.attacker.role === 'rock' ? '🪨' : combatAnim.attacker.role === 'paper' ? '📄' : '✂️'}</span>
                </div>
                <span className="font-bold text-blue-400">Angreifer</span>
              </div>

              <div className="text-4xl font-black text-gray-400">VS</div>

              <div className="flex flex-col items-center gap-2 animate-shake-right">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center border-4 border-red-500 shadow-lg">
                   <span className="text-4xl capitalize">{combatAnim.defender.role === 'rock' ? '🪨' : combatAnim.defender.role === 'paper' ? '📄' : '✂️'}</span>
                </div>
                <span className="font-bold text-red-400">Verteidiger</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!gameStarted && (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-yellow-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">Setup Phase</h3>
            <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
              Figuren angepasst: {modifiedPieceIds.size} / 3
            </span>
          </div>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setSetupMode('role')} 
              className={clsx("px-4 py-2 rounded-lg flex items-center gap-2 transition-colors", setupMode === 'role' ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 hover:bg-gray-200")}
            >
              <HelpCircle size={16} /> Rollen ändern
            </button>
            <button 
              onClick={() => setSetupMode('flag')} 
              className={clsx("px-4 py-2 rounded-lg flex items-center gap-2 transition-colors", setupMode === 'flag' ? "bg-red-600 text-white shadow-md" : "bg-gray-100 hover:bg-gray-200")}
            >
              <Flag size={16} /> Flagge setzen
            </button>
          </div>
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Klicke auf deine Figuren, um sie anzupassen.
            </div>
            {!myReady ? (
              <button onClick={handleReady} className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-green-600 transition-transform active:scale-95">
                Bereit!
              </button>
            ) : (
              <span className="text-green-600 font-bold animate-pulse">Warte auf Gegner...</span>
            )}
          </div>
        </div>
      )}

      {/* Board Container - Fixed Aspect Ratio */}
      <div className="w-full aspect-square border-[8px] border-[#403A36] rounded shadow-2xl bg-[#312E2B]">
        <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
          {rows.map(r => (
            cols.map(c => renderSquare(r, c))
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="bg-black/80 text-white p-3 rounded-lg text-xs h-32 overflow-y-auto font-mono shadow-inner border border-gray-700">
        {localState.log.map((entry, i) => <div key={i} className="mb-1 opacity-90">{entry}</div>)}
      </div>
    </div>
  );
};

const PieceComponent: React.FC<{ piece: PieceWithPos, isMine: boolean, gameStarted: boolean, pieceColor: string }> = ({ piece, isMine, pieceColor }) => {
  const showRole = isMine || piece.revealed;
  const showFlag = isMine && piece.hasFlag;

  // Map piece type/color to SVG
  const typeMap: Record<string, string> = { 'p': 'p', 'r': 'r', 'n': 'n', 'b': 'b', 'q': 'q', 'k': 'k' };
  const Icon = ChessPieceIcons[pieceColor][typeMap[piece.type] || 'p'];

  const getRoleIcon = () => {
    if (!showRole) return <div className="bg-black/50 text-white rounded-full p-1"><HelpCircle size={12} /></div>;
    switch (piece.role) {
      case 'rock': return <div className="bg-blue-500 text-white rounded-full p-[2px] shadow-sm"><Square size={12} fill="currentColor" /></div>;
      case 'paper': return <div className="bg-green-500 text-white rounded-full p-[2px] shadow-sm"><Hand size={12} fill="currentColor" /></div>;
      case 'scissors': return <div className="bg-red-500 text-white rounded-full p-[2px] shadow-sm"><Scissors size={12} /></div>;
    }
  };


  return (
    <div className={clsx(
      "w-full h-full relative flex items-center justify-center select-none",
      piece.hasFlag && "z-20" // Flag carrier on top
    )}>
      {/* Flag Indicator - Large Red Border/Glow */}
      {showFlag && (
        <div className="absolute inset-0 border-4 border-red-600 rounded-full animate-pulse opacity-70 pointer-events-none" />
      )}

      {/* Chess Piece SVG */}
      <div className={clsx("w-[90%] h-[90%] transition-transform hover:scale-105", piece.isDead && "opacity-20")}>
        <Icon width="100%" height="100%" />
      </div>

      {/* Role Badge */}
      <div className="absolute -top-1 -right-1 z-30 transform scale-110">
        {getRoleIcon()}
      </div>

      {/* Flag Icon */}
      {showFlag && (
        <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-lg z-30 border border-white">
          <Flag size={14} fill="currentColor" />
        </div>
      )}
    </div>
  );
};
