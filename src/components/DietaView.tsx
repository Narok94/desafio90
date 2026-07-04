import React, { useState, useEffect } from 'react';
import { Usuario, ItemDieta } from '../types';
import { api } from '../api';
import { Plus, Trash2, Edit2, ArrowUp, ArrowDown, Utensils, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DietaViewProps {
  usuario: Usuario;
  onLogout: () => void;
}

export default function DietaView({ usuario, onLogout }: DietaViewProps) {
  const [itens, setItens] = useState<ItemDieta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ItemDieta | null>(null);

  // Form states
  const [nomeRefeicao, setNomeRefeicao] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');

  const isCoral = usuario.cor_identidade === 'coral';
  const accentBg = isCoral ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white';
  const accentText = isCoral ? 'text-rose-500' : 'text-emerald-500';
  const accentBorder = isCoral ? 'border-rose-100' : 'border-emerald-100';
  const accentRing = isCoral ? 'focus:ring-rose-400' : 'focus:ring-emerald-400';

  const loadItens = async () => {
    setLoading(true);
    try {
      const data = await api.getItensDieta();
      setItens(data);
    } catch (err) {
      console.error('Erro ao buscar itens da dieta:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItens();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setNomeRefeicao('');
    setDescricao('');
    setShowForm(true);
  };

  const handleOpenEdit = (item: ItemDieta) => {
    setEditingItem(item);
    setNomeRefeicao(item.nome_refeicao);
    setDescricao(item.descricao || '');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeRefeicao.trim()) return;

    try {
      const nextOrdem = editingItem 
        ? editingItem.ordem 
        : (itens.length > 0 ? Math.max(...itens.map(i => i.ordem)) + 1 : 1);

      await api.saveItemDieta({
        id: editingItem?.id,
        nome_refeicao: nomeRefeicao,
        descricao: descricao || undefined,
        ordem: nextOrdem
      });

      setShowForm(false);
      loadItens();
    } catch (err) {
      console.error('Erro ao salvar item da dieta:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza de que deseja remover esta refeição do seu plano de dieta?')) return;
    try {
      await api.deleteItemDieta(id);
      loadItens();
    } catch (err) {
      console.error('Erro ao excluir item da dieta:', err);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const itemsCopy = [...itens];
    const current = itemsCopy[index];
    const prev = itemsCopy[index - 1];

    // Swap order
    const currentOrdem = current.ordem;
    current.ordem = prev.ordem;
    prev.ordem = currentOrdem;

    try {
      setItens(itemsCopy.sort((a, b) => a.ordem - b.ordem));
      await Promise.all([
        api.saveItemDieta({ id: current.id, nome_refeicao: current.nome_refeicao, descricao: current.descricao, ordem: current.ordem }),
        api.saveItemDieta({ id: prev.id, nome_refeicao: prev.nome_refeicao, descricao: prev.descricao, ordem: prev.ordem })
      ]);
      loadItens();
    } catch (err) {
      console.error('Erro ao ordenar refeições:', err);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === itens.length - 1) return;
    const itemsCopy = [...itens];
    const current = itemsCopy[index];
    const next = itemsCopy[index + 1];

    // Swap order
    const currentOrdem = current.ordem;
    current.ordem = next.ordem;
    next.ordem = currentOrdem;

    try {
      setItens(itemsCopy.sort((a, b) => a.ordem - b.ordem));
      await Promise.all([
        api.saveItemDieta({ id: current.id, nome_refeicao: current.nome_refeicao, descricao: current.descricao, ordem: current.ordem }),
        api.saveItemDieta({ id: next.id, nome_refeicao: next.nome_refeicao, descricao: next.descricao, ordem: next.ordem })
      ]);
      loadItens();
    } catch (err) {
      console.error('Erro ao ordenar refeições:', err);
    }
  };

  return (
    <div className="pb-32 pt-6 px-4 max-w-md mx-auto space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-slate-400">Desafio 90 Dias</span>
          <h1 className="text-xl font-bold font-display tracking-tight text-slate-800">
            Minha Dieta
          </h1>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"
        >
          Sair
        </button>
      </header>

      {/* Intro Card */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden shadow-md">
        <div className="relative z-10 space-y-2">
          <div className={`p-2 w-10 h-10 rounded-xl flex items-center justify-center bg-white/10`}>
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold font-display">Plano de Refeições</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Monte o seu plano de refeições ideal. As refeições cadastradas aqui aparecerão como uma lista de tarefas na sua tela principal para você marcar diariamente.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 transform translate-x-1/4 translate-y-1/4 opacity-10">
          <Utensils className="w-48 h-48" />
        </div>
      </div>

      {/* Button to Add */}
      <button
        onClick={handleOpenAdd}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all shadow-sm cursor-pointer ${accentBg}`}
      >
        <Plus className="w-5 h-5" />
        Adicionar Refeição
      </button>

      {/* Form (Modal/Overlay for adding/editing) */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-md rounded-t-3xl rounded-b-2xl p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold font-display text-slate-800">
                  {editingItem ? 'Editar Refeição' : 'Nova Refeição'}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nome da refeição
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Café da manhã, Almoço..."
                    value={nomeRefeicao}
                    onChange={(e) => setNomeRefeicao(e.target.value)}
                    className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:border-transparent ${accentRing}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Descrição do que comer (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: 3 ovos mexidos, 1 banana, café sem açúcar..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:border-transparent ${accentRing}`}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full py-4 rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 ${accentBg}`}
                >
                  <Check className="w-5 h-5" />
                  Salvar Refeição
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meal list */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Utensils className="w-4 h-4" />
          Minhas Refeições ({itens.length})
        </h3>

        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 flex justify-center items-center">
            <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${accentText}`} />
          </div>
        ) : itens.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-2">
            <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-400">Nenhuma refeição cadastrada.</p>
            <p className="text-[10px] text-slate-400">Cadastre suas refeições diárias para habilitar o checklist diário de nutrição.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((item, index) => (
              <motion.div
                key={item.id}
                layoutId={`meal-card-${item.id}`}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3 relative hover:border-slate-200 transition-colors"
              >
                {/* Ordinal indicators & Move controls */}
                <div className="flex flex-col items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <button
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className={`p-1 rounded hover:bg-white text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    {index + 1}
                  </span>
                  <button
                    disabled={index === itens.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className={`p-1 rounded hover:bg-white text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-12">
                  <h4 className="text-sm font-bold text-slate-800 truncate">
                    {item.nome_refeicao}
                  </h4>
                  {item.descricao ? (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                      {item.descricao}
                    </p>
                  ) : (
                    <span className="text-[10px] italic text-slate-400">Sem descrição</span>
                  )}
                </div>

                {/* Actions */}
                <div className="absolute right-4 top-4 flex gap-1">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
