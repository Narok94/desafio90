export type PapelUsuario = 'participante' | 'admin';

export interface Usuario {
  id: number;
  nome: string;
  papel: PapelUsuario;
  cor_identidade: string; // e.g., 'coral' (Jéssica) or 'green' (Henrique)
}

export interface CheckDiario {
  id: number;
  usuario_id: number;
  data: string; // YYYY-MM-DD
  treino: boolean;
  zero_doce: boolean;
  zero_besteira: boolean;
  agua: boolean;
  sono: boolean;
}

export interface ItemDieta {
  id: number;
  usuario_id: number;
  nome_refeicao: string;
  descricao?: string;
  ordem: number;
}

export interface CheckDieta {
  id: number;
  usuario_id: number;
  item_dieta_id: number;
  data: string; // YYYY-MM-DD
  cumprido: boolean;
}

export interface FotoProgresso {
  id: number;
  usuario_id: number;
  data: string; // YYYY-MM-DD
  foto_url: string;
  legenda?: string;
}

export interface Medida {
  id: number;
  usuario_id: number;
  data: string; // YYYY-MM-DD
  peso: number;
  braco_direito?: number;
  braco_esquerdo?: number;
  perna_direita?: number;
  perna_esquerda?: number;
  barriga?: number;
  cintura?: number;
  quadril?: number;
  peito?: number;
  observacao?: string;
  // Kept for legacy fallback if any:
  braço?: number;
  foto_url?: string;
}

export interface AuthSession {
  token: string;
  usuario: Usuario;
}

export interface StreakInfo {
  streak: number;
  totalDiasCumpridos: number;
  totalDiasRestantes: number;
  totalHabilitados: number; // number of habits done
}

export interface ComparativoData {
  usuario: Usuario;
  diasCumpridosPercent: number; // % of days with at least 1 habit completed, or perfect days?
  totalPontos: number; // 1 point per completed habit or meal in any day
  streakAtual: number;
  perdaPesoTotal: number; // difference between first weight and latest weight
  medidasEvolucao: {
    cinturaPerda: number;
    quadrilPerda: number;
    braçoPerda: number;
    // New body parts comparisons
    bracoDireitoPerda: number;
    bracoEsquerdoPerda: number;
    pernaDireitaPerda: number;
    pernaEsquerdaPerda: number;
    barrigaPerda: number;
    peitoPerda: number;
  };
  pesosEvolucao: { data: string; peso: number }[];
  historicoCompleto: CheckDiario[];
  dietasEvolucao?: ItemDieta[];
  checksDietaEvolucao?: CheckDieta[];
  medidasCompleto?: Medida[];
  fotosProgresso?: FotoProgresso[];
}

