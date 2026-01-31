import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { TicTacToeGame } from '../components/games/TicTacToeGame';
import { RPSGame } from '../components/games/RPSGame';
import { ChessGame } from '../components/games/ChessGame';
import { FreestyleChessGame } from '../components/games/FreestyleChessGame';
import { Chess } from 'chess.js';
import { getTicTacToeMove, getRPSMove, getChessMove, performFreestyleSetup, getFreestyleMove } from '../lib/gameAI';

export const LocalGamePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') as 'chess' | 'tictactoe' | 'rps' | 'freestyle_chess';
  
  // Game States
  const [tictactoeState, setTictactoeState] = useState<{ board: (string | null)[] }>({ board: Array(9).fill(null) });
  const [chessState, setChessState] = useState({ fen: new Chess().fen() });
  const [rpsState, setRpsState] = useState<{ moves: Record<string, string>, round: number }>({ moves: {}, round: 1 });
  const [freestyleState, setFreestyleState] = useState<any>({});
  
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [gameStatus, setGameStatus] = useState<'playing' | 'finished'>('playing');
  
  // Chess specific: Player Color
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');

  // Initialization
  useEffect(() => {
    if (type === 'chess') {
      const isWhite = Math.random() > 0.5;
      setPlayerColor(isWhite ? 'white' : 'black');
      setIsMyTurn(isWhite); // White starts
    } else {
      setIsMyTurn(true); // Default for other games
    }
  }, [type]);

  // AI Turn Handling
  useEffect(() => {
    // Check if it's CPU's turn or CPU needs to act
    let shouldAct = !isMyTurn && gameStatus === 'playing';
    
    // Special case for Freestyle: CPU needs to setup even if game not "started" (setup phase)
    if (type === 'freestyle_chess' && freestyleState.setup && !freestyleState.setup.cpu?.ready) {
      shouldAct = true;
    }

    if (shouldAct) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1000); // 1s delay for "thinking"
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, gameStatus, freestyleState, type]);

  const makeAIMove = () => {
    if (type === 'tictactoe') {
      const moveIdx = getTicTacToeMove(tictactoeState.board);
      if (moveIdx !== -1) {
        const newBoard = [...tictactoeState.board];
        newBoard[moveIdx] = 'O'; // AI is O
        setTictactoeState({ board: newBoard });
        setIsMyTurn(true);
      }
    } else if (type === 'rps') {
      const aiMove = getRPSMove();
      const newMoves = { ...rpsState.moves, 'cpu': aiMove };
      setRpsState({ ...rpsState, moves: newMoves });
      setIsMyTurn(true);
    } else if (type === 'chess') {
      const aiMove = getChessMove(chessState.fen);
      if (aiMove) {
        const game = new Chess(chessState.fen);
        game.move(aiMove);
        setChessState({ fen: game.fen() });
        setIsMyTurn(true);
      } else {
        setGameStatus('finished');
      }
    } else if (type === 'freestyle_chess') {
      if (!freestyleState.setup) return;

      // 1. Setup Phase
      if (!freestyleState.setup.cpu.ready) {
        const newState = performFreestyleSetup(freestyleState, 'cpu');
        setFreestyleState(newState);
        return;
      }

      // 2. Gameplay Phase
      // Only move if it is actually CPU's turn
      if (freestyleState.turn === 'cpu') {
        const result = getFreestyleMove(freestyleState, 'cpu');
        if (result) {
          const stateWithTurn = { ...result.newState, turn: 'player' };
          setFreestyleState(stateWithTurn);
          setIsMyTurn(true);
        }
      }
    }
  };

  const handlePlayerMove = (newState: any, nextTurnId?: string) => {
    if (type === 'tictactoe') {
      setTictactoeState(newState);
      setIsMyTurn(false);
    } else if (type === 'rps') {
      const playerMove = newState.moves['player'];
      if (playerMove) {
         setRpsState({ ...rpsState, moves: { ...rpsState.moves, 'player': playerMove } });
         setIsMyTurn(false); 
      } else if (Object.keys(newState.moves).length === 0) {
        setRpsState({ moves: {}, round: rpsState.round + 1 });
        setIsMyTurn(true);
      }
    } else if (type === 'chess') {
      setChessState(newState);
      setIsMyTurn(false);
    } else if (type === 'freestyle_chess') {
      setFreestyleState(newState);
      if (nextTurnId) {
        setIsMyTurn(nextTurnId === 'player');
      } else {
        if (freestyleState.setup?.player?.ready && freestyleState.setup?.cpu?.ready) {
             if (newState.turn) {
                setIsMyTurn(newState.turn === 'player');
             }
        }
      }
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
            {type === 'chess' && `Schach vs CPU (${playerColor === 'white' ? 'Weiß' : 'Schwarz'})`}
            {type === 'rps' && 'RPS vs CPU'}
            {type === 'freestyle_chess' && 'Freestyle Chess vs CPU'}
          </h2>
          <p className="text-xs text-white/80">
            {gameStatus === 'finished' ? 'Spiel beendet' : (
              type === 'freestyle_chess' && freestyleState.setup && (!freestyleState.setup.player?.ready || !freestyleState.setup.cpu?.ready) 
                ? 'Setup Phase...' 
                : (isMyTurn ? 'Du bist dran' : 'Computer überlegt...')
            )}
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
            isPlayer1={playerColor === 'white'} // If white, I am Player 1
            player1Id={playerColor === 'white' ? 'player' : 'cpu'}
            player2Id={playerColor === 'white' ? 'cpu' : 'player'}
            onMove={(newState) => handlePlayerMove(newState)}
          />
        )}

        {type === 'rps' && (
           <RPSGame 
             gameState={rpsState}
             isMyTurn={true} 
             myPlayerId="player"
             onMove={(newState) => handlePlayerMove(newState)}
           />
        )}

        {type === 'freestyle_chess' && (
          <FreestyleChessGame 
            gameState={freestyleState}
            isMyTurn={isMyTurn}
            isPlayer1={true}
            player1Id="player"
            player2Id="cpu"
            myPlayerId="player"
            onMove={(newState, nextTurnId) => handlePlayerMove(newState, nextTurnId)}
          />
        )}
      </div>
    </div>
  );
};
