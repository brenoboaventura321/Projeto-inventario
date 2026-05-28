const express  = require('express');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app = express();

// Configuração do Pool do PostgreSQL usando variáveis de ambiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000 https://*.onrender.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:;"
  );
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicialização Assíncrona do Banco de Dados
async function initDB() {
  try {
    const sql = fs.readFileSync('schema.sql', 'utf8');
    await pool.query(sql);
    console.log("🗄️ Tabelas verificadas/criadas no Neon.");

    const res = await pool.query('SELECT id FROM usuarios LIMIT 1');
    if (res.rowCount === 0) {
      await pool.query('INSERT INTO usuarios(nome,email,senha,perfil) VALUES($1,$2,$3,$4)',
        ['Administrador', 'admin@empresa.com', bcrypt.hashSync('admin123', 10), 'admin']);
      console.log('👤 Admin padrão criado: admin@empresa.com / admin123');
    }
  } catch (err) {
    console.error("Erro crítico ao inicializar banco no Neon:", err);
  }
}
initDB();

// ── AUTH MIDDLEWARE ───────────────────────────────────────
const tokens = new Map();

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user  = tokens.get(token);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });
  req.user = user;
  next();
};

const adminOnly = (req, res, next) =>
  req.user.perfil === 'admin' ? next() : res.status(403).json({ error: 'Acesso restrito' });

// ── LOGIN / LOGOUT ────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email=$1 AND ativo=1', [email]);
    const u = result.rows[0];
    if (!u || !bcrypt.compareSync(senha, u.senha))
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    
    const token = crypto.randomBytes(32).toString('hex');
    tokens.set(token, { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
    res.json({ token, id: u.id, nome: u.nome, perfil: u.perfil });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logout', auth, (req, res) => {
  tokens.delete(req.headers.authorization?.split(' ')[1]);
  res.json({ ok: true });
});

// ── USUÁRIOS ──────────────────────────────────────────────
app.get('/api/usuarios', auth, adminOnly, async (_, r) => {
  const res = await pool.query('SELECT id,nome,email,perfil,ativo FROM usuarios ORDER BY nome');
  r.json(res.rows);
});

app.post('/api/usuarios', auth, adminOnly, async (req, r) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return r.status(400).json({ error: 'Campos obrigatórios' });
  const target = perfil || 'viewer';
  const x = await pool.query('INSERT INTO usuarios(nome,email,senha,perfil) VALUES($1,$2,$3,$4) RETURNING id',
    [nome, email, bcrypt.hashSync(senha, 10), target]);
  r.json({ id: x.rows[0].id, nome, email, perfil: target, ativo: 1 });
});

app.put('/api/usuarios/:id', auth, adminOnly, async (req, r) => {
  const { nome, email, perfil, ativo, senha } = req.body;
  const activeVal = ativo ? 1 : 0;
  if (senha)
    await pool.query('UPDATE usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,senha=$5 WHERE id=$6',
      [nome, email, perfil, activeVal, bcrypt.hashSync(senha,10), req.params.id]);
  else
    await pool.query('UPDATE usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4 WHERE id=$5',
      [nome, email, perfil, activeVal, req.params.id]);
  r.json({ ok: true });
});

app.delete('/api/usuarios/:id', auth, adminOnly, async (req, r) => {
  if (String(req.params.id) === String(req.user.id)) return r.status(400).json({ error: 'Não pode remover a si mesmo' });
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
  r.json({ ok: true });
});

// ── FILIAIS ───────────────────────────────────────────────
app.get('/api/filiais', auth, async (_, r) => {
  const res = await pool.query('SELECT * FROM filiais ORDER BY nome');
  r.json(res.rows);
});
app.post('/api/filiais', auth, adminOnly, async (q, r) => {
  const x = await pool.query('INSERT INTO filiais(nome,cod) VALUES($1,$2) RETURNING id', [q.body.nome, q.body.cod]);
  r.json({ id: x.rows[0].id, ...q.body });
});
app.put('/api/filiais/:id', auth, adminOnly, async (q, r) => {
  await pool.query('UPDATE filiais SET nome=$1,cod=$2 WHERE id=$3', [q.body.nome, q.body.cod, q.params.id]);
  r.json({ ok: true });
});
app.delete('/api/filiais/:id', auth, adminOnly, async (q, r) => {
  await pool.query('DELETE FROM filiais WHERE id=$1', [q.params.id]);
  r.json({ ok: true });
});

// ── FABRICANTES ───────────────────────────────────────────
app.get('/api/fabricantes', auth, async (_, r) => {
  const res = await pool.query('SELECT * FROM fabricantes ORDER BY nome');
  r.json(res.rows);
});
app.post('/api/fabricantes', auth, adminOnly, async (q, r) => {
  const x = await pool.query('INSERT INTO fabricantes(nome) VALUES($1) RETURNING id', [q.body.nome]);
  r.json({ id: x.rows[0].id, ...q.body });
});
app.put('/api/fabricantes/:id', auth, adminOnly, async (q, r) => {
  await pool.query('UPDATE fabricantes SET nome=$1 WHERE id=$2', [q.body.nome, q.params.id]);
  r.json({ ok: true });
});
app.delete('/api/fabricantes/:id', auth, adminOnly, async (q, r) => {
  await pool.query('DELETE FROM fabricantes WHERE id=$1', [q.params.id]);
  r.json({ ok: true });
});

// ── MODELOS ───────────────────────────────────────────────
app.get('/api/modelos', auth, async (_, r) => {
  const res = await pool.query('SELECT id, nome, fab_id AS "fabId" FROM modelos ORDER BY nome');
  r.json(res.rows);
});
app.post('/api/modelos', auth, adminOnly, async (q, r) => {
  const x = await pool.query('INSERT INTO modelos(nome,fab_id) VALUES($1,$2) RETURNING id', [q.body.nome, q.body.fabId]);
  r.json({ id: x.rows[0].id, nome: q.body.nome, fabId: q.body.fabId });
});
app.put('/api/modelos/:id', auth, adminOnly, async (q, r) => {
  await pool.query('UPDATE modelos SET nome=$1,fab_id=$2 WHERE id=$3', [q.body.nome, q.body.fabId, q.params.id]);
  r.json({ ok: true });
});
app.delete('/api/modelos/:id', auth, adminOnly, async (q, r) => {
  await pool.query('DELETE FROM modelos WHERE id=$1', [q.params.id]);
  r.json({ ok: true });
});

// ── TÉCNICOS ──────────────────────────────────────────────
app.get('/api/tecnicos', auth, async (_, r) => {
  const res = await pool.query('SELECT * FROM tecnicos ORDER BY nome');
  r.json(res.rows);
});
app.post('/api/tecnicos', auth, adminOnly, async (q, r) => {
  const x = await pool.query('INSERT INTO tecnicos(nome,email,tel) VALUES($1,$2,$3) RETURNING id', [q.body.nome, q.body.email, q.body.tel || null]);
  r.json({ id: x.rows[0].id, ...q.body });
});
app.put('/api/tecnicos/:id', auth, adminOnly, async (q, r) => {
  await pool.query('UPDATE tecnicos SET nome=$1,email=$2,tel=$3 WHERE id=$4', [q.body.nome, q.body.email, q.body.tel || null, q.params.id]);
  r.json({ ok: true });
});
app.delete('/api/tecnicos/:id', auth, adminOnly, async (q, r) => {
  await pool.query('DELETE FROM tecnicos WHERE id=$1', [q.params.id]);
  r.json({ ok: true });
});

// ── EQUIPAMENTOS ──────────────────────────────────────────
app.get('/api/equipamentos', auth, async (_, r) => {
  try {
    const eqRes = await pool.query('SELECT * FROM equipamentos ORDER BY ptm');
    const equipamentos = [];
    
    for (let e of eqRes.rows) {
      const imgRes = await pool.query('SELECT nome_arq AS name, dados AS data FROM imagens WHERE equip_ptm=$1', [e.ptm]);
      equipamentos.push({
        ptm: e.ptm, serie: e.serie||'',
        filialId: e.filial_id, fabId: e.fab_id, modeloId: e.modelo_id, tecId: e.tecnico_id,
        dtAq: e.dt_aquisicao||'', cap: e.capacidade||'', div: e.divisao||'', loc: e.localizacao||'',
        status: e.status, fonte: e.fonte||'', obs: e.observacao||'', dtAt: e.dt_atualiz||'',
        imgs: imgRes.rows
      });
    }
    r.json(equipamentos);
  } catch (err) { r.status(500).json({ error: err.message }); }
});

app.post('/api/equipamentos', auth, adminOnly, async (q, r) => {
  const e = q.body;
  await pool.query(`INSERT INTO equipamentos
    (ptm,serie,filial_id,fab_id,modelo_id,dt_aquisicao,capacidade,divisao,localizacao,status,fonte,tecnico_id,observacao,dt_atualiz)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [e.ptm, e.serie, e.filialId||null, e.fabId||null, e.modeloId||null, e.dtAq, e.cap, e.div, e.loc, e.status, e.fonte, e.tecId||null, e.obs, e.dtAt]);
  
  for (let img of (e.imgs||[])) {
    await pool.query('INSERT INTO imagens(equip_ptm,nome_arq,dados) VALUES($1,$2,$3)', [e.ptm, img.name, img.data]);
  }
  r.json({ ok: true });
});

app.put('/api/equipamentos/:ptm', auth, adminOnly, async (q, r) => {
  const e = q.body;
  await pool.query(`UPDATE equipamentos SET
    serie=$1,filial_id=$2,fab_id=$3,modelo_id=$4,dt_aquisicao=$5,capacidade=$6,divisao=$7,localizacao=$8,status=$9,fonte=$10,tecnico_id=$11,observacao=$12,dt_atualiz=$13
    WHERE ptm=$14`,
    [e.serie, e.filialId||null, e.fabId||null, e.modeloId||null, e.dtAq, e.cap, e.div, e.loc, e.status, e.fonte, e.tecId||null, e.obs, e.dtAt, q.params.ptm]);
  
  await pool.query('DELETE FROM imagens WHERE equip_ptm=$1', [q.params.ptm]);
  for (let img of (e.imgs||[])) {
    await pool.query('INSERT INTO imagens(equip_ptm,nome_arq,dados) VALUES($1,$2,$3)', [q.params.ptm, img.name, img.data]);
  }
  r.json({ ok: true });
});

app.delete('/api/equipamentos/:ptm', auth, adminOnly, async (q, r) => {
  await pool.query('DELETE FROM equipamentos WHERE ptm=$1', [q.params.ptm]);
  r.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));