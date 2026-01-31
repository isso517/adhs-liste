import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings, Play, Trophy, User, Cpu } from 'lucide-react';
import { TicTacToeGame } from '../components/games/TicTacToeGame';
import { RPSGame } from '../components/games/RPSGame';
import { ChessGame } from '../components/games/ChessGame';
import { FreestyleChessGame } from '../components/games/FreestyleChessGame';
import { Chess } from 'chess.js';
import { getTicTacToeMove, getRPSMove, getChessMove, performFreestyleSetup, getFreestyleMove } from '../lib/gameAI';
import type { Difficulty } from '../lib/gameAI';

export const LocalGamePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') as 'chess' | 'tictactoe' | 'rps' | 'freestyle_chess';
  
  // -- Setup / Lobby State --
  const [setupComplete, setSetupComplete] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [playerSide, setPlayerSide] = useState<'white' | 'black' | 'random'>('random');

  // -- Game States --
  const [tictactoeState, setTictactoeState] = useState<{ board: (string | null)[] }>({ board: Array(9).fill(null) });
  const [chessState, setChessState] = useState({ fen: new Chess().fen() });
  const [rpsState, setRpsState] = useState<{ moves: Record<string, string>, round: number }>({ moves: {}, round: 1 });
  const [freestyleState, setFreestyleState] = useState<any>({});
  
  const [gameStatus, setGameStatus] = useState<'playing' | 'finished'>('playing');
  
  // Actual active player color (resolved from random)
  const [activePlayerColor, setActivePlayerColor] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState(true);

  // -- Initialization Logic --
  const startGame = () => {
    // Reset States
    setTictactoeState({ board: Array(9).fill(null) });
    setChessState({ fen: new Chess().fen() });
    setRpsState({ moves: {}, round: 1 });
    setFreestyleState({});
    setGameStatus('playing');

    if (type === 'chess') {
        const color = playerSide === 'random' ? (Math.random() > 0.5 ? 'white' : 'black') : playerSide;
        setActivePlayerColor(color);
        setIsMyTurn(color === 'white');
    } else {
        setIsMyTurn(true);
    }
    setSetupComplete(true);
  };

  const makeAIMove = () => {
    if (type === 'tictactoe') {
      const moveIdx = getTicTacToeMove(tictactoeState.board, difficulty);
      if (moveIdx !== -1) {
        const newBoard = [...tictactoeState.board];
        newBoard[moveIdx] = 'O'; 
        setTictactoeState({ board: newBoard });
        setIsMyTurn(true);
      }
    } else if (type === 'rps') {
        // Collect history for AI
        // We only have current state. ideally we store history in state.
        // For now pass empty history or simple logic.
        // Let's improve RPS state later to include history array.
      const aiMove = getRPSMove([], difficulty); 
      const newMoves = { ...rpsState.moves, 'cpu': aiMove };
      setRpsState({ ...rpsState, moves: newMoves });
      setIsMyTurn(true);
    } else if (type === 'chess') {
      const aiMove = getChessMove(chessState.fen, difficulty);
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
      if (!freestyleState.setup.cpu.ready) {
        const newState = performFreestyleSetup(freestyleState, 'cpu');
        setFreestyleState(newState);
        return;
      }
      if (freestyleState.turn === 'cpu') {
        const result = getFreestyleMove(freestyleState, 'cpu', difficulty);
        if (result) {
          const stateWithTurn = { ...result.newState, turn: 'player' };
          setFreestyleState(stateWithTurn);
          setIsMyTurn(true);
        }
      }
    }
  };

  // -- AI Logic --
  useEffect(() => {
    if (!setupComplete) return;

    let shouldAct = !isMyTurn && gameStatus === 'playing';
    
    // Freestyle setup check
    if (type === 'freestyle_chess' && freestyleState.setup && !freestyleState.setup.cpu?.ready) {
      shouldAct = true;
    }

    if (shouldAct) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, gameStatus, freestyleState, type, setupComplete]);

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

  // -- Renders --

  if (!setupComplete) {
      return (
          <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-300">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100">
                  <div className="flex justify-center mb-6">
                      <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                          {type === 'chess' && <Trophy size={48} />}
                          {type === 'freestyle_chess' && <CrownIcon size={48} />}
                          {type === 'tictactoe' && <GridIcon size={48} />}
                          {type === 'rps' && <HandIcon size={48} />}
                      </div>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
                      {type === 'chess' && 'Schach Konfigurator'}
                      {type === 'freestyle_chess' && 'Freestyle Setup'}
                      {type === 'tictactoe' && 'Tic-Tac-Toe Setup'}
                      {type === 'rps' && 'RPS Arena'}
                  </h2>
                  <p className="text-center text-gray-500 mb-8">Wähle deine Einstellungen</p>

                  <div className="space-y-6">
                      {/* Difficulty */}
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <Cpu size={16} /> Schwierigkeitsgrad
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                              {(['easy', 'medium', 'hard'] as const).map((d) => (
                                  <button
                                      key={d}
                                      onClick={() => setDifficulty(d)}
                                      className={`py-2 px-3 rounded-lg text-sm font-bold capitalize transition-all ${
                                          difficulty === d 
                                          ? (d === 'hard' ? 'bg-red-500 text-white' : d === 'medium' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white')
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                  >
                                      {d === 'easy' ? 'Einfach' : d === 'medium' ? 'Mittel' : 'Schwer'}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Side Selection (Chess Only) */}
                      {type === 'chess' && (
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                  <User size={16} /> Deine Farbe
                              </label>
                              <div className="grid grid-cols-3 gap-2">
                                  <button onClick={() => setPlayerSide('white')} className={`py-2 rounded-lg text-sm font-bold ${playerSide === 'white' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>Weiß</button>
                                  <button onClick={() => setPlayerSide('random')} className={`py-2 rounded-lg text-sm font-bold ${playerSide === 'random' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Zufall</button>
                                  <button onClick={() => setPlayerSide('black')} className={`py-2 rounded-lg text-sm font-bold ${playerSide === 'black' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Schwarz</button>
                              </div>
                          </div>
                      )}

                      <button 
                          onClick={startGame}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                      >
                          <Play size={24} fill="currentColor" /> Spiel Starten
                      </button>
                  </div>
              </div>
              <button onClick={() => navigate('/games')} className="mt-8 text-white/80 hover:text-white flex items-center gap-2">
                  <ArrowLeft size={16} /> Zurück zur Übersicht
              </button>
          </div>
      );
  }

  // Active Game View
  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setSetupComplete(false)}
          className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
          title="Setup ändern"
        >
          <Settings size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white drop-shadow-md uppercase tracking-wider flex items-center gap-2 justify-center">
             {type === 'chess' && `Schach (${difficulty})`}
             {type !== 'chess' && `${type} (${difficulty})`}
          </h2>
          <p className="text-xs text-white/80">
            {gameStatus === 'finished' ? 'Spiel beendet' : (isMyTurn ? 'Du bist dran' : 'Computer überlegt...')}
          </p>
        </div>
        <button 
           onClick={() => startGame()}
           className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full text-white transition-colors"
           title="Neustart"
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
            isPlayer1={activePlayerColor === 'white'} 
            player1Id={activePlayerColor === 'white' ? 'player' : 'cpu'}
            player2Id={activePlayerColor === 'white' ? 'cpu' : 'player'}
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
            isPlayer1={activePlayerColor === 'white'}
            player1Id={activePlayerColor === 'white' ? 'player' : 'cpu'}
            player2Id={activePlayerColor === 'white' ? 'cpu' : 'player'}
            myPlayerId="player"
            onMove={(newState, nextTurnId) => handlePlayerMove(newState, nextTurnId)}
          />
        )}

      </div>
    </div>
  );
};

// Icons placeholders
const CrownIcon = ({ size }: { size: number }) => <Trophy size={size} />; 
const GridIcon = ({ size }: { size: number }) => <div style={{width: size, height: size, border: '2px solid currentColor'}} />;
const HandIcon = ({ size }: { size: number }) => <div style={{width: size, height: size, borderRadius: '50%', border: '2px solid currentColor'}} />;
