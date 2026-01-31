import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { TicTacToeGame } from '../components/games/TicTacToeGame';
import { RPSGame } from '../components/games/RPSGame';
import { ChessGame } from '../components/games/ChessGame';
import { Chess } from 'chess.js';

// Simple AI implementation for TicTacToe
const getTicTacToeMove = (board: (string | null)[]) => {
  const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
  if (emptyIndices.length === 0) return -1;
  // Random move for now
  return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
};

// Simple AI for RPS
const getRPSMove = () => {
  const moves = ['rock', 'paper', 'scissors'];
  return moves[Math.floor(Math.random() * moves.length)];
};

export const LocalGamePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') as 'chess' | 'tictactoe' | 'rps' | 'freestyle_chess';
  
  // Game States
  const [tictactoeState, setTictactoeState] = useState(Array(9).fill(null));
  const [chessState, setChessState] = useState({ fen: new Chess().fen() });
  const [rpsState, setRpsState] = useState<{ moves: Record<string, string>, round: number }>({ moves: {}, round: 1 });
  
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [gameStatus, setGameStatus] = useState<'playing' | 'finished'>('playing');

  // AI Turn Handling
  useEffect(() => {
    if (!isMyTurn && gameStatus === 'playing') {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1000); // 1s delay for "thinking"
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, gameStatus]);

  const makeAIMove = () => {
    if (type === 'tictactoe') {
      const moveIdx = getTicTacToeMove(tictactoeState);
      if (moveIdx !== -1) {
        const newBoard = [...tictactoeState];
        newBoard[moveIdx] = 'O'; // AI is O
        setTictactoeState(newBoard);
        setIsMyTurn(true);
      }
    } else if (type === 'rps') {
      const aiMove = getRPSMove();
      // RPS is simultaneous, but in local turn-based flow:
      // Player moves first (stored), then AI moves immediately.
      // Actually RPSGame component handles simultaneous feel. 
      // But here we need to feed AI move.
      // Let's assume we triggered AI move after player move.
      const newMoves = { ...rpsState.moves, 'cpu': aiMove };
      setRpsState({ ...rpsState, moves: newMoves });
      setIsMyTurn(true);
    } else if (type === 'chess') {
      const game = new Chess(chessState.fen);
      const moves = game.moves();
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        game.move(randomMove);
        setChessState({ fen: game.fen() });
        setIsMyTurn(true);
      } else {
        setGameStatus('finished');
      }
    }
  };

  const handlePlayerMove = (newState: any) => {
    if (type === 'tictactoe') {
      setTictactoeState(newState);
      setIsMyTurn(false);
    } else if (type === 'rps') {
      // Player moved. RPSGame usually sends { moves: { [id]: move } }
      // We merge it.
      const playerMove = newState.moves['player'];
      if (playerMove) {
         setRpsState({ ...rpsState, moves: { ...rpsState.moves, 'player': playerMove } });
         setIsMyTurn(false); // Trigger AI
      } else if (Object.keys(newState.moves).length === 0) {
        // Reset
        setRpsState({ moves: {}, round: rpsState.round + 1 });
        setIsMyTurn(true);
      }
    } else if (type === 'chess') {
      setChessState(newState);
      setIsMyTurn(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/games')}
          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white drop-shadow-md uppercase tracking-wider">
            {type === 'tictactoe' && 'Tic-Tac-Toe vs CPU'}
            {type === 'chess' && 'Schach vs CPU'}
            {type === 'rps' && 'RPS vs CPU'}
            {type === 'freestyle_chess' && 'Freestyle Chess (Coming Soon)'}
          </h2>
          <p className="text-xs text-white/80">
            {isMyTurn ? 'Du bist dran' : 'Computer überlegt...'}
          </p>
        </div>
        <button 
           onClick={() => window.location.reload()}
           className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="flex-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden flex items-center justify-center p-4">
        {type === 'tictactoe' && (
          <TicTacToeGame 
            gameState={tictactoeState}
            isMyTurn={isMyTurn}
            myPlayerId="player"
            onMove={(newState) => handlePlayerMove(newState)}
          />
        )}

        {type === 'chess' && (
          <ChessGame 
            gameState={chessState}
            isMyTurn={isMyTurn}
            isPlayer1={true} // Player is always White in PVC for now
            player1Id="player"
            player2Id="cpu"
            onMove={(newState) => handlePlayerMove(newState)}
          />
        )}

        {type === 'rps' && (
           <RPSGame 
             gameState={rpsState}
             isMyTurn={true} // Always allow interaction, state handles flow
             myPlayerId="player"
             onMove={(newState) => handlePlayerMove(newState)}
           />
        )}

        {type === 'freestyle_chess' && (
          <div className="text-center p-10">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Coming Soon!</h3>
            <p className="text-gray-600">Der CPU-Modus für Freestyle Chess ist noch in Arbeit.</p>
          </div>
        )}
      </div>
    </div>
  );
};
