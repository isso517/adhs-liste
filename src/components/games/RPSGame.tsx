import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Hand, Scissors, Square } from 'lucide-react';

interface Props {
  gameState: any; // { p1_move?: string, p2_move?: string, round_winner?: string }
  isMyTurn: boolean;
  myPlayerId: string;
  onMove: (newState: any, winnerId?: string) => void;
}

export const RPSGame: React.FC<Props> = ({ gameState, myPlayerId, onMove }) => {
  const [selectedMove, setSelectedMove] = useState<string | null>(null);

  // Determine which player I am relative to state
  // This requires parent to pass player1Id/player2Id or we infer from somewhere.
  // Actually, we can just store moves by playerId in the state map?
  // gameState = { [playerId]: 'rock', [otherPlayerId]: 'paper' }
  
  // Let's assume gameState structure:
  // { moves: { [userId]: 'rock' }, round: 1 }

  const moves = gameState?.moves || {};
  const myMove = moves[myPlayerId];
  const opponentId = Object.keys(moves).find(id => id !== myPlayerId);
  const opponentMove = opponentId ? moves[opponentId] : null;

  const handleSelect = (move: 'rock' | 'paper' | 'scissors') => {
    if (myMove) return; // Already moved

    const newMoves = { ...moves, [myPlayerId]: move };
    
    // Check if both moved
    // const playerIds = Object.keys(newMoves);
    // let winnerId = undefined;
    
    // If we have 2 moves (assuming 2 players), calculate winner
    // We don't know the opponent ID easily unless we check keys length > 1
    // But we are in a 2 player game context.
    
    // Simple logic: just save move. 
    // If this is the second move, we calculate result.
    // However, if we don't know opponent ID yet (if they haven't moved), we can't fully calc.
    // So we just save our move.
    
    // BUT: To avoid cheating (peeking), usually we'd hash moves. 
    // For this simple app, we'll just show "Waiting..."
    
    onMove({ moves: newMoves }, undefined);
    setSelectedMove(move);
  };

  const getWinner = () => {
    if (!myMove || !opponentMove) return null;
    if (myMove === opponentMove) return 'draw';
    if (
      (myMove === 'rock' && opponentMove === 'scissors') ||
      (myMove === 'paper' && opponentMove === 'rock') ||
      (myMove === 'scissors' && opponentMove === 'paper')
    ) return 'win';
    return 'lose';
  };

  const result = getWinner();

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex justify-center gap-8">
        {/* Opponent */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-2">
             {opponentMove ? (result ? getIcon(opponentMove) : <span className="text-4xl">?</span>) : <span className="text-gray-400">...</span>}
          </div>
          <span className="font-bold text-gray-600">Gegner</span>
        </div>

        {/* Me */}
        <div className="flex flex-col items-center">
          <div className={clsx("w-24 h-24 rounded-full flex items-center justify-center mb-2 border-4", result === 'win' ? "border-green-500 bg-green-100" : "border-blue-500 bg-blue-100")}>
             {myMove ? getIcon(myMove) : <span className="text-gray-400">?</span>}
          </div>
          <span className="font-bold text-gray-800">Du</span>
        </div>
      </div>

      <div className="flex gap-4">
        <GameButton icon={<Square size={32} />} label="Stein" onClick={() => handleSelect('rock')} disabled={!!myMove} />
        <GameButton icon={<Hand size={32} />} label="Papier" onClick={() => handleSelect('paper')} disabled={!!myMove} />
        <GameButton icon={<Scissors size={32} />} label="Schere" onClick={() => handleSelect('scissors')} disabled={!!myMove} />
      </div>

      {result && (
        <div className="mt-4 text-2xl font-bold">
          {result === 'draw' && <span className="text-gray-500">Unentschieden!</span>}
          {result === 'win' && <span className="text-green-500">Gewonnen!</span>}
          {result === 'lose' && <span className="text-red-500">Verloren!</span>}
        </div>
      )}
      
      {result && (
        <button 
          onClick={() => onMove({ moves: {} }, undefined)} // Reset
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          Nochmal
        </button>
      )}
    </div>
  );
};

const GameButton = ({ icon, label, onClick, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
  >
    <div className="text-gray-700">{icon}</div>
    <span className="text-xs font-bold uppercase">{label}</span>
  </button>
);

const getIcon = (move: string) => {
  switch(move) {
    case 'rock': return <Square size={40} />;
    case 'paper': return <Hand size={40} />;
    case 'scissors': return <Scissors size={40} />;
    default: return null;
  }
};
