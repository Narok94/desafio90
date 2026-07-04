import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Medida, Usuario, FotoProgresso } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Scale, Camera, Upload, Plus, Sparkles, Image as ImageIcon, Check, Ruler, Calendar, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProgressoViewProps {
  usuario: Usuario;
  medidas: Medida[];
  onRefreshMedidas: () => Promise<void>;
}

export default function ProgressoView({ usuario, medidas, onRefreshMedidas }: ProgressoViewProps) {
  // Database photos state
  const [fotos, setFotos] = useState<FotoProgresso[]>([]);
  const [loadingFotos, setLoadingFotos] = useState<boolean>(true);

  // Toggle Forms
  const [showMedicaoForm, setShowMedicaoForm] = useState<boolean>(false);
  const [showFotoForm, setShowFotoForm] = useState<boolean>(false);
  
  // Forms general loading/error state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // New Measurement Form States
  const [dataMedicao, setDataMedicao] = useState<string>(new Date().toISOString().split('T')[0]);
  const [peso, setPeso] = useState<string>('');
  const [bracoDireito, setBracoDireito] = useState<string>('');
  const [bracoEsquerdo, setBracoEsquerdo] = useState<string>('');
  const [pernaDireita, setPernaDireita] = useState<string>('');
  const [pernaEsquerda, setPernaEsquerda] = useState<string>('');
  const [barriga, setBarriga] = useState<string>('');
  const [cintura, setCintura] = useState<string>('');
  const [quadril, setQuadril] = useState<string>('');
  const [peito, setPeito] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');

  // New Photo Form States
  const [dataFoto, setDataFoto] = useState<string>(new Date().toISOString().split('T')[0]);
  const [legenda, setLegenda] = useState<string>('');
  const [fotoBase64, setFotoBase64] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  
  // Chart Metric Selection
  const [selectedMetric, setSelectedMetric] = useState<string>('peso');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isJessica = usuario.nome === 'Jéssica';
  const colorTheme = isJessica ? {
    primary: 'from-rose-500 to-orange-400',
    primarySolid: 'bg-rose-500',
    border: 'border-rose-100',
    accentText: 'text-rose-500',
    accentBg: 'bg-rose-50',
    chartColor: '#f43f5e',
    glow: 'shadow-rose-100'
  } : {
    primary: 'from-emerald-500 to-teal-400',
    primarySolid: 'bg-emerald-500',
    border: 'border-emerald-100',
    accentText: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    chartColor: '#10b981',
    glow: 'shadow-emerald-100'
  };

  const metricsOptions = [
    { key: 'peso', label: 'Peso (kg)' },
    { key: 'braco_direito', label: 'Braço Direito (cm)' },
    { key: 'braco_esquerdo', label: 'Braço Esquerdo (cm)' },
    { key: 'perna_direita', label: 'Perna Direita (cm)' },
    { key: 'perna_esquerda', label: 'Perna Esquerda (cm)' },
    { key: 'barriga', label: 'Barriga (cm)' },
    { key: 'cintura', label: 'Cintura (cm)' },
    { key: 'quadril', label: 'Quadril (cm)' },
    { key: 'peito', label: 'Peito (cm)' },
  ];

  const loadFotos = async () => {
    setLoadingFotos(true);
    try {
      const data = await api.getFotosProgresso();
      setFotos(data);
    } catch (err) {
      console.error('Erro ao buscar fotos de progresso:', err);
    } finally {
      setLoadingFotos(false);
    }
  };

  useEffect(() => {
    loadFotos();
  }, []);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, envie apenas arquivos de imagem.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('A imagem é muito grande. Escolha uma foto menor que 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoBase64(reader.result);
        setError('');
      }
    };
    reader.onerror = () => {
      setError('Erro ao processar imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Format YYYY-MM-DD to DD/MM/YYYY
  const formatBrazilianDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`; // DD/MM
    }
    return dateStr;
  };

  // Handle Photo submit
  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fotoBase64) {
      setError('A foto é obrigatória.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.addFotoProgresso({
        data: dataFoto,
        foto_url: fotoBase64,
        legenda: legenda || undefined
      });

      // Reset
      setFotoBase64('');
      setLegenda('');
      setDataFoto(new Date().toISOString().split('T')[0]);
      setShowFotoForm(false);
      await loadFotos();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar foto de progresso.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Measurement Submit
  const handleMedicaoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peso) {
      setError('O peso é obrigatório.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.addMedida({
        data: dataMedicao,
        peso: parseFloat(peso),
        braco_direito: bracoDireito ? parseFloat(bracoDireito) : undefined,
        braco_esquerdo: bracoEsquerdo ? parseFloat(bracoEsquerdo) : undefined,
        perna_direita: pernaDireita ? parseFloat(pernaDireita) : undefined,
        perna_esquerda: pernaEsquerda ? parseFloat(pernaEsquerda) : undefined,
        barriga: barriga ? parseFloat(barriga) : undefined,
        cintura: cintura ? parseFloat(cintura) : undefined,
        quadril: quadril ? parseFloat(quadril) : undefined,
        peito: peito ? parseFloat(peito) : undefined,
        observacao: observacao || undefined
      });

      // Reset
      setPeso('');
      setBracoDireito('');
      setBracoEsquerdo('');
      setPernaDireita('');
      setPernaEsquerda('');
      setBarriga('');
      setCintura('');
      setQuadril('');
      setPeito('');
      setObservacao('');
      setDataMedicao(new Date().toISOString().split('T')[0]);
      setShowMedicaoForm(false);
      await onRefreshMedidas();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar medidas.');
    } finally {
      setLoading(false);
    }
  };

  // Chart data formatting
  const chartData = medidas
    .filter(m => {
      const val = m[selectedMetric as keyof Medida];
      return val !== undefined && val !== null && val !== '';
    })
    .map(m => ({
      data: formatDateLabel(m.data),
      valor: parseFloat(String(m[selectedMetric as keyof Medida])),
      fullDate: m.data
    }));

  const hasPhotos = fotos.length > 0;
  const firstPhoto = hasPhotos ? fotos[0] : null;
  const latestPhoto = hasPhotos ? fotos[fotos.length - 1] : null;

  // Weight Loss
  const getWeightLoss = () => {
    if (medidas.length < 1) return { actual: '-', loss: '-' };
    const latest = medidas[medidas.length - 1].peso;
    if (medidas.length === 1) return { actual: `${latest} kg`, loss: '0.0 kg' };
    const initial = medidas[0].peso;
    const diff = initial - latest;
    return {
      actual: `${latest} kg`,
      loss: `${diff > 0 ? '-' : '+'}${Math.abs(diff).toFixed(1)} kg`
    };
  };

  const stats = getWeightLoss();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-28">
      
      {/* Header */}
      <div className="w-full bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-950">Medidas e Fotos</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Desempenho &amp; Evolução</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowFotoForm(prev => !prev);
              setShowMedicaoForm(false);
              setError('');
            }}
            className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              showFotoForm 
                ? 'bg-slate-700 text-white' 
                : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Foto</span>
          </button>
          
          <button
            onClick={() => {
              setShowMedicaoForm(prev => !prev);
              setShowFotoForm(false);
              setError('');
            }}
            className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              showMedicaoForm 
                ? 'bg-slate-700 text-white' 
                : `bg-gradient-to-tr ${colorTheme.primary} text-white shadow-sm hover:opacity-90`
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Medição</span>
          </button>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6 w-full max-w-md mx-auto">
        
        {/* Error message */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Add Photo Form */}
        <AnimatePresence>
          {showFotoForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handlePhotoSubmit} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 text-sm font-display font-bold text-slate-800 border-b border-slate-50 pb-2">
                  <Camera className={`w-5 h-5 ${colorTheme.accentText}`} />
                  <span>Adicionar Foto de Progresso</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data da Foto</label>
                    <input
                      type="date"
                      required
                      value={dataFoto}
                      onChange={e => setDataFoto(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Legenda (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: 30 dias de foco, jejum..."
                      value={legenda}
                      onChange={e => setLegenda(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Foto *</label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={triggerFileInput}
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                        isDragOver 
                          ? 'border-slate-500 bg-slate-50' 
                          : fotoBase64 
                          ? 'border-emerald-200 bg-emerald-50/20' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />

                      {fotoBase64 ? (
                        <div className="flex flex-col items-center space-y-2">
                          <img src={fotoBase64} alt="Preview" className="w-24 h-32 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                          <span className="text-xs font-bold text-emerald-600">Foto carregada! ✨</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setFotoBase64(''); }}
                            className="text-[10px] text-slate-400 hover:text-rose-500 font-bold"
                          >
                            Remover e escolher outra
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-300 mb-1" />
                          <span className="text-xs font-bold text-slate-600">Arraste e solte ou toque para buscar</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">JPG ou PNG, tamanho max 4MB</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-display font-bold text-sm text-white bg-gradient-to-tr ${colorTheme.primary} shadow-md flex items-center justify-center gap-1.5`}
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Salvando...' : 'Salvar Foto'}</span>
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Add Measurement Form */}
        <AnimatePresence>
          {showMedicaoForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleMedicaoSubmit} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 text-sm font-display font-bold text-slate-800 border-b border-slate-50 pb-2">
                  <Ruler className={`w-5 h-5 ${colorTheme.accentText}`} />
                  <span>Registrar Nova Medição Corporal</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data da Medição</label>
                    <input
                      type="date"
                      required
                      value={dataMedicao}
                      onChange={e => setDataMedicao(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Peso (kg) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Ex: 72.50"
                      value={peso}
                      onChange={e => setPeso(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-slate-400 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Peito (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={peito}
                      onChange={e => setPeito(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Braço Dir. (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={bracoDireito}
                      onChange={e => setBracoDireito(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Braço Esq. (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={bracoEsquerdo}
                      onChange={e => setBracoEsquerdo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cintura (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={cintura}
                      onChange={e => setCintura(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Barriga (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={barriga}
                      onChange={e => setBarriga(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quadril (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={quadril}
                      onChange={e => setQuadril(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Perna Dir. (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={pernaDireita}
                      onChange={e => setPernaDireita(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Perna Esq. (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Opcional"
                      value={pernaEsquerda}
                      onChange={e => setPernaEsquerda(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Observações / Sentimento</label>
                    <input
                      type="text"
                      placeholder="Ex: Sentindo menos inchado(a)..."
                      value={observacao}
                      onChange={e => setObservacao(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-display font-bold text-sm text-white bg-gradient-to-tr ${colorTheme.primary} shadow-md flex items-center justify-center gap-1.5`}
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? 'Salvando...' : 'Salvar Medição'}</span>
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Progress Photo Gallery & Carousel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-400" />
              Galeria de Progresso
            </span>
            <span className="text-[10px] font-bold text-slate-400">({fotos.length} fotos)</span>
          </div>

          {loadingFotos ? (
            <div className="py-12 flex justify-center">
              <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${colorTheme.accentText}`} />
            </div>
          ) : hasPhotos ? (
            <div className="space-y-4">
              {/* First vs Latest side-by-side comparative */}
              {fotos.length >= 2 && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Antes &amp; Depois Oficial (Primeira x Mais Recente)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl overflow-hidden relative aspect-[3/4] border border-slate-200 shadow-sm bg-white">
                      <img
                        src={firstPhoto?.foto_url}
                        alt="Ponto de partida"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-slate-950/70 backdrop-blur-sm p-1 rounded-lg text-white text-[9px] font-bold text-center">
                        Antes: {formatBrazilianDate(firstPhoto?.data || '')}
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden relative aspect-[3/4] border border-slate-200 shadow-sm bg-white">
                      <img
                        src={latestPhoto?.foto_url}
                        alt="Mais recente"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-slate-950/70 backdrop-blur-sm p-1 rounded-lg text-white text-[9px] font-bold text-center">
                        Agora: {formatBrazilianDate(latestPhoto?.data || '')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Horizontal Carousel */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timeline do Progresso</span>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {fotos.map(foto => (
                    <div key={foto.id} className="w-24 flex-shrink-0 space-y-1 text-center">
                      <div className="h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative shadow-sm">
                        <img
                          src={foto.foto_url}
                          alt={foto.legenda || 'Progresso'}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 right-1 bg-black/60 text-white text-[8px] px-1 rounded font-mono font-bold">
                          {formatDateLabel(foto.data)}
                        </div>
                      </div>
                      {foto.legenda && (
                        <p className="text-[9px] text-slate-400 truncate font-semibold px-1">{foto.legenda}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Camera className="w-8 h-8 text-slate-300 stroke-[1.5]" />
              <p className="font-bold text-xs">Nenhuma foto de progresso ainda</p>
              <p className="text-[10px] text-slate-400 px-6 leading-relaxed">Envie fotos regulares usando o botão "+ Foto" acima para acompanhar sua mudança corporal visualmente!</p>
            </div>
          )}
        </div>

        {/* 4. Evolution Weight and metrics chart */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-slate-400" />
              Evolução Gráfica
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Peso Atual</span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className="text-xl font-display font-black text-slate-900">{stats.actual.split(' ')[0]}</span>
                  <span className="text-[10px] font-bold text-slate-400">kg</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Redução de Peso</span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className={`text-xl font-display font-black ${stats.loss.startsWith('-') ? 'text-emerald-500' : 'text-slate-900'}`}>
                    {stats.loss.split(' ')[0]}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Selector dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Métrica de Gráfico</label>
            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
              className="w-full bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
            >
              {metricsOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="w-full h-44 text-[10px] font-bold">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="data" stroke="#94a3b8" />
                  <YAxis type="number" domain={['dataMin - 1', 'dataMax + 1']} stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', fontFamily: 'Inter' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="valor"
                    name={metricsOptions.find(o => o.key === selectedMetric)?.label || 'Valor'}
                    stroke={colorTheme.chartColor}
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-1">
                <Scale className="w-7 h-7 text-slate-300 stroke-[1.5]" />
                <p className="font-bold text-xs">Sem dados suficientes</p>
                <p className="text-[9px] max-w-[200px]">Adicione medições corporais para visualizar o gráfico de progresso desta métrica!</p>
              </div>
            )}
          </div>
        </div>

        {/* 5. Chronological detailed measurements cards */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Ruler className="w-4 h-4 text-slate-400" />
            Histórico de Medições ({medidas.length})
          </span>

          {medidas.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-2">
              <Ruler className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Nenhuma medição cadastrada.</p>
              <p className="text-[10px] text-slate-400">Cadastre a sua primeira medição corporal para servir como ponto de partida!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...medidas].reverse().map((medida, idx) => {
                const isPontoPartida = idx === medidas.length - 1; // Chronological first item is last in reversed array
                return (
                  <div
                    key={medida.id}
                    className={`bg-white p-5 rounded-3xl border shadow-sm relative overflow-hidden transition-all hover:border-slate-200 ${
                      isPontoPartida ? 'ring-2 ring-amber-400/30 border-amber-300/60' : 'border-slate-100'
                    }`}
                  >
                    {/* Corner badge for point of departure */}
                    {isPontoPartida && (
                      <div className="absolute top-0 right-0 bg-amber-400 text-slate-900 text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                        Ponto de partida 🌟
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-extrabold text-slate-800">
                        {formatBrazilianDate(medida.data)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center border-t border-slate-50 pt-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Peso</span>
                        <p className="text-xs font-extrabold text-slate-800">{medida.peso} kg</p>
                      </div>

                      {medida.peito !== null && medida.peito !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Peito</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.peito} cm</p>
                        </div>
                      )}

                      {medida.cintura !== null && medida.cintura !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Cintura</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.cintura} cm</p>
                        </div>
                      )}

                      {medida.barriga !== null && medida.barriga !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Barriga</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.barriga} cm</p>
                        </div>
                      )}

                      {medida.quadril !== null && medida.quadril !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Quadril</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.quadril} cm</p>
                        </div>
                      )}

                      {medida.braco_direito !== null && medida.braco_direito !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Br. Direito</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.braco_direito} cm</p>
                        </div>
                      )}

                      {medida.braco_esquerdo !== null && medida.braco_esquerdo !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Br. Esquerdo</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.braco_esquerdo} cm</p>
                        </div>
                      )}

                      {medida.perna_direita !== null && medida.perna_direita !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pn. Direita</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.perna_direita} cm</p>
                        </div>
                      )}

                      {medida.perna_esquerda !== null && medida.perna_esquerda !== undefined && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Pn. Esquerda</span>
                          <p className="text-xs font-extrabold text-slate-800">{medida.perna_esquerda} cm</p>
                        </div>
                      )}
                    </div>

                    {medida.observacao && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 text-[10px] text-slate-500 font-medium mt-3 whitespace-pre-line leading-relaxed">
                        <strong>Obs:</strong> {medida.observacao}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
