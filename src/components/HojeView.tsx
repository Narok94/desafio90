import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { CheckDiario, Usuario, ItemDieta, CheckDieta } from '../types';
import { Flame, CheckCircle, Trophy, Sparkles, LogOut, Check, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HojeViewProps {
  usuario: Usuario;
  onLogout: () => void;
  checks: CheckDiario[];
  onRefreshChecks: () => Promise<void>;
}

export default function HojeView({ usuario, onLogout, checks, onRefreshChecks }: HojeViewProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [streak, setStreak] = useState<number>(0);
  const [daysRemaining, setDaysRemaining] = useState<number>(90);
  
  // Diet state
  const [itensDieta, setItensDieta] = useState<ItemDieta[]>([]);
  const [checksDieta, setChecksDieta] = useState<CheckDieta[]>([]);
  const [loadingDieta, setLoadingDieta] = useState<boolean>(true);

  const [todayCheck, setTodayCheck] = useState<Omit<CheckDiario, 'id' | 'usuario_id'>>({
    data: '',
    treino: false,
    zero_doce: false,
    zero_besteira: false,
    agua: false,
    sono: false
  });

  // Helper for YYYY-MM-DD
  function getLocalDateString(date: Date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const todayStr = getLocalDateString();

  const loadDietaData = async () => {
    try {
      const [items, currentChecks] = await Promise.all([
        api.getItensDieta(),
        api.getChecksDieta(todayStr)
      ]);
      setItensDieta(items);
      setChecksDieta(currentChecks);
    } catch (err) {
      console.error('Erro ao carregar dieta no HojeView:', err);
    } finally {
      setLoadingDieta(false);
    }
  };

  // Load and calculate today's data, streak, and countdown
  useEffect(() => {
    // 1. Find today's check
    const currentToday = checks.find(c => c.data === todayStr);
    if (currentToday) {
      setTodayCheck({
        data: currentToday.data,
        treino: currentToday.treino,
        zero_doce: currentToday.zero_doce,
        zero_besteira: currentToday.zero_besteira,
        agua: currentToday.agua,
        sono: currentToday.sono
      });
    } else {
      setTodayCheck({
        data: todayStr,
        treino: false,
        zero_doce: false,
        zero_besteira: false,
        agua: false,
        sono: false
      });
    }

    // 2. Calculate challenge start & remaining days
    if (checks.length > 0) {
      const earliestCheck = checks.reduce((earliest, current) => {
        return current.data < earliest ? current.data : earliest;
      }, checks[0].data);

      const start = new Date(earliestCheck);
      const today = new Date(todayStr);
      const diffTime = Math.abs(today.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const elapsed = Math.min(diffDays, 90);
      setDaysRemaining(90 - elapsed);
    } else {
      setDaysRemaining(90);
    }

    // 3. Calculate streak
    setStreak(calculateCurrentStreak(checks));
    
    // 4. Load diet checklist
    loadDietaData();
  }, [checks, todayStr]);

  function calculateCurrentStreak(list: CheckDiario[]): number {
    if (!list || list.length === 0) return 0;
    
    const activeCheckDates = new Set(
      list
         // Include any day with at least one active habit check-in
        .filter(c => c.treino || c.zero_doce || c.zero_besteira || c.agua || c.sono)
        .map(c => c.data)
    );

    if (activeCheckDates.size === 0) return 0;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let startSearchStr = todayStr;
    if (!activeCheckDates.has(todayStr)) {
      if (activeCheckDates.has(yesterdayStr)) {
        startSearchStr = yesterdayStr;
      } else {
        return 0; // Streak broken
      }
    }

    let count = 0;
    const tempDate = new Date(startSearchStr);

    while (true) {
      const checkStr = getLocalDateString(tempDate);
      if (activeCheckDates.has(checkStr)) {
        count++;
        tempDate.setDate(tempDate.getDate() - 1);
      } else {
        break;
      }
    }

    return count;
  }

  const handleToggleHabit = async (habitKey: 'treino' | 'zero_doce' | 'zero_besteira' | 'agua' | 'sono') => {
    if (loading) return;
    setLoading(true);

    const updatedCheck = {
      ...todayCheck,
      [habitKey]: !todayCheck[habitKey]
    };

    // Optimistic Update
    setTodayCheck(updatedCheck);

    try {
      await api.saveCheck(todayStr, updatedCheck);
      await onRefreshChecks();
    } catch (err) {
      // Revert if error
      setTodayCheck(todayCheck);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDietMeal = async (itemId: number) => {
    const isChecked = checksDieta.some(c => c.item_dieta_id === itemId && c.cumprido);
    
    // Optimistic Update
    const updatedChecks = isChecked
      ? checksDieta.filter(c => c.item_dieta_id !== itemId)
      : [...checksDieta, { id: 0, usuario_id: usuario.id, item_dieta_id: itemId, data: todayStr, cumprido: true }];
    
    setChecksDieta(updatedChecks);

    try {
      await api.saveChecksDieta(todayStr, [
        { item_dieta_id: itemId, cumprido: !isChecked }
      ]);
      const currentChecks = await api.getChecksDieta(todayStr);
      setChecksDieta(currentChecks);
      await onRefreshChecks(); // Refresh comparison stats
    } catch (err) {
      console.error('Erro ao salvar check da dieta:', err);
      loadDietaData();
    }
  };

  const completedCount = [
    todayCheck.treino,
    todayCheck.zero_doce,
    todayCheck.zero_besteira,
    todayCheck.agua,
    todayCheck.sono
  ].filter(Boolean).length;

  const totalDietMeals = itensDieta.length;
  const completedDietMeals = checksDieta.filter(c => c.cumprido).length;

  // A truly Perfect Legendary Day is when all habits are checked AND (either there is no diet plan or all diet meals are checked)
  const isPerfectDay = completedCount === 5 && (totalDietMeals === 0 || completedDietMeals === totalDietMeals);

  // Gamified message builder
  const getMotivationalMessage = () => {
    const totalPossible = 5 + totalDietMeals;
    const currentCompleted = completedCount + completedDietMeals;

    if (currentCompleted === 0) {
      return {
        text: 'Bora começar o dia? Cada pequeno passo conta! 🏁',
        sub: 'Toque nos cards para marcar suas conquistas de hoje.',
        color: 'text-slate-500 bg-slate-100'
      };
    } else if (currentCompleted < Math.floor(totalPossible / 2)) {
      return {
        text: 'Bom começo! Passo a passo você chega lá... 💪',
        sub: 'Sua consistência dita os resultados de 90 dias.',
        color: 'text-amber-600 bg-amber-50 border-amber-100'
      };
    } else if (currentCompleted < totalPossible) {
      return {
        text: 'Você tá voando no desafio de hoje! Quase tudo pronto! ⚡',
        sub: 'Só mais um pouco para fechar com chave de ouro.',
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
      };
    } else {
      return {
        text: 'DIÁRIO LENDÁRIO CONQUISTADO! 🔥👑',
        sub: 'Você alcançou 100% de consistência hoje! Orgulho total!',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-100'
      };
    }
  };

  const msg = getMotivationalMessage();

  const isJessica = usuario.nome === 'Jéssica';
  const colorTheme = isJessica ? {
    primary: 'from-rose-500 to-orange-400',
    primarySolid: 'bg-rose-500',
    border: 'border-rose-100',
    accentText: 'text-rose-500',
    accentBg: 'bg-rose-50',
    glow: 'shadow-rose-100'
  } : {
    primary: 'from-emerald-500 to-teal-400',
    primarySolid: 'bg-emerald-500',
    border: 'border-emerald-100',
    accentText: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    glow: 'shadow-emerald-100'
  };

  const habits = [
    { key: 'treino' as const, label: 'Treino', emoji: '🏋️', description: 'Atividade física', activeBg: isJessica ? 'bg-rose-500' : 'bg-emerald-500' },
    { key: 'zero_doce' as const, label: 'Zero Doce', emoji: '🚫🍬', description: 'Sem açúcar refinado', activeBg: isJessica ? 'bg-orange-500' : 'bg-teal-500' },
    { key: 'zero_besteira' as const, label: 'Zero Besteira', emoji: '🚫🍟', description: 'Sem fritura ou ultraprocessados', activeBg: isJessica ? 'bg-pink-500' : 'bg-emerald-600' },
    { key: 'agua' as const, label: 'Água (3L+)', emoji: '💧', description: 'Hidratação batida', activeBg: 'bg-blue-500' },
    { key: 'sono' as const, label: 'Sono Regular', emoji: '😴', description: '7h a 8h de descanso', activeBg: 'bg-indigo-500' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-28">
      
      {/* Header Profile with Logout */}
      <div className="w-full bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${colorTheme.primary} flex items-center justify-center font-display font-extrabold text-white`}>
            {usuario.nome[0]}
          </div>
          <div>
            <h2 className="text-sm font-display font-extrabold text-slate-900 flex items-center space-x-1">
              <span>{usuario.nome}</span>
              <span>{isJessica ? '🌸' : '⚡'}</span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Desafio de 90 Dias</p>
          </div>
        </div>

        <button
          id="btn-logout"
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-slate-600 active:scale-95 transition-all rounded-lg hover:bg-slate-50 cursor-pointer"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-6 space-y-6 w-full max-w-md mx-auto">
        
        {/* Game Stats (Grid: Streak and Countdown) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Streak Flame Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center space-x-3 relative overflow-hidden">
            <div className={`w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center`}>
              <Flame className={`w-6 h-6 text-orange-500 fill-orange-500 ${streak > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-slate-900">{streak}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Sequência 🔥</div>
            </div>
            {streak > 0 && (
              <div className="absolute top-1 right-2">
                <span className="text-[10px] text-orange-400 font-bold">Tá queimando!</span>
              </div>
            )}
          </div>

          {/* Countdown Card */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-blue-500 fill-blue-50" />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-slate-900">{daysRemaining}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Dias Restantes 🏁</div>
            </div>
          </div>
        </div>

        {/* Dynamic Interactive Progress Board */}
        <div className={`p-4 rounded-2xl border ${colorTheme.border} bg-white shadow-sm relative overflow-hidden`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Hábitos de Hoje</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${colorTheme.accentBg} ${colorTheme.accentText}`}>
              {completedCount}/5 Cumpridos
            </span>
          </div>

          {/* Progress Micro-Bar */}
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4 relative">
            <div
              className={`h-full bg-gradient-to-r ${colorTheme.primary} rounded-full transition-all duration-300`}
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>

          {/* Dieta Progress */}
          {totalDietMeals > 0 && (
            <div className="border-t border-slate-100 pt-3 mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase">Plano de Dieta</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                  {completedDietMeals}/{totalDietMeals} Refeições
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedDietMeals / totalDietMeals) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Message text */}
          <div className="text-center py-1 mt-4 border-t border-slate-50 pt-3">
            <h4 className="text-sm font-display font-extrabold text-slate-800">{msg.text}</h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{msg.sub}</p>
          </div>
        </div>

        {/* 100% Celebration Screen if perfect day */}
        <AnimatePresence>
          {isPerfectDay && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-tr from-amber-400 to-orange-400 rounded-2xl p-4 text-white text-center shadow-lg shadow-amber-100 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 text-left">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl animate-bounce">
                  🏆
                </div>
                <div>
                  <h3 className="font-display font-black text-base">Dia Lendário Conquistado!</h3>
                  <p className="text-xs opacity-90 font-medium">Você completou 100% dos hábitos e refeições!</p>
                </div>
              </div>
              <Sparkles className="w-6 h-6 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Habit Interactive List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
            <span>🎯</span>
            <span>Minhas Metas Diárias</span>
          </div>
          
          {habits.map(habit => {
            const isChecked = !!todayCheck[habit.key];
            return (
              <button
                key={habit.key}
                id={`habit-card-${habit.key}`}
                onClick={() => handleToggleHabit(habit.key)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] text-left relative overflow-hidden ${
                  isChecked 
                    ? 'bg-white border-slate-100 shadow-md transform translate-y-[-2px]' 
                    : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
                }`}
              >
                {/* Left Side: Emoji and Label */}
                <div className="flex items-center space-x-4 z-10">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all duration-300 ${
                    isChecked ? `${habit.activeBg} text-white shadow-sm` : 'bg-slate-50'
                  }`}>
                    {isChecked ? <Check className="w-6 h-6 stroke-[3]" /> : habit.emoji}
                  </div>
                  <div>
                    <h3 className={`font-display font-bold text-base transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                      {habit.label}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">{habit.description}</p>
                  </div>
                </div>

                {/* Right Side Check Circle indicator */}
                <div className="z-10">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isChecked 
                      ? isJessica
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-slate-200 bg-white'
                  }`}>
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Subtle colorful active background strip */}
                {isChecked && (
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${habit.activeBg}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Diet Checklist */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Utensils className="w-4 h-4" />
            <span>Minha Nutrição / Dieta</span>
          </div>

          {loadingDieta ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 flex justify-center">
              <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${colorTheme.accentText}`} />
            </div>
          ) : itensDieta.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center space-y-1.5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400">Nenhuma refeição cadastrada.</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Vá até a aba <strong className="font-bold">Dieta</strong> no menu inferior para cadastrar seu plano de refeições e acompanhar aqui diariamente!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {itensDieta.map(item => {
                const isChecked = checksDieta.some(c => c.item_dieta_id === item.id && c.cumprido);
                return (
                  <button
                    key={item.id}
                    id={`diet-meal-card-${item.id}`}
                    onClick={() => handleToggleDietMeal(item.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all active:scale-[0.98] text-left relative overflow-hidden ${
                      isChecked 
                        ? 'bg-white border-slate-100 shadow-md transform translate-y-[-2px]' 
                        : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-4 z-10">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300 ${
                        isChecked ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-50'
                      }`}>
                        {isChecked ? <Check className="w-6 h-6 stroke-[3]" /> : '🥗'}
                      </div>
                      <div className="min-w-0 pr-6">
                        <h3 className={`font-display font-bold text-sm truncate transition-colors ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                          {item.nome_refeicao}
                        </h3>
                        {item.descricao ? (
                          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">{item.descricao}</p>
                        ) : (
                          <span className="text-[10px] italic text-slate-300">Sem descrição</span>
                        )}
                      </div>
                    </div>

                    <div className="z-10 flex-shrink-0">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isChecked 
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-slate-200 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    {isChecked && (
                      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
