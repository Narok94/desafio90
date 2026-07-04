import { useState, useEffect } from 'react';
import { api, saveToken, saveUsuario } from '../api';
import { Usuario } from '../types';
import { Flame, Lock, ChevronLeft, Sparkles, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginViewProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await api.getUsers();
        setUsers(data);
      } catch (err) {
        // Fallback static users if server is loading or initializing
        setUsers([
          { id: 1, nome: 'Jéssica', papel: 'participante', cor_identidade: 'coral' },
          { id: 2, nome: 'Henrique', papel: 'participante', cor_identidade: 'green' },
          { id: 3, nome: 'Tatu', papel: 'admin', cor_identidade: 'indigo' }
        ]);
      }
    }
    loadUsers();
  }, []);

  const handleKeyPress = (num: string) => {
    setError('');
    // For Tatu (admin), PIN is 8 characters. For participants, PIN is 4 characters.
    const maxLen = selectedUser?.papel === 'admin' ? 8 : 4;
    if (pin.length < maxLen) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  // Submit login once PIN is complete
  useEffect(() => {
    if (!selectedUser) return;
    const requiredLen = selectedUser.papel === 'admin' ? 8 : 4;

    if (pin.length === requiredLen) {
      handleLogin();
    }
  }, [pin]);

  const handleLogin = async () => {
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.login(selectedUser.nome, pin);
      saveToken(response.token);
      saveUsuario(response.usuario);
      onLoginSuccess(response.usuario);
    } catch (err: any) {
      setError(err.message || 'PIN incorreto. Tente novamente! 🥺');
      setPin(''); // Reset PIN on error
    } finally {
      setLoading(false);
    }
  };

  // Get color configurations based on identity
  const getUserColorClasses = (user: Usuario) => {
    if (user.nome === 'Jéssica') {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-600',
        activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-200 border-rose-500',
        text: 'text-rose-700',
        avatarBg: 'bg-gradient-to-tr from-rose-400 to-coral-400 text-white'
      };
    } else if (user.nome === 'Henrique') {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
        activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 border-emerald-500',
        text: 'text-emerald-700',
        avatarBg: 'bg-gradient-to-tr from-emerald-400 to-teal-400 text-white'
      };
    } else {
      return {
        bg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
        activeBg: 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-600',
        text: 'text-indigo-700',
        avatarBg: 'bg-gradient-to-tr from-indigo-500 to-purple-500 text-white'
      };
    }
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center px-4 py-8 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-6 sm:p-8 relative overflow-hidden">
        
        {/* Background visual blob */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full filter blur-2xl opacity-40 -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-lime-100 rounded-full filter blur-2xl opacity-40 -ml-10 -mb-10" />

        {/* Title */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-md mb-3 transform rotate-3 hover:rotate-12 transition-transform">
            <Flame className="w-9 h-9 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight text-center">
            Desafio <span className="text-orange-500">90</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">90 dias focados em evolução 💪</p>
        </div>

        <AnimatePresence mode="wait">
          {!selectedUser ? (
            /* USER SELECTION SCREEN */
            <motion.div
              key="user-select"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="text-lg font-display font-bold text-slate-800">Quem é você? 🧐</h2>
                <p className="text-xs text-slate-400 mt-1">Selecione o seu perfil para continuar</p>
              </div>

              <div className="grid gap-3">
                {users.map(user => {
                  const colors = getUserColorClasses(user);
                  return (
                    <button
                      key={user.id}
                      id={`login-user-${user.id}`}
                      onClick={() => {
                        setSelectedUser(user);
                        setError('');
                        setPin('');
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-98 ${colors.bg} hover:bg-slate-50`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-extrabold text-lg shadow-sm ${colors.avatarBg}`}>
                          {user.nome[0]}
                        </div>
                        <div className="text-left">
                          <h3 className={`font-display font-bold text-base ${colors.text}`}>{user.nome}</h3>
                          <span className="text-xs text-slate-400 font-medium capitalize">
                            {user.papel === 'admin' ? 'Coordenador Técnico 👑' : 'Competidor 🔥'}
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-400">➡️</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            /* PIN NUMERIC KEYPAD SCREEN */
            <motion.div
              key="pin-keypad"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {/* Back Button */}
              <button
                id="btn-back-login"
                onClick={() => setSelectedUser(null)}
                className="self-start flex items-center space-x-1 text-xs text-slate-400 font-bold hover:text-slate-600 transition-colors mb-4"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-2 text-base font-display font-bold text-slate-800">
                  <span>Olá, {selectedUser.nome}</span>
                  <span className="text-xl">
                    {selectedUser.nome === 'Jéssica' ? '🌸' : selectedUser.nome === 'Henrique' ? '⚡' : '👑'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Digite seu PIN para desbloquear o app</p>
              </div>

              {/* Password visual indicators */}
              <div className="flex space-x-3 mb-4">
                {Array.from({ length: selectedUser.papel === 'admin' ? 8 : 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                      i < pin.length
                        ? selectedUser.nome === 'Jéssica'
                          ? 'bg-rose-500 border-rose-500 scale-110 shadow-sm shadow-rose-200'
                          : selectedUser.nome === 'Henrique'
                          ? 'bg-emerald-500 border-emerald-500 scale-110 shadow-sm shadow-emerald-200'
                          : 'bg-indigo-600 border-indigo-600 scale-110 shadow-sm shadow-indigo-200'
                        : 'border-slate-300'
                    }`}
                  />
                ))}
              </div>

              {/* Error messages */}
              <div className="h-6 mb-2">
                {error && (
                  <span className="text-xs font-semibold text-rose-500 text-center animate-bounce block">
                    {error}
                  </span>
                )}
                {loading && (
                  <span className="text-xs font-semibold text-slate-400 text-center block animate-pulse">
                    Validando PIN... 🔒
                  </span>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    id={`keypad-${num}`}
                    disabled={loading}
                    onClick={() => handleKeyPress(num)}
                    className="w-16 h-16 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 font-display font-extrabold text-xl text-slate-800 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear button */}
                <button
                  id="keypad-clear"
                  disabled={loading}
                  onClick={handleClear}
                  className="w-16 h-16 rounded-2xl font-display font-bold text-xs text-slate-400 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  LIMPAR
                </button>

                {/* Number 0 */}
                <button
                  id="keypad-0"
                  disabled={loading}
                  onClick={() => handleKeyPress('0')}
                  className="w-16 h-16 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 font-display font-extrabold text-xl text-slate-800 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                >
                  0
                </button>

                {/* Backspace button */}
                <button
                  id="keypad-delete"
                  disabled={loading}
                  onClick={handleDelete}
                  className="w-16 h-16 rounded-2xl font-display font-bold text-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  ⌫
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
