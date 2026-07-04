import { Pool } from 'pg';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

const DATABASE_URL = process.env.DATABASE_URL;

// Simple file-based fallback JSON store for local testing when DATABASE_URL is not set
const JSON_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Interface for database operations
export interface DB {
  initialize(): Promise<void>;
  getUsuarioByNome(nome: string): Promise<any>;
  getUsuarioById(id: number): Promise<any>;
  getTodosUsuarios(): Promise<any[]>;
  getCheckDiario(usuarioId: number, data: string): Promise<any>;
  saveCheckDiario(usuarioId: number, data: string, checks: { treino: boolean; zero_doce: boolean; zero_besteira: boolean; agua: boolean; sono: boolean }): Promise<any>;
  getChecksDiarios(usuarioId: number): Promise<any[]>;
  getTodosChecksDiarios(): Promise<any[]>;
  
  getMedidas(usuarioId: number): Promise<any[]>;
  addMedida(usuarioId: number, dataOrObj: any, peso?: number, cintura?: number, quadril?: number, braço?: number, foto_url?: string): Promise<any>;
  getTodasMedidas(): Promise<any[]>;

  // Diet
  getItensDieta(usuarioId: number): Promise<any[]>;
  saveItemDieta(usuarioId: number, id: number | undefined, nomeRefeicao: string, descricao: string | undefined, ordem: number): Promise<any>;
  deleteItemDieta(usuarioId: number, id: number): Promise<void>;
  getChecksDieta(usuarioId: number, data: string): Promise<any[]>;
  saveChecksDieta(usuarioId: number, data: string, checks: { item_dieta_id: number; cumprido: boolean }[]): Promise<any[]>;
  getTodosChecksDieta(usuarioId: number): Promise<any[]>;

  // Photos
  getFotosProgresso(usuarioId: number): Promise<any[]>;
  addFotoProgresso(usuarioId: number, data: string, fotoUrl: string, legenda?: string): Promise<any>;
  getTodasFotosProgresso(): Promise<any[]>;
}

// Ensure local data directory exists for JSON fallback
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Initial seed data
const DEFAULT_USERS = [
  { id: 1, nome: 'Jéssica', pin_hash: hashPin('9860'), papel: 'participante', cor_identidade: 'coral' },
  { id: 2, nome: 'Henrique', pin_hash: hashPin('4902'), papel: 'participante', cor_identidade: 'green' },
  { id: 3, nome: 'Tatu', pin_hash: hashPin('98602100'), papel: 'admin', cor_identidade: 'indigo' }
];

class PostgresDB implements DB {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Neon and hosted PostgreSQL
      }
    });
  }

  async initialize(): Promise<void> {
    console.log('Initializing Postgres Database...');
    const client = await this.pool.connect();
    try {
      // 1. Create tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(50) UNIQUE NOT NULL,
          pin_hash VARCHAR(100) NOT NULL,
          papel VARCHAR(20) NOT NULL,
          cor_identidade VARCHAR(20) NOT NULL
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS checks_diarios (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          data VARCHAR(10) NOT NULL,
          treino BOOLEAN DEFAULT FALSE,
          zero_doce BOOLEAN DEFAULT FALSE,
          zero_besteira BOOLEAN DEFAULT FALSE,
          agua BOOLEAN DEFAULT FALSE,
          sono BOOLEAN DEFAULT FALSE,
          CONSTRAINT unique_usuario_data UNIQUE (usuario_id, data)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS medidas (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          data VARCHAR(10) NOT NULL,
          peso NUMERIC(5,2) NOT NULL,
          cintura NUMERIC(5,2),
          quadril NUMERIC(5,2),
          braço NUMERIC(5,2),
          foto_url TEXT
        );
      `);

      // Add detailed columns safely
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS braco_direito NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS braco_esquerdo NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS perna_direita NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS perna_esquerda NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS barriga NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS peito NUMERIC(5,2);`);
      await client.query(`ALTER TABLE medidas ADD COLUMN IF NOT EXISTS observacao TEXT;`);

      // Create fotos_progresso table
      await client.query(`
        CREATE TABLE IF NOT EXISTS fotos_progresso (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          data VARCHAR(10) NOT NULL,
          foto_url TEXT NOT NULL,
          legenda TEXT
        );
      `);

      // Create itens_dieta table
      await client.query(`
        CREATE TABLE IF NOT EXISTS itens_dieta (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          nome_refeicao VARCHAR(100) NOT NULL,
          descricao TEXT,
          ordem INTEGER NOT NULL
        );
      `);

      // Create checks_dieta table
      await client.query(`
        CREATE TABLE IF NOT EXISTS checks_dieta (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          item_dieta_id INTEGER REFERENCES itens_dieta(id) ON DELETE CASCADE,
          data VARCHAR(10) NOT NULL,
          cumprido BOOLEAN DEFAULT FALSE,
          CONSTRAINT unique_item_dieta_data UNIQUE (item_dieta_id, data)
        );
      `);

      // 2. Insert default users if table is empty
      const { rows } = await client.query('SELECT COUNT(*) FROM usuarios');
      if (parseInt(rows[0].count) === 0) {
        console.log('Seeding default users to Postgres...');
        for (const user of DEFAULT_USERS) {
          await client.query(
            'INSERT INTO usuarios (id, nome, pin_hash, papel, cor_identidade) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (nome) DO NOTHING',
            [user.id, user.nome, user.pin_hash, user.papel, user.cor_identidade]
          );
        }
        // Sync serial sequence
        await client.query("SELECT setval('usuarios_id_seq', (SELECT MAX(id) FROM usuarios))");
      }
    } catch (err) {
      console.error('Error initializing Postgres DB:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  async getUsuarioByNome(nome: string): Promise<any> {
    const { rows } = await this.pool.query('SELECT * FROM usuarios WHERE LOWER(nome) = LOWER($1)', [nome]);
    return rows[0] || null;
  }

  async getUsuarioById(id: number): Promise<any> {
    const { rows } = await this.pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async getTodosUsuarios(): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT * FROM usuarios ORDER BY id ASC');
    return rows;
  }

  async getCheckDiario(usuarioId: number, data: string): Promise<any> {
    const { rows } = await this.pool.query('SELECT * FROM checks_diarios WHERE usuario_id = $1 AND data = $2', [usuarioId, data]);
    return rows[0] || null;
  }

  async saveCheckDiario(usuarioId: number, data: string, checks: { treino: boolean; zero_doce: boolean; zero_besteira: boolean; agua: boolean; sono: boolean }): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO checks_diarios (usuario_id, data, treino, zero_doce, zero_besteira, agua, sono)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (usuario_id, data)
       DO UPDATE SET treino = EXCLUDED.treino, zero_doce = EXCLUDED.zero_doce, zero_besteira = EXCLUDED.zero_besteira, agua = EXCLUDED.agua, sono = EXCLUDED.sono
       RETURNING *`,
      [usuarioId, data, checks.treino, checks.zero_doce, checks.zero_besteira, checks.agua, checks.sono]
    );
    return rows[0];
  }

  async getChecksDiarios(usuarioId: number): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT * FROM checks_diarios WHERE usuario_id = $1 ORDER BY data ASC', [usuarioId]);
    return rows;
  }

  async getTodosChecksDiarios(): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT * FROM checks_diarios ORDER BY data ASC');
    return rows;
  }

  private mapMedidaRow(r: any) {
    if (!r) return null;
    return {
      ...r,
      peso: parseFloat(r.peso),
      braco_direito: r.braco_direito ? parseFloat(r.braco_direito) : null,
      braco_esquerdo: r.braco_esquerdo ? parseFloat(r.braco_esquerdo) : null,
      perna_direita: r.perna_direita ? parseFloat(r.perna_direita) : null,
      perna_esquerda: r.perna_esquerda ? parseFloat(r.perna_esquerda) : null,
      barriga: r.barriga ? parseFloat(r.barriga) : null,
      cintura: r.cintura ? parseFloat(r.cintura) : null,
      quadril: r.quadril ? parseFloat(r.quadril) : null,
      peito: r.peito ? parseFloat(r.peito) : null,
      braço: r.braço ? parseFloat(r.braço) : null
    };
  }

  async getMedidas(usuarioId: number): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT * FROM medidas WHERE usuario_id = $1 ORDER BY data ASC', [usuarioId]);
    return rows.map(r => this.mapMedidaRow(r));
  }

  async addMedida(usuarioId: number, dataOrObj: any, peso?: number, cintura?: number, quadril?: number, braço?: number, foto_url?: string): Promise<any> {
    let dataStr: string;
    let pesoVal: number;
    let braco_direito: number | null = null;
    let braco_esquerdo: number | null = null;
    let perna_direita: number | null = null;
    let perna_esquerda: number | null = null;
    let barriga: number | null = null;
    let cinturaVal: number | null = null;
    let quadrilVal: number | null = null;
    let peito: number | null = null;
    let observacao: string | null = null;
    let bracoLegacy: number | null = null;
    let fotoUrlLegacy: string | null = null;

    if (typeof dataOrObj === 'object' && dataOrObj !== null) {
      const m = dataOrObj;
      dataStr = m.data;
      pesoVal = m.peso;
      braco_direito = m.braco_direito ?? null;
      braco_esquerdo = m.braco_esquerdo ?? null;
      perna_direita = m.perna_direita ?? null;
      perna_esquerda = m.perna_esquerda ?? null;
      barriga = m.barriga ?? null;
      cinturaVal = m.cintura ?? null;
      quadrilVal = m.quadril ?? null;
      peito = m.peito ?? null;
      observacao = m.observacao ?? null;
      bracoLegacy = m.braço ?? null;
      fotoUrlLegacy = m.foto_url ?? null;
    } else {
      dataStr = dataOrObj;
      pesoVal = peso!;
      cinturaVal = cintura ?? null;
      quadrilVal = quadril ?? null;
      bracoLegacy = braço ?? null;
      fotoUrlLegacy = foto_url ?? null;
    }

    const { rows } = await this.pool.query(
      `INSERT INTO medidas (
        usuario_id, data, peso, braco_direito, braco_esquerdo, perna_direita, perna_esquerda, barriga, cintura, quadril, peito, observacao, braço, foto_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        usuarioId,
        dataStr,
        pesoVal,
        braco_direito,
        braco_esquerdo,
        perna_direita,
        perna_esquerda,
        barriga,
        cinturaVal,
        quadrilVal,
        peito,
        observacao,
        bracoLegacy,
        fotoUrlLegacy
      ]
    );
    return this.mapMedidaRow(rows[0]);
  }

  async getTodasMedidas(): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT * FROM medidas ORDER BY data ASC');
    return rows.map(r => this.mapMedidaRow(r));
  }

  // Diet Methods
  async getItensDieta(usuarioId: number): Promise<any[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM itens_dieta WHERE usuario_id = $1 ORDER BY ordem ASC, id ASC',
      [usuarioId]
    );
    return rows;
  }

  async saveItemDieta(usuarioId: number, id: number | undefined, nomeRefeicao: string, descricao: string | undefined, ordem: number): Promise<any> {
    if (id) {
      const { rows } = await this.pool.query(
        `UPDATE itens_dieta 
         SET nome_refeicao = $1, descricao = $2, ordem = $3 
         WHERE id = $4 AND usuario_id = $5 
         RETURNING *`,
        [nomeRefeicao, descricao || null, ordem, id, usuarioId]
      );
      return rows[0];
    } else {
      const { rows } = await this.pool.query(
        `INSERT INTO itens_dieta (usuario_id, nome_refeicao, descricao, ordem) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [usuarioId, nomeRefeicao, descricao || null, ordem]
      );
      return rows[0];
    }
  }

  async deleteItemDieta(usuarioId: number, id: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM itens_dieta WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId]
    );
  }

  async getChecksDieta(usuarioId: number, data: string): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT cd.* FROM checks_dieta cd
       JOIN itens_dieta id ON cd.item_dieta_id = id.id
       WHERE cd.usuario_id = $1 AND cd.data = $2`,
      [usuarioId, data]
    );
    return rows;
  }

  async saveChecksDieta(usuarioId: number, data: string, checks: { item_dieta_id: number; cumprido: boolean }[]): Promise<any[]> {
    const savedChecks = [];
    for (const check of checks) {
      // Validate ownership of item
      const itemCheck = await this.pool.query(
        'SELECT 1 FROM itens_dieta WHERE id = $1 AND usuario_id = $2',
        [check.item_dieta_id, usuarioId]
      );
      if (itemCheck.rows.length === 0) {
        continue;
      }

      const { rows } = await this.pool.query(
        `INSERT INTO checks_dieta (usuario_id, item_dieta_id, data, cumprido)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (item_dieta_id, data)
         DO UPDATE SET cumprido = EXCLUDED.cumprido
         RETURNING *`,
        [usuarioId, check.item_dieta_id, data, check.cumprido]
      );
      savedChecks.push(rows[0]);
    }
    return savedChecks;
  }

  async getTodosChecksDieta(usuarioId: number): Promise<any[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM checks_dieta WHERE usuario_id = $1 ORDER BY data ASC',
      [usuarioId]
    );
    return rows;
  }

  // Photos Methods
  async getFotosProgresso(usuarioId: number): Promise<any[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM fotos_progresso WHERE usuario_id = $1 ORDER BY data ASC, id ASC',
      [usuarioId]
    );
    return rows;
  }

  async addFotoProgresso(usuarioId: number, data: string, fotoUrl: string, legenda?: string): Promise<any> {
    const { rows } = await this.pool.query(
      `INSERT INTO fotos_progresso (usuario_id, data, foto_url, legenda)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [usuarioId, data, fotoUrl, legenda || null]
    );
    return rows[0];
  }

  async getTodasFotosProgresso(): Promise<any[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM fotos_progresso ORDER BY data ASC'
    );
    return rows;
  }
}

class JSONDB implements DB {
  private data: {
    usuarios: any[];
    checks_diarios: any[];
    medidas: any[];
    itens_dieta: any[];
    checks_dieta: any[];
    fotos_progresso: any[];
  } = { usuarios: [], checks_diarios: [], medidas: [], itens_dieta: [], checks_dieta: [], fotos_progresso: [] };

  async initialize(): Promise<void> {
    console.log('Initializing Local JSON Database fallback...');
    ensureDirectoryExistence(JSON_DB_PATH);
    if (fs.existsSync(JSON_DB_PATH)) {
      try {
        const fileContent = fs.readFileSync(JSON_DB_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Ensure arrays exist
        if (!this.data.itens_dieta) this.data.itens_dieta = [];
        if (!this.data.checks_dieta) this.data.checks_dieta = [];
        if (!this.data.fotos_progresso) this.data.fotos_progresso = [];
        if (!this.data.medidas) this.data.medidas = [];
      } catch (err) {
        console.error('Error reading JSON DB file, resetting database:', err);
        this.saveToDisk();
      }
    } else {
      this.data = {
        usuarios: [...DEFAULT_USERS],
        checks_diarios: [],
        medidas: [],
        itens_dieta: [],
        checks_dieta: [],
        fotos_progresso: []
      };
      this.saveToDisk();
    }
  }

  private saveToDisk() {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async getUsuarioByNome(nome: string): Promise<any> {
    return this.data.usuarios.find(u => u.nome.toLowerCase() === nome.toLowerCase()) || null;
  }

  async getUsuarioById(id: number): Promise<any> {
    return this.data.usuarios.find(u => u.id === id) || null;
  }

  async getTodosUsuarios(): Promise<any[]> {
    return [...this.data.usuarios];
  }

  async getCheckDiario(usuarioId: number, data: string): Promise<any> {
    return this.data.checks_diarios.find(c => c.usuario_id === usuarioId && c.data === data) || null;
  }

  async saveCheckDiario(usuarioId: number, data: string, checks: { treino: boolean; zero_doce: boolean; zero_besteira: boolean; agua: boolean; sono: boolean }): Promise<any> {
    let index = this.data.checks_diarios.findIndex(c => c.usuario_id === usuarioId && c.data === data);
    const checkItem = {
      id: index !== -1 ? this.data.checks_diarios[index].id : Date.now(),
      usuario_id: usuarioId,
      data,
      ...checks
    };

    if (index !== -1) {
      this.data.checks_diarios[index] = checkItem;
    } else {
      this.data.checks_diarios.push(checkItem);
    }
    this.saveToDisk();
    return checkItem;
  }

  async getChecksDiarios(usuarioId: number): Promise<any[]> {
    return this.data.checks_diarios.filter(c => c.usuario_id === usuarioId).sort((a, b) => a.data.localeCompare(b.data));
  }

  async getTodosChecksDiarios(): Promise<any[]> {
    return [...this.data.checks_diarios].sort((a, b) => a.data.localeCompare(b.data));
  }

  async getMedidas(usuarioId: number): Promise<any[]> {
    return this.data.medidas.filter(m => m.usuario_id === usuarioId).sort((a, b) => a.data.localeCompare(b.data));
  }

  async addMedida(usuarioId: number, dataOrObj: any, peso?: number, cintura?: number, quadril?: number, braço?: number, foto_url?: string): Promise<any> {
    let dataStr: string;
    let pesoVal: number;
    let braco_direito: number | null = null;
    let braco_esquerdo: number | null = null;
    let perna_direita: number | null = null;
    let perna_esquerda: number | null = null;
    let barriga: number | null = null;
    let cinturaVal: number | null = null;
    let quadrilVal: number | null = null;
    let peito: number | null = null;
    let observacao: string | null = null;
    let bracoLegacy: number | null = null;
    let fotoUrlLegacy: string | null = null;

    if (typeof dataOrObj === 'object' && dataOrObj !== null) {
      const m = dataOrObj;
      dataStr = m.data;
      pesoVal = m.peso;
      braco_direito = m.braco_direito ?? null;
      braco_esquerdo = m.braco_esquerdo ?? null;
      perna_direita = m.perna_direita ?? null;
      perna_esquerda = m.perna_esquerda ?? null;
      barriga = m.barriga ?? null;
      cinturaVal = m.cintura ?? null;
      quadrilVal = m.quadril ?? null;
      peito = m.peito ?? null;
      observacao = m.observacao ?? null;
      bracoLegacy = m.braço ?? null;
      fotoUrlLegacy = m.foto_url ?? null;
    } else {
      dataStr = dataOrObj;
      pesoVal = peso!;
      cinturaVal = cintura ?? null;
      quadrilVal = quadril ?? null;
      bracoLegacy = braço ?? null;
      fotoUrlLegacy = foto_url ?? null;
    }

    const medida = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      usuario_id: usuarioId,
      data: dataStr,
      peso: pesoVal,
      braco_direito,
      braco_esquerdo,
      perna_direita,
      perna_esquerda,
      barriga,
      cintura: cinturaVal,
      quadril: quadrilVal,
      peito,
      observacao,
      braço: bracoLegacy,
      foto_url: fotoUrlLegacy
    };

    this.data.medidas.push(medida);
    this.saveToDisk();
    return medida;
  }

  async getTodasMedidas(): Promise<any[]> {
    return [...this.data.medidas].sort((a, b) => a.data.localeCompare(b.data));
  }

  // Diet Methods JSON
  async getItensDieta(usuarioId: number): Promise<any[]> {
    return this.data.itens_dieta
      .filter(i => i.usuario_id === usuarioId)
      .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  }

  async saveItemDieta(usuarioId: number, id: number | undefined, nomeRefeicao: string, descricao: string | undefined, ordem: number): Promise<any> {
    if (id) {
      let index = this.data.itens_dieta.findIndex(i => i.id === id && i.usuario_id === usuarioId);
      if (index !== -1) {
        const updated = {
          ...this.data.itens_dieta[index],
          nome_refeicao: nomeRefeicao,
          descricao: descricao || null,
          ordem
        };
        this.data.itens_dieta[index] = updated;
        this.saveToDisk();
        return updated;
      }
      return null;
    } else {
      const newItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        usuario_id: usuarioId,
        nome_refeicao: nomeRefeicao,
        descricao: descricao || null,
        ordem
      };
      this.data.itens_dieta.push(newItem);
      this.saveToDisk();
      return newItem;
    }
  }

  async deleteItemDieta(usuarioId: number, id: number): Promise<void> {
    this.data.itens_dieta = this.data.itens_dieta.filter(i => !(i.id === id && i.usuario_id === usuarioId));
    this.data.checks_dieta = this.data.checks_dieta.filter(c => c.item_dieta_id !== id);
    this.saveToDisk();
  }

  async getChecksDieta(usuarioId: number, data: string): Promise<any[]> {
    return this.data.checks_dieta.filter(c => c.usuario_id === usuarioId && c.data === data);
  }

  async saveChecksDieta(usuarioId: number, data: string, checks: { item_dieta_id: number; cumprido: boolean }[]): Promise<any[]> {
    const savedChecks = [];
    for (const check of checks) {
      const item = this.data.itens_dieta.find(i => i.id === check.item_dieta_id && i.usuario_id === usuarioId);
      if (!item) continue;

      let index = this.data.checks_dieta.findIndex(c => c.item_dieta_id === check.item_dieta_id && c.data === data);
      const checkItem = {
        id: index !== -1 ? this.data.checks_dieta[index].id : Date.now() + Math.floor(Math.random() * 1000),
        usuario_id: usuarioId,
        item_dieta_id: check.item_dieta_id,
        data,
        cumprido: check.cumprido
      };

      if (index !== -1) {
        this.data.checks_dieta[index] = checkItem;
      } else {
        this.data.checks_dieta.push(checkItem);
      }
      savedChecks.push(checkItem);
    }
    this.saveToDisk();
    return savedChecks;
  }

  async getTodosChecksDieta(usuarioId: number): Promise<any[]> {
    return this.data.checks_dieta.filter(c => c.usuario_id === usuarioId).sort((a, b) => a.data.localeCompare(b.data));
  }

  // Photos Methods JSON
  async getFotosProgresso(usuarioId: number): Promise<any[]> {
    return this.data.fotos_progresso.filter(f => f.usuario_id === usuarioId).sort((a, b) => a.data.localeCompare(b.data));
  }

  async addFotoProgresso(usuarioId: number, data: string, fotoUrl: string, legenda?: string): Promise<any> {
    const newFoto = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      usuario_id: usuarioId,
      data,
      foto_url: fotoUrl,
      legenda: legenda || null
    };
    this.data.fotos_progresso.push(newFoto);
    this.saveToDisk();
    return newFoto;
  }

  async getTodasFotosProgresso(): Promise<any[]> {
    return [...this.data.fotos_progresso].sort((a, b) => a.data.localeCompare(b.data));
  }
}

export const db: DB = DATABASE_URL ? new PostgresDB() : new JSONDB();
