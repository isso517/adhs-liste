import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings, Play, Cpu } from 'lucide-react';
import { TicTacToeGame } from '../components/games/TicTacToeGame';
import { RPSGame } from '../components/games/RPSGame';
import { getTicTacToeMove, getRPSMove } from '../lib/gameAI';
import type { Difficulty } from '../lib/gameAI';
import { useApp } from '../context/AppContext';
import { clsx } from 'clsx';

export const LocalGamePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') as 'tictactoe' | 'rps';
  const { themes, activeThemeId } = useApp();
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];
  
  // -- Setup / Lobby State --
  const [setupComplete, setSetupComplete] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  // -- Game States --
  const [tictactoeState, setTictactoeState] = useState<{ board: (string | null)[] }>({ board: Array(9).fill(null) });
  const [rpsState, setRpsState] = useState<{ moves: Record<string, string>, round: number }>({ moves: {}, round: 1 });
  
  const [gameStatus, setGameStatus] = useState<'playing' | 'finished'>('playing');
  
  const [isMyTurn, setIsMyTurn] = useState(true);

  // -- Initialization Logic --
  const startGame = () => {
    // Reset States
    setTictactoeState({ board: Array(9).fill(null) });
    setRpsState({ moves: {}, round: 1 });
    setGameStatus('playing');
    setIsMyTurn(true);
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
    }
  };

  // -- AI Logic --
  useEffect(() => {
    if (!setupComplete) return;

    const shouldAct = !isMyTurn && gameStatus === 'playing';
    
    if (shouldAct) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, gameStatus, type, setupComplete]);

  const handlePlayerMove = (newState: any) => {
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
    }
  };

  // -- Renders --

  if (!setupComplete) {
      return (
          <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-300">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 text-gray-900">
                  <div className="flex justify-center mb-6">
                      <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                          {type === 'tictactoe' && <GridIcon size={48} />}
                          {type === 'rps' && <HandIcon size={48} />}
                      </div>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">
                      {type === 'tictactoe' && 'Tic-Tac-Toe Setup'}
                      {type === 'rps' && 'RPS Arena'}
                  </h2>
                  <p className="text-center text-gray-900 mb-8">Wähle deine Einstellungen</p>

                  <div className="space-y-6">
                      {/* Difficulty */}
                      <div>
                          <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
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
                                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                      }`}
                                  >
                                      {d === 'easy' ? 'Einfach' : d === 'medium' ? 'Mittel' : 'Schwer'}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <button 
                          onClick={startGame}
                          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                      >
                          <Play size={24} fill="currentColor" /> Spiel Starten
                      </button>
                  </div>
              </div>
              <button onClick={() => navigate('/games')} className={clsx("mt-8 flex items-center gap-2 opacity-80 hover:opacity-100", activeTheme.colors.text)}>
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
          className={clsx("p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors", activeTheme.colors.text)}
          title="Setup ändern"
        >
          <Settings size={20} />
        </button>
        <div className="text-center">
          <h2 className={clsx("text-xl font-bold drop-shadow-md uppercase tracking-wider flex items-center gap-2 justify-center", activeTheme.colors.text)}>
             {type === 'tictactoe' && `Tic-Tac-Toe (${difficulty})`}
             {type === 'rps' && `Schere Stein Papier (${difficulty})`}
          </h2>
          <p className={clsx("text-xs opacity-80", activeTheme.colors.text)}>
            {gameStatus === 'finished' ? 'Spiel beendet' : (isMyTurn ? 'Du bist dran' : 'Computer überlegt...')}
          </p>
        </div>
        <button 
           onClick={() => startGame()}
           className={clsx("p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors", activeTheme.colors.text)}
           title="Neustart"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="flex-1 bg-white/90 text-gray-900 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden flex items-center justify-center p-4">
        {type === 'tictactoe' && (
          <TicTacToeGame 
            gameState={tictactoeState}
            isMyTurn={isMyTurn}
            myPlayerId="player"
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

      </div>
    </div>
  );
};

// Icons placeholders
const GridIcon = ({ size }: { size: number }) => <div style={{width: size, height: size, border: '2px solid currentColor'}} />;
const HandIcon = ({ size }: { size: number }) => <div style={{width: size, height: size, borderRadius: '50%', border: '2px solid currentColor'}} />;
