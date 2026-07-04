import { useState, useEffect } from 'react';
import { Usuario, CheckDiario, Medida } from './types';
import { api, getSavedUsuario, clearSession } from './api';
import LoginView from './components/LoginView';
import HojeView from './components/HojeView';
import DietaView from './components/DietaView';
import ProgressoView from './components/ProgressoView';
import HistoricoView from './components/HistoricoView';
import AdminView from './components/AdminView';
import BottomNav, { TabType } from './components/BottomNav';

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('hoje');
  const [checks, setChecks] = useState<CheckDiario[]>([]);
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load session on startup
  useEffect(() => {
    const saved = getSavedUsuario();
    if (saved) {
      setUsuario(saved);
    }
    setLoading(false);

    // Event listener for unauthorized token expirations
    const handleAuthExpired = () => {
      setUsuario(null);
      setChecks([]);
      setMedidas([]);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  // Fetch participant-specific data
  const loadParticipantData = async () => {
    if (!usuario || usuario.papel !== 'participante') return;
    try {
      const [checksData, medidasData] = await Promise.all([
        api.getChecks(),
        api.getMedidas()
      ]);
      setChecks(checksData);
      setMedidas(medidasData);
    } catch (err) {
      console.error('Erro ao carregar dados do participante:', err);
    }
  };

  useEffect(() => {
    if (usuario && usuario.papel === 'participante') {
      loadParticipantData();
    }
  }, [usuario]);

  const handleLoginSuccess = (user: Usuario) => {
    setUsuario(user);
    setActiveTab('hoje');
  };

  const handleLogout = () => {
    clearSession();
    setUsuario(null);
    setChecks([]);
    setMedidas([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400">Carregando Desafio 90...</p>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, show Login view
  if (!usuario) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. If Administrator, show the Admin Dashboard view
  if (usuario.papel === 'admin') {
    return <AdminView usuario={usuario} onLogout={handleLogout} />;
  }

  // 3. If Participant, show the active Tab with the Bottom Navigation
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      
      {/* Tab Switcher Panel */}
      <main className="w-full">
        {activeTab === 'hoje' && (
          <HojeView
            usuario={usuario}
            onLogout={handleLogout}
            checks={checks}
            onRefreshChecks={loadParticipantData}
          />
        )}

        {activeTab === 'dieta' && (
          <DietaView
            usuario={usuario}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'progresso' && (
          <ProgressoView
            usuario={usuario}
            medidas={medidas}
            onRefreshMedidas={loadParticipantData}
          />
        )}

        {activeTab === 'historico' && (
          <HistoricoView
            usuario={usuario}
            checks={checks}
          />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        accentColor={usuario.cor_identidade}
      />
    </div>
  );
}
