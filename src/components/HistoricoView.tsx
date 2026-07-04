import { useState } from 'react';
import { CheckDiario, Usuario } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X, Award, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoricoViewProps {
  usuario: Usuario;
  checks: CheckDiario[];
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function HistoricoView({ usuario, checks }: HistoricoViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayCheck, setSelectedDayCheck] = useState<CheckDiario | null>(null);
  const [selectedDayStr, setSelectedDayStr] = useState<string>('');

  const isJessica = usuario.nome === 'Jéssica';
  const colorTheme = isJessica ? {
    primary: 'from-rose-500 to-orange-400',
    primarySolid: 'bg-rose-500',
    text: 'text-rose-600',
    bgLight: 'bg-rose-50',
    border: 'border-rose-100',
    hover: 'hover:bg-rose-50',
    glow: 'shadow-rose-100',
    badgeClass: 'bg-rose-500 text-white'
  } : {
    primary: 'from-emerald-500 to-teal-400',
    primarySolid: 'bg-emerald-500',
    text: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-100',
    hover: 'hover:bg-emerald-50',
    glow: 'shadow-emerald-100',
    badgeClass: 'bg-emerald-500 text-white'
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Calendar logic helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDayCheck(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDayCheck(null);
  };

  // Build calendar matrix
  const dayBlocks = [];
  // 1. Padding preceding days
  for (let i = 0; i < firstDayIndex; i++) {
    dayBlocks.push({ isPadding: true, dayNum: 0, dateStr: '' });
  }
  // 2. Main days
  for (let day = 1; day <= daysCount; day++) {
    const formattedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dayBlocks.push({ isPadding: false, dayNum: day, dateStr: formattedDateStr });
  }

  const handleSelectDay = (dateStr: string) => {
    setSelectedDayStr(dateStr);
    const found = checks.find(c => c.data === dateStr);
    if (found) {
      setSelectedDayCheck(found);
    } else {
      // Return empty scaffold if no data exists yet
      setSelectedDayCheck({
        id: 0,
        usuario_id: usuario.id,
        data: dateStr,
        treino: false,
        zero_doce: false,
        zero_besteira: false,
        agua: false,
        sono: false
      });
    }
  };

  // Check habits status of a day block
  const getDayMetadata = (dateStr: string) => {
    const check = checks.find(c => c.data === dateStr);
    if (!check) return { completed: 0, isPerfect: false, hasLogs: false };
    
    const count = [
      check.treino,
      check.zero_doce,
      check.zero_besteira,
      check.agua,
      check.sono
    ].filter(Boolean).length;

    return {
      completed: count,
      isPerfect: count === 5,
      hasLogs: count > 0
    };
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-28">
      
      {/* Header */}
      <div className="w-full bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <h1 className="text-xl font-display font-extrabold text-slate-950">Histórico Mensal</h1>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calendário de Hábitos</p>
      </div>

      <div className="px-5 py-6 space-y-6 w-full max-w-md mx-auto">
        
        {/* Monthly Calendar block */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
          {/* Navigator Header */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <h2 className="text-base font-display font-extrabold text-slate-800">
              {MONTHS_PT[currentMonth]} {currentYear}
            </h2>
            <div className="flex space-x-1.5">
              <button
                id="btn-prev-month"
                onClick={prevMonth}
                className="p-1.5 border border-slate-100 hover:bg-slate-50 active:scale-95 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>
              <button
                id="btn-next-month"
                onClick={nextMonth}
                className="p-1.5 border border-slate-100 hover:bg-slate-50 active:scale-95 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
              {WEEKDAYS_PT.map((day, idx) => (
                <div key={idx} className="py-1">{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {dayBlocks.map((block, idx) => {
                if (block.isPadding) {
                  return <div key={`pad-${idx}`} className="aspect-square" />;
                }

                const metadata = getDayMetadata(block.dateStr);
                const isSelected = selectedDayStr === block.dateStr;

                // Dynamic background styles based on score
                let bgClass = 'bg-slate-50 text-slate-700 hover:bg-slate-100/80';
                let borderClass = 'border-transparent';

                if (metadata.isPerfect) {
                  bgClass = isJessica 
                    ? 'bg-rose-500 text-white shadow-sm shadow-rose-200' 
                    : 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
                } else if (metadata.completed > 0) {
                  bgClass = isJessica 
                    ? 'bg-rose-100/70 text-rose-700' 
                    : 'bg-emerald-100/70 text-emerald-700';
                }

                if (isSelected) {
                  borderClass = isJessica ? 'ring-2 ring-rose-500 ring-offset-2' : 'ring-2 ring-emerald-500 ring-offset-2';
                }

                return (
                  <button
                    key={`day-${block.dayNum}`}
                    id={`calendar-day-${block.dayNum}`}
                    onClick={() => handleSelectDay(block.dateStr)}
                    className={`aspect-square rounded-xl font-display font-extrabold text-sm flex flex-col items-center justify-center cursor-pointer transition-all active:scale-90 relative border ${borderClass} ${bgClass}`}
                  >
                    <span>{block.dayNum}</span>

                    {/* Miniature score indicator dot beneath */}
                    {metadata.completed > 0 && !metadata.isPerfect && (
                      <div className="absolute bottom-1.5 flex justify-center space-x-0.5">
                        {Array.from({ length: metadata.completed }).map((_, dIdx) => (
                          <div
                            key={dIdx}
                            className={`w-1 h-1 rounded-full ${isJessica ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day details popover */}
        <AnimatePresence>
          {selectedDayCheck && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Activity className={`w-5 h-5 ${colorTheme.text}`} />
                  <h3 className="font-display font-extrabold text-slate-800 text-sm">
                    Detalhes do Dia {selectedDayStr.split('-')[2]}/{selectedDayStr.split('-')[1]}
                  </h3>
                </div>
                {getDayMetadata(selectedDayStr).isPerfect && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center space-x-1 ${colorTheme.badgeClass}`}>
                    <Award className="w-3.5 h-3.5 fill-white stroke-[2.5]" />
                    <span>Perfeito!</span>
                  </span>
                )}
              </div>

              {/* Habits grid showing status on chosen day */}
              <div className="grid gap-2.5">
                {[
                  { key: 'treino', label: 'Treino 🏋️', val: selectedDayCheck.treino },
                  { key: 'zero_doce', label: 'Zero Doce 🚫🍬', val: selectedDayCheck.zero_doce },
                  { key: 'zero_besteira', label: 'Zero Besteira 🚫🍟', val: selectedDayCheck.zero_besteira },
                  { key: 'agua', label: 'Água (3L+) 💧', val: selectedDayCheck.agua },
                  { key: 'sono', label: 'Sono Regular 😴', val: selectedDayCheck.sono }
                ].map(habit => (
                  <div
                    key={habit.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/50"
                  >
                    <span className="text-sm font-display font-semibold text-slate-700">{habit.label}</span>
                    <div className="flex items-center">
                      {habit.val ? (
                        <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Concluído</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-xs font-bold text-slate-400">
                          <X className="w-4 h-4 stroke-[2.5]" />
                          <span>Não marcado</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {getDayMetadata(selectedDayStr).completed === 0 && (
                <div className="text-center py-2 text-xs font-medium text-slate-400 italic">
                  "Foi mal, amanhã é revanche 💪" - Nenhum hábito registrado nesta data.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
