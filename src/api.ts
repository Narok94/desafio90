import { Usuario, CheckDiario, Medida, ComparativoData } from './types';

const API_BASE = '/api';

// Simple token storage helpers
export function getSavedToken(): string | null {
  return localStorage.getItem('d90_token');
}

export function saveToken(token: string) {
  localStorage.setItem('d90_token', token);
}

export function getSavedUsuario(): Usuario | null {
  const data = localStorage.getItem('d90_user');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveUsuario(user: Usuario) {
  localStorage.setItem('d90_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('d90_token');
  localStorage.removeItem('d90_user');
}

// Request Helper
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getSavedToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  } as any;

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Clear expired session and reload
      clearSession();
      window.dispatchEvent(new Event('auth-expired'));
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro de rede: Código ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Public users list
  getUsers: () => request<Usuario[]>('/auth/users'),

  // Login
  login: (nome: string, pin: string) =>
    request<{ token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nome, pin }),
    }),

  // Validate Token / Fetch current user profile
  getMe: () => request<Usuario>('/usuario/me'),

  // Participant: Daily Checks
  getChecks: () => request<CheckDiario[]>('/checks'),
  saveCheck: (data: string, checks: { treino: boolean; zero_doce: boolean; zero_besteira: boolean; agua: boolean; sono: boolean }) =>
    request<CheckDiario>('/checks', {
      method: 'POST',
      body: JSON.stringify({ data, ...checks }),
    }),

  // Participant: Measures
  getMedidas: () => request<Medida[]>('/medidas'),
  addMedida: (data: {
    data: string;
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
    braço?: number;
    foto_url?: string;
  }) =>
    request<Medida>('/medidas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Participant: Dieta Itens
  getItensDieta: () => request<any[]>('/dieta/itens'),
  saveItemDieta: (item: { id?: number; nome_refeicao: string; descricao?: string; ordem: number }) =>
    request<any>('/dieta/itens', {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  deleteItemDieta: (id: number) =>
    request<{ success: boolean }>(`/dieta/itens/${id}`, {
      method: 'DELETE',
    }),

  // Participant: Dieta Checks
  getChecksDieta: (data: string) => request<any[]>(`/dieta/checks?data=${data}`),
  saveChecksDieta: (data: string, checks: { item_dieta_id: number; cumprido: boolean }[]) =>
    request<any[]>('/dieta/checks', {
      method: 'POST',
      body: JSON.stringify({ data, checks }),
    }),

  // Participant: Progress Photos
  getFotosProgresso: () => request<any[]>('/fotos-progresso'),
  addFotoProgresso: (foto: { data: string; foto_url: string; legenda?: string }) =>
    request<any>('/fotos-progresso', {
      method: 'POST',
      body: JSON.stringify(foto),
    }),

  // Admin: Comparative Data
  getComparativo: () => request<ComparativoData[]>('/admin/comparativo'),
};
