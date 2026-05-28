const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const db = new Database('inventario.db');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// ── CORREÇÃO DE SEGURANÇA: MIDDLEWARE CSP PARA LOCALHOST ──
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:;"
  );
  next();
});

// Entrega garantida do arquivo index.html na rota inicial raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

db.exec(fs.readFileSync('schema.sql', 'utf8'));

const run = (sql, p = []) => db.prepare(sql).run(...p);
const all = (sql, p = []) => db.prepare(sql).all(...p);
const one = (sql, p = []) => db.prepare(sql).get(...p);

// ── AUTH ──────────────────────────────────────────────────
const tokens = new Map(); // token → { id, nome, email, perfil }

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = tokens.get(token);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });
  req.user = user;
  next();
};
const adminOnly = (req, res, next) =>
  req.user.perfil === 'admin' ? next() : res.status(403).json({ error: 'Acesso restrito a administradores' });

// Criar admin padrão se não existir nenhum usuário
if (!one('SELECT id FROM usuarios LIMIT 1')) {
  run('INSERT INTO usuarios(nome,email,senha,perfil) VALUES(?,?,?,?)',
    ['Administrador', 'admin@empresa.com', bcrypt.hashSync('admin123', 10), 'admin']);
  console.log('👤 Admin padrão criado: admin@empresa.com / admin123');
}

// ── LOGIN / LOGOUT ────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const u = one('SELECT * FROM usuarios WHERE email=? AND ativo=1', [email]);
  if (!u || !bcrypt.compareSync(senha, u.senha))
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
  res.json({ token, id: u.id, nome: u.nome, perfil: u.perfil });
});

app.post('/api/logout', auth, (req, res) => {
  tokens.delete(req.headers.authorization?.split(' ')[1]);
  res.json({ ok: true });
});

// ── USUÁRIOS (admin) ──────────────────────────────────────
app.get('/api/usuarios', auth, adminOnly, (_, r) =>
  r.json(all('SELECT id,nome,email,perfil,ativo FROM usuarios ORDER BY nome')));

app.post('/api/usuarios', auth, adminOnly, (req, r) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha) return r.status(400).json({ error: 'Campos obrigatórios' });

  const targetPerfil = perfil || 'viewer';
  const x = run('INSERT INTO usuarios(nome,email,senha,perfil) VALUES(?,?,?,?)',
    [nome, email, bcrypt.hashSync(senha, 10), targetPerfil]);

  r.json({ id: x.lastInsertRowid, nome, email, perfil: targetPerfil, ativo: 1 });
});

app.put('/api/usuarios/:id', auth, adminOnly, (req, r) => {
  const { nome, email, perfil, ativo, senha } = req.body;
  if (senha)
    run('UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,senha=? WHERE id=?',
      [nome, email, perfil, ativo ? 1 : 0, bcrypt.hashSync(senha, 10), req.params.id]);
  else
    run('UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=? WHERE id=?',
      [nome, email, perfil, ativo ? 1 : 0, req.params.id]);
  r.json({ ok: true });
});

app.delete('/api/usuarios/:id', auth, adminOnly, (req, r) => {
  if (String(req.params.id) === String(req.user.id))
    return r.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
  run('DELETE FROM usuarios WHERE id=?', [req.params.id]);
  r.json({ ok: true });
});

// ── FILIAIS ───────────────────────────────────────────────
app.get('/api/filiais', auth, (_, r) => r.json(all('SELECT * FROM filiais ORDER BY nome')));
app.post('/api/filiais', auth, adminOnly, (q, r) => { const x = run('INSERT INTO filiais(nome,cod) VALUES(?,?)', [q.body.nome, q.body.cod]); r.json({ id: x.lastInsertRowid, ...q.body }); });
app.put('/api/filiais/:id', auth, adminOnly, (q, r) => { run('UPDATE filiais SET nome=?,cod=? WHERE id=?', [q.body.nome, q.body.cod, q.params.id]); r.json({ ok: true }); });
app.delete('/api/filiais/:id', auth, adminOnly, (q, r) => { run('DELETE FROM filiais WHERE id=?', [q.params.id]); r.json({ ok: true }); });

// ── FABRICANTES ───────────────────────────────────────────
app.get('/api/fabricantes', auth, (_, r) => r.json(all('SELECT * FROM fabricantes ORDER BY nome')));
app.post('/api/fabricantes', auth, adminOnly, (q, r) => { const x = run('INSERT INTO fabricantes(nome) VALUES(?)', [q.body.nome]); r.json({ id: x.lastInsertRowid, ...q.body }); });
app.put('/api/fabricantes/:id', auth, adminOnly, (q, r) => { run('UPDATE fabricantes SET nome=? WHERE id=?', [q.body.nome, q.params.id]); r.json({ ok: true }); });
app.delete('/api/fabricantes/:id', auth, adminOnly, (q, r) => { run('DELETE FROM fabricantes WHERE id=?', [q.params.id]); r.json({ ok: true }); });

// ── MODELOS ───────────────────────────────────────────────
app.get('/api/modelos', auth, (_, r) => r.json(all('SELECT id, nome, fab_id AS fabId FROM modelos ORDER BY nome')));
app.post('/api/modelos', auth, adminOnly, (q, r) => { const x = run('INSERT INTO modelos(nome,fab_id) VALUES(?,?)', [q.body.nome, q.body.fabId]); r.json({ id: x.lastInsertRowid, nome: q.body.nome, fabId: q.body.fabId }); });
app.put('/api/modelos/:id', auth, adminOnly, (q, r) => { run('UPDATE modelos SET nome=?,fab_id=? WHERE id=?', [q.body.nome, q.body.fabId, q.params.id]); r.json({ ok: true }); });
app.delete('/api/modelos/:id', auth, adminOnly, (q, r) => { run('DELETE FROM modelos WHERE id=?', [q.params.id]); r.json({ ok: true }); });

// ── TÉCNICOS ──────────────────────────────────────────────
app.get('/api/tecnicos', auth, (_, r) => r.json(all('SELECT * FROM tecnicos ORDER BY nome')));
app.post('/api/tecnicos', auth, adminOnly, (q, r) => { const x = run('INSERT INTO tecnicos(nome,email,tel) VALUES(?,?,?)', [q.body.nome, q.body.email, q.body.tel || null]); r.json({ id: x.lastInsertRowid, ...q.body }); });
app.put('/api/tecnicos/:id', auth, adminOnly, (q, r) => { run('UPDATE tecnicos SET nome=?,email=?,tel=? WHERE id=?', [q.body.nome, q.body.email, q.body.tel || null, q.params.id]); r.json({ ok: true }); });
app.delete('/api/tecnicos/:id', auth, adminOnly, (q, r) => { run('DELETE FROM tecnicos WHERE id=?', [q.params.id]); r.json({ ok: true }); });

// ── EQUIPAMENTOS ──────────────────────────────────────────
const mapEq = e => ({
  ptm: e.ptm, serie: e.serie || '',
  filialId: e.filial_id, fabId: e.fab_id,
  modeloId: e.modelo_id, tecId: e.tecnico_id,
  dtAq: e.dt_aquisicao || '', cap: e.capacidade || '',
  div: e.divisao || '', loc: e.localizacao || '',
  status: e.status, fonte: e.fonte || '',
  obs: e.observacao || '', dtAt: e.dt_atualiz || '',
  imgs: all('SELECT nome_arq AS name, dados AS data FROM imagens WHERE equip_ptm=?', [e.ptm])
});

app.get('/api/equipamentos', auth, (_, r) =>
  r.json(all('SELECT * FROM equipamentos ORDER BY ptm').map(mapEq)));

app.post('/api/equipamentos', auth, adminOnly, (q, r) => {
  const e = q.body;
  run(`INSERT INTO equipamentos
    (ptm,serie,filial_id,fab_id,modelo_id,dt_aquisicao,capacidade,
     divisao,localizacao,status,fonte,tecnico_id,observacao,dt_atualiz)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [e.ptm, e.serie, e.filialId || null, e.fabId || null, e.modeloId || null,
    e.dtAq, e.cap, e.div, e.loc, e.status, e.fonte, e.tecId || null, e.obs, e.dtAt]);
  (e.imgs || []).forEach(img =>
    run('INSERT INTO imagens(equip_ptm,nome_arq,dados) VALUES(?,?,?)', [e.ptm, img.name, img.data]));
  r.json({ ok: true });
});

app.put('/api/equipamentos/:ptm', auth, adminOnly, (q, r) => {
  const e = q.body;
  run(`UPDATE equipamentos SET
    serie=?,filial_id=?,fab_id=?,modelo_id=?,dt_aquisicao=?,capacidade=?,
    divisao=?,localizacao=?,status=?,fonte=?,tecnico_id=?,observacao=?,dt_atualiz=?
    WHERE ptm=?`,
    [e.serie, e.filialId || null, e.fabId || null, e.modeloId || null, e.dtAq,
    e.cap, e.div, e.loc, e.status, e.fonte, e.tecId || null, e.obs, e.dtAt, q.params.ptm]);
  run('DELETE FROM imagens WHERE equip_ptm=?', [q.params.ptm]);
  (e.imgs || []).forEach(img =>
    run('INSERT INTO imagens(equip_ptm,nome_arq,dados) VALUES(?,?,?)', [q.params.ptm, img.name, img.data]));
  r.json({ ok: true });
});

app.delete('/api/equipamentos/:ptm', auth, adminOnly, (q, r) => {
  run('DELETE FROM equipamentos WHERE ptm=?', [q.params.ptm]);
  r.json({ ok: true });
});

app.listen(3000, () => console.log('✅ InventárioTI em http://localhost:3000'));