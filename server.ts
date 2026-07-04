import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db, hashPin } from './src/db.js';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'desafio90-super-secret-key-2026';

// Allow parsing of large base64 payloads for progress photos
app.use(express.json({ limit: '20mb' }));

// Utility for date string YYYY-MM-DD
function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Authentication Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Sessão encerrada ou token não fornecido' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão expirada' });
    }
    req.user = user;
    next();
  });
}

// Admin Middleware
function requireAdmin(req: any, res: any, next: any) {
  if (req.user && req.user.papel === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
}

// Streak Calculator
function calculateStreak(checks: any[]): number {
  if (!checks || checks.length === 0) return 0;

  // Filter checks with at least one completed habit and sort by date descending
  const activeCheckDates = new Set(
    checks
      .filter(c => c.treino || c.zero_doce || c.zero_besteira || c.agua || c.sono)
      .map(c => c.data)
  );

  if (activeCheckDates.size === 0) return 0;

  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  // Streak continues if logged today or yesterday
  let currentStr = todayStr;
  if (!activeCheckDates.has(todayStr)) {
    if (activeCheckDates.has(yesterdayStr)) {
      currentStr = yesterdayStr;
    } else {
      return 0; // Streak broken
    }
  }

  let streak = 0;
  const tempDate = new Date(currentStr);

  while (true) {
    const checkStr = getLocalDateString(tempDate);
    if (activeCheckDates.has(checkStr)) {
      streak++;
      tempDate.setDate(tempDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// API Routes

// Public endpoint to list profiles for selection on the login page
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await db.getTodosUsuarios();
    // Return safe data only
    const safeUsers = users.map(u => ({
      id: u.id,
      nome: u.nome,
      papel: u.papel,
      cor_identidade: u.cor_identidade
    }));
    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { nome, pin } = req.body;
  if (!nome || !pin) {
    return res.status(400).json({ error: 'Nome e PIN são obrigatórios' });
  }

  try {
    const user = await db.getUsuarioByNome(nome);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    if (user.pin_hash !== hashPin(pin)) {
      return res.status(401).json({ error: 'PIN incorreto!' });
    }

    const token = jwt.sign(
      { id: user.id, nome: user.nome, papel: user.papel, cor_identidade: user.cor_identidade },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        nome: user.nome,
        papel: user.papel,
        cor_identidade: user.cor_identidade
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor durante login' });
  }
});

// Get Current User Profile from Token
app.get('/api/usuario/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await db.getUsuarioById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({
      id: user.id,
      nome: user.nome,
      papel: user.papel,
      cor_identidade: user.cor_identidade
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao validar sessão' });
  }
});

// Participant endpoints (Guarded by user ID privacy)

// Get self daily checks
app.get('/api/checks', authenticateToken, async (req: any, res) => {
  try {
    const checks = await db.getChecksDiarios(req.user.id);
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar hábitos' });
  }
});

// Save/Check a daily habit
app.post('/api/checks', authenticateToken, async (req: any, res) => {
  const { data, treino, zero_doce, zero_besteira, agua, sono } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Data é obrigatória' });
  }

  try {
    const saved = await db.saveCheckDiario(req.user.id, data, {
      treino: !!treino,
      zero_doce: !!zero_doce,
      zero_besteira: !!zero_besteira,
      agua: !!agua,
      sono: !!sono
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar hábito' });
  }
});

// Get self measures and progress photos
app.get('/api/medidas', authenticateToken, async (req: any, res) => {
  try {
    const measures = await db.getMedidas(req.user.id);
    res.json(measures);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar medidas' });
  }
});

// Add a measure/weight record
app.post('/api/medidas', authenticateToken, async (req: any, res) => {
  const { data, peso, braco_direito, braco_esquerdo, perna_direita, perna_esquerda, barriga, cintura, quadril, peito, observacao, braço, foto_url } = req.body;
  if (!data || peso === undefined) {
    return res.status(400).json({ error: 'Data e peso são obrigatórios' });
  }

  try {
    const saved = await db.addMedida(req.user.id, {
      data,
      peso: parseFloat(peso),
      braco_direito: braco_direito ? parseFloat(braco_direito) : undefined,
      braco_esquerdo: braco_esquerdo ? parseFloat(braco_esquerdo) : undefined,
      perna_direita: perna_direita ? parseFloat(perna_direita) : undefined,
      perna_esquerda: perna_esquerda ? parseFloat(perna_esquerda) : undefined,
      barriga: barriga ? parseFloat(barriga) : undefined,
      cintura: cintura ? parseFloat(cintura) : undefined,
      quadril: quadril ? parseFloat(quadril) : undefined,
      peito: peito ? parseFloat(peito) : undefined,
      observacao,
      braço: braço ? parseFloat(braço) : undefined,
      foto_url
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar medidas' });
  }
});

// --- NEW DIET ENDPOINTS ---

// Get self diet items
app.get('/api/dieta/itens', authenticateToken, async (req: any, res) => {
  try {
    const items = await db.getItensDieta(req.user.id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar itens da dieta' });
  }
});

// Add or edit self diet item
app.post('/api/dieta/itens', authenticateToken, async (req: any, res) => {
  const { id, nome_refeicao, descricao, ordem } = req.body;
  if (!nome_refeicao || ordem === undefined) {
    return res.status(400).json({ error: 'Nome da refeição e ordem são obrigatórios' });
  }

  try {
    const saved = await db.saveItemDieta(
      req.user.id,
      id ? parseInt(id) : undefined,
      nome_refeicao,
      descricao,
      parseInt(ordem)
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar item da dieta' });
  }
});

// Delete self diet item
app.delete('/api/dieta/itens/:id', authenticateToken, async (req: any, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    await db.deleteItemDieta(req.user.id, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir refeição' });
  }
});

// Get self diet checklist for a date
app.get('/api/dieta/checks', authenticateToken, async (req: any, res) => {
  const { data } = req.query;
  if (!data) {
    return res.status(400).json({ error: 'Data é obrigatória' });
  }

  try {
    const checks = await db.getChecksDieta(req.user.id, data as string);
    res.json(checks);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar checks da dieta' });
  }
});

// Save self diet checks for a date
app.post('/api/dieta/checks', authenticateToken, async (req: any, res) => {
  const { data, checks } = req.body; // checks: [{ item_dieta_id: number, cumprido: boolean }]
  if (!data || !Array.isArray(checks)) {
    return res.status(400).json({ error: 'Data e checks (array) são obrigatórios' });
  }

  try {
    const saved = await db.saveChecksDieta(req.user.id, data, checks);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar checklist da dieta' });
  }
});

// --- NEW PROGRESS PHOTOS ENDPOINTS ---

// Get self progress photos
app.get('/api/fotos-progresso', authenticateToken, async (req: any, res) => {
  try {
    const photos = await db.getFotosProgresso(req.user.id);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar fotos de progresso' });
  }
});

// Add self progress photo
app.post('/api/fotos-progresso', authenticateToken, async (req: any, res) => {
  const { data, foto_url, legenda } = req.body;
  if (!data || !foto_url) {
    return res.status(400).json({ error: 'Data e foto_url são obrigatórios' });
  }

  try {
    const saved = await db.addFotoProgresso(req.user.id, data, foto_url, legenda);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar foto de progresso' });
  }
});

// Admin Comparative Dashboard (Restricted to 'admin' role)
app.get('/api/admin/comparativo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.getTodosUsuarios();
    const participants = users.filter(u => u.papel === 'participante');

    const comparativos = [];

    // Let's compute challenge details across participants
    for (const p of participants) {
      const checks = await db.getChecksDiarios(p.id);
      const dietChecks = await db.getTodosChecksDieta(p.id);
      const measures = await db.getMedidas(p.id);
      const photos = await db.getFotosProgresso(p.id);

      // Total points: 1 point per check-in habit + 1 point per completed meal in diet
      let totalPontos = 0;
      let totalDiasComPeloMenosUmCheck = 0;

      // Group diet checks by date
      const dietChecksByDate = new Map<string, number>();
      dietChecks.forEach(dc => {
        if (dc.cumprido) {
          dietChecksByDate.set(dc.data, (dietChecksByDate.get(dc.data) || 0) + 1);
        }
      });

      const allActiveDates = new Set<string>();
      checks.forEach(c => allActiveDates.add(c.data));
      dietChecksByDate.forEach((_, date) => allActiveDates.add(date));

      allActiveDates.forEach(date => {
        let dayPoints = 0;
        const c = checks.find(x => x.data === date);
        if (c) {
          if (c.treino) dayPoints++;
          if (c.zero_doce) dayPoints++;
          if (c.zero_besteira) dayPoints++;
          if (c.agua) dayPoints++;
          if (c.sono) dayPoints++;
        }

        const dietPoints = dietChecksByDate.get(date) || 0;
        dayPoints += dietPoints;

        totalPontos += dayPoints;
        if (dayPoints > 0) {
          totalDiasComPeloMenosUmCheck++;
        }
      });

      // Days fulfilled percent: out of 90 days
      const diasCumpridosPercent = Math.min(Math.round((totalDiasComPeloMenosUmCheck / 90) * 100), 100);

      // Streak
      const streakAtual = calculateStreak(checks);

      // Detailed weight & body part losses
      let perdaPesoTotal = 0;
      let bracoDireitoPerda = 0;
      let bracoEsquerdoPerda = 0;
      let pernaDireitaPerda = 0;
      let pernaEsquerdaPerda = 0;
      let barrigaPerda = 0;
      let cinturaPerda = 0;
      let quadrilPerda = 0;
      let peitoPerda = 0;
      let braçoPerda = 0; // fallback

      if (measures.length >= 2) {
        const first = measures[0];
        const latest = measures[measures.length - 1];
        perdaPesoTotal = first.peso - latest.peso;
        bracoDireitoPerda = (first.braco_direito && latest.braco_direito) ? (first.braco_direito - latest.braco_direito) : 0;
        bracoEsquerdoPerda = (first.braco_esquerdo && latest.braco_esquerdo) ? (first.braco_esquerdo - latest.braco_esquerdo) : 0;
        pernaDireitaPerda = (first.perna_direita && latest.perna_direita) ? (first.perna_direita - latest.perna_direita) : 0;
        pernaEsquerdaPerda = (first.perna_esquerda && latest.perna_esquerda) ? (first.perna_esquerda - latest.perna_esquerda) : 0;
        barrigaPerda = (first.barriga && latest.barriga) ? (first.barriga - latest.barriga) : 0;
        cinturaPerda = (first.cintura && latest.cintura) ? (first.cintura - latest.cintura) : 0;
        quadrilPerda = (first.quadril && latest.quadril) ? (first.quadril - latest.quadril) : 0;
        peitoPerda = (first.peito && latest.peito) ? (first.peito - latest.peito) : 0;
        braçoPerda = (first.braço && latest.braço) ? (first.braço - latest.braço) : 0;
      } else if (measures.length === 1) {
        perdaPesoTotal = 0;
      }

      comparativos.push({
        usuario: {
          id: p.id,
          nome: p.nome,
          papel: p.papel,
          cor_identidade: p.cor_identidade
        },
        diasCumpridosPercent,
        totalPontos,
        streakAtual,
        perdaPesoTotal: parseFloat(perdaPesoTotal.toFixed(2)),
        medidasEvolucao: {
          cinturaPerda: parseFloat(cinturaPerda.toFixed(2)),
          quadrilPerda: parseFloat(quadrilPerda.toFixed(2)),
          braçoPerda: parseFloat(braçoPerda.toFixed(2)),
          bracoDireitoPerda: parseFloat(bracoDireitoPerda.toFixed(2)),
          bracoEsquerdoPerda: parseFloat(bracoEsquerdoPerda.toFixed(2)),
          pernaDireitaPerda: parseFloat(pernaDireitaPerda.toFixed(2)),
          pernaEsquerdaPerda: parseFloat(pernaEsquerdaPerda.toFixed(2)),
          barrigaPerda: parseFloat(barrigaPerda.toFixed(2)),
          peitoPerda: parseFloat(peitoPerda.toFixed(2))
        },
        pesosEvolucao: measures.map(m => ({ data: m.data, peso: m.peso })),
        historicoCompleto: checks,
        medidasCompleto: measures,
        fotosProgresso: photos
      });
    }

    res.json(comparativos);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao compilar comparativo do administrador' });
  }
});

// Setup development & production asset serving
async function startServer() {
  // Initialize Database schemas and seed data
  await db.initialize();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Desafio 90] Server running on http://localhost:${PORT}`);
  });
}

startServer();
