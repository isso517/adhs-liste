import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Check, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { playSound } from '../utils/sound';

export const LandingPage: React.FC = () => {
  const { tasks, addTask, toggleTask, deleteTask, resetDailyTasks, themes, activeThemeId } = useApp();
  const [newTaskText, setNewTaskText] = useState('');
  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];

  const dailyTasks = tasks.filter(t => !t.type || t.type === 'daily');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      addTask(newTaskText.trim(), 'daily');
      setNewTaskText('');
      playSound.click();
    }
  };

  const sortedTasks = [...dailyTasks].sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

  const completedCount = dailyTasks.filter(t => t.completed).length;
  const progress = dailyTasks.length > 0 ? (completedCount / dailyTasks.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex-1 flex justify-center">
          <h2 className="text-2xl font-bold text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">Deine Aufgaben</h2>
        </div>
        <button 
          onClick={resetDailyTasks}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors absolute right-4"
          title="Tages-Reset"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-4 w-full overflow-hidden shadow-inner">
        <div 
          className={clsx("h-full transition-all duration-500 ease-out", activeTheme.colors.primary)}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Neue Aufgabe hinzufügen..."
          className="flex-1 p-3 rounded-lg border border-white/40 bg-white/70 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={!newTaskText.trim()}
          className={clsx(
            "p-3 rounded-lg text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg",
            activeTheme.colors.primary
          )}
        >
          <Plus size={24} />
        </button>
      </form>

      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="text-center">
            <div className="text-center py-4 px-6 text-white bg-black/20 backdrop-blur-sm rounded-lg inline-block mx-auto shadow-sm border border-white/20">
              Keine Aufgaben. Füge eine hinzu!
            </div>
          </div>
        ) : (
          sortedTasks.map(task => (
            <div
              key={task.id}
              className={clsx(
                "flex items-center gap-3 p-4 rounded-lg border shadow-sm transition-all duration-500 ease-in-out transform",
                task.completed 
                  ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-75 scale-95" 
                  : "bg-white border-gray-200 scale-100"
              )}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className={clsx(
                  "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  task.completed
                    ? `border-transparent text-white scale-110 ${activeTheme.colors.primary}`
                    : "border-gray-400 hover:border-gray-600 hover:scale-105"
                )}
              >
                {task.completed && <Check size={14} strokeWidth={3} />}
              </button>
              
              <span className={clsx(
                "flex-1 break-words",
                task.completed && "line-through text-gray-500"
              )}>
                {task.text}
              </span>

              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
