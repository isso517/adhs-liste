import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Check, Calendar as CalendarIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { playSound } from '../utils/sound';

interface Props {
  type: 'weekly' | 'monthly';
  title: string;
}



export const PlannedTasksPage: React.FC<Props> = ({ type, title }) => {
  const { tasks, addTask, toggleTask, deleteTask, themes, activeThemeId } = useApp();
  const [newTaskText, setNewTaskText] = useState('');
  
  // For Monthly: selected month index (0-2 for next 3 months)
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  
  // For Weekly: selected weekday index (0-5 for rolling window)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0];
  
  // Rolling Window: Today + 5 days
  const getRollingWeek = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 6; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  // Next 3 Months
  const getNextThreeMonths = () => {
    const months = [];
    const today = new Date();
    
    for (let i = 0; i < 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push({
        date: d,
        label: d.toLocaleDateString('de-DE', { month: 'long' }),
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }
    return months;
  };

  const rollingDates = getRollingWeek();
  const nextMonths = getNextThreeMonths();
  
  const weekDateStrings = rollingDates.map(d => {
    const offset = d.getTimezoneOffset();
    const date = new Date(d.getTime() - (offset*60*1000));
    return date.toISOString().split('T')[0];
  });

  const getDayLabel = (date: Date, index: number) => {
    if (index === 0) return 'Heute';
    if (index === 1) return 'Morgen';
    return date.toLocaleDateString('de-DE', { weekday: 'long' });
  };

  const filteredTasks = tasks.filter(t => {
    if (type === 'monthly') {
      if (t.type !== 'monthly') return false;
      const taskDate = t.dueDate ? new Date(t.dueDate) : new Date();
      const selectedMonth = nextMonths[selectedMonthIndex];
      return taskDate.getMonth() === selectedMonth.month && taskDate.getFullYear() === selectedMonth.year;
    }
    
    if (type === 'weekly') {
      const selectedDateString = weekDateStrings[selectedDayIndex];
      
      // Show weekly tasks for the specific date
      if (t.type === 'weekly' && t.dueDate === selectedDateString) return true;
      
      // Show daily tasks ONLY for "Today" (index 0)
      if (t.type === 'daily' && selectedDayIndex === 0) return true;
      
      return false;
    }
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      let dueDate;
      if (type === 'weekly') {
        dueDate = weekDateStrings[selectedDayIndex];
      } else {
        // For monthly, default to the 1st of the selected month
        // Or today if it's the current month and today > 1st
        const selectedMonth = nextMonths[selectedMonthIndex];
        const today = new Date();
        
        let d = new Date(selectedMonth.year, selectedMonth.month, 1);
        
        // If selected month is current month, use today's date instead of 1st
        if (selectedMonth.month === today.getMonth() && selectedMonth.year === today.getFullYear()) {
          d = today;
        }
        
        // Adjust for timezone to get YYYY-MM-DD
        const offset = d.getTimezoneOffset();
        d = new Date(d.getTime() - (offset*60*1000));
        dueDate = d.toISOString().split('T')[0];
      }
      
      addTask(newTaskText.trim(), type, dueDate);
      setNewTaskText('');
      playSound.click();
    }
  };

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Sort by completion first
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    // Then by due date (relevant for monthly view)
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">{title}</h2>

      {type === 'weekly' && (
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-hide">
          {rollingDates.map((date, index) => {
            const isSelected = selectedDayIndex === index;
            const label = getDayLabel(date, index);
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDayIndex(index)}
                className={clsx(
                  "px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium",
                  isSelected 
                    ? `text-white shadow-md ${activeTheme.colors.primary}` 
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {type === 'monthly' && (
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-hide">
          {nextMonths.map((m, index) => {
            const isSelected = selectedMonthIndex === index;
            return (
              <button
                key={m.label}
                onClick={() => setSelectedMonthIndex(index)}
                className={clsx(
                  "px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium",
                  isSelected 
                    ? `text-white shadow-md ${activeTheme.colors.primary}` 
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder={
              type === 'weekly' 
                ? `Aufgabe für ${getDayLabel(rollingDates[selectedDayIndex], selectedDayIndex)}...` 
                : `Aufgabe für ${nextMonths[selectedMonthIndex].label}...`
            }
            className="flex-1 p-3 rounded-lg border border-white/40 bg-white/70 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder-gray-500"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!newTaskText.trim()}
            className={clsx(
              "p-3 rounded-lg text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg w-full",
              activeTheme.colors.primary
            )}
          >
            <Plus size={24} />
            <span className="ml-2 font-medium">Hinzufügen</span>
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="text-center">
            <div className="text-center py-4 px-6 text-white bg-black/20 backdrop-blur-sm rounded-lg inline-block mx-auto shadow-sm border border-white/20">
              {type === 'weekly' 
                ? `Keine Aufgaben für ${getDayLabel(rollingDates[selectedDayIndex], selectedDayIndex)}.` 
                : `Keine Aufgaben für ${nextMonths[selectedMonthIndex].label}.`}
            </div>
          </div>
        ) : (
          sortedTasks.map(task => (
            <div
              key={task.id}
              className={clsx(
                "flex flex-col gap-2 p-4 rounded-lg border shadow-sm transition-all duration-500 ease-in-out transform",
                task.completed 
                  ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-75 scale-95" 
                  : "bg-white border-gray-200 scale-100"
              )}
            >
              <div className="flex items-center gap-3">
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
                  "flex-1 break-words font-medium",
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
              
              {task.dueDate && type !== 'weekly' && (
                <div className="flex items-center gap-2 text-xs text-gray-500 ml-9">
                  <CalendarIcon size={12} />
                  <span>
                    {`Fällig am: ${new Date(task.dueDate).toLocaleDateString('de-DE')}`}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
