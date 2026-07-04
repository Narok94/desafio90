import { Dumbbell, TrendingUp, Calendar, Utensils } from 'lucide-react';

export type TabType = 'hoje' | 'dieta' | 'progresso' | 'historico';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  accentColor: string; // 'coral' (Jéssica) or 'green' (Henrique)
}

export default function BottomNav({ activeTab, onChangeTab, accentColor }: BottomNavProps) {
  const isCoral = accentColor === 'coral';
  
  // Custom active indicator background
  const activeBgClass = isCoral 
    ? 'bg-rose-500 text-white shadow-md shadow-rose-200' 
    : 'bg-emerald-500 text-white shadow-md shadow-emerald-200';

  const tabItems = [
    { id: 'hoje' as TabType, label: 'Hoje', icon: Dumbbell },
    { id: 'dieta' as TabType, label: 'Dieta', icon: Utensils },
    { id: 'progresso' as TabType, label: 'Progresso', icon: TrendingUp },
    { id: 'historico' as TabType, label: 'Histórico', icon: Calendar },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-50/80 backdrop-blur-md border-t border-slate-100 z-50 flex justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100/50 flex justify-around p-2 relative">
        {tabItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              id={`tab-button-${item.id}`}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl font-display font-bold text-xs transition-all duration-200 select-none cursor-pointer flex-1 ${
                isActive 
                  ? `${activeBgClass} transform scale-105` 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5 mb-1 stroke-[2.5]" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
