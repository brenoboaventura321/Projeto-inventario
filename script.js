// ─── AUTH ─────────────────────────────────────────────────
let AUTH = null;

const apiFetch = async (url, opts = {}) => {
  const h = { Authorization: `Bearer ${AUTH?.token}` };
  if (opts.body) h['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, headers: h });
  if (res.status === 401) { doLogout(); return null; }
  return res.json().catch(() => null);
};

async function doLogin() {
  const email = document.getElementById('le').value.trim();
  const senha = document.getElementById('ls').value;
  const err   = document.getElementById('lerr');
  const btn   = document.getElementById('lbtn');
  err.textContent = '';
  if (!email || !senha) { err.textContent = 'Preencha email e senha'; return; }
  btn.textContent = 'Entrando…'; btn.disabled = true;
  try {
    const res  = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,senha}) });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error || 'Credenciais inválidas'; return; }
    AUTH = data;
    document.getElementById('lw').style.display = 'none';
    document.getElementById('aw').style.display = '';
    const roleLabel = AUTH.perfil === 'admin' ? 'Admin' : 'Visualizador';
    document.getElementById('user-info').innerHTML = `👤 ${esc(AUTH.nome)} <span class="badge-role">${roleLabel}</span>`;
    await loadAll();
  } catch {
    err.textContent = 'Erro: servidor indisponível';
  } finally {
    btn.textContent = 'Entrar'; btn.disabled = false;
  }
}

async function doLogout() {
  if (AUTH) apiFetch('/api/logout', { method:'POST' }).catch(()=>{});
  AUTH = null;
  document.getElementById('aw').style.display = 'none';
  document.getElementById('lw').style.display = 'flex';
  document.getElementById('ls').value = '';
  document.getElementById('lerr').textContent = '';
}

document.getElementById('le').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('ls').focus(); });
document.getElementById('ls').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

// ─── ESTADO ───────────────────────────────────────────────
const S = {
  pg:'dashboard', atab:'filiais', srch:'', fst:'', ffil:'',
  eptm:null, eaTab:null, eaId:null, imgs:[],
  fabricantes:[], modelos:[], filiais:[], tecnicos:[], equipamentos:[], usuarios:[]
};

const STS = ['Ativo','Inativo','Em Manutenção','Descartado','Reserva'];
const tod  = () => new Date().toISOString().split('T')[0];
const bid  = (a,id) => a.find(x => String(x.id)===String(id));
const nid  = a => Math.max(0,...a.map(x=>x.id))+1;
const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const bdg  = s => { const m={Ativo:'sa',Inativo:'si','Em Manutenção':'sm',Descartado:'sd',Reserva:'sr'}; return `<span class="badge ${m[s]||'si'}">${esc(s)}</span>`; };
const isAdmin = () => AUTH?.perfil === 'admin';

// ─── LOAD ─────────────────────────────────────────────────
async function loadAll() {
  const calls = [
    apiFetch('/api/equipamentos'),
    apiFetch('/api/filiais'),
    apiFetch('/api/fabricantes'),
    apiFetch('/api/modelos'),
    apiFetch('/api/tecnicos'),
  ];
  if (isAdmin()) calls.push(apiFetch('/api/usuarios'));
  const [eq,fil,fab,mod,tec,usr] = await Promise.all(calls);
  S.equipamentos = eq  || [];
  S.filiais      = fil || [];
  S.fabricantes  = fab || [];
  S.modelos      = mod || [];   // server already returns fabId
  S.tecnicos     = tec || [];
  if (isAdmin()) S.usuarios = usr || [];
  navigate(S.pg);
}

// ─── MODAL ─────────────────────────────────────────────────
function openM(title, html, wide=false) {
  document.getElementById('mt').textContent = title;
  document.getElementById('mbd').innerHTML  = html;
  document.getElementById('mb').className   = wide ? 'wide' : '';
  document.getElementById('ov').className   = 'on';
}
function closeModal() { document.getElementById('ov').className=''; S.imgs=[]; }
document.getElementById('ov').addEventListener('click', e => { if(e.target.id==='ov') closeModal(); });

// ─── NAVIGATE ─────────────────────────────────────────────
const ALL_PAGES = [
  ['dashboard','📊','Dashboard'],
  ['inventario','📦','Inventário'],
  ['admin','⚙️','Administração'],
  ['er','🗄️','Modelo ER'],
  ['docs','📋','Docs / DB'],
];

function navigate(pg) {
  if (pg === 'admin' && !isAdmin()) pg = 'dashboard';
  S.pg = pg;
  const pages = ALL_PAGES.filter(([id]) => id !== 'admin' || isAdmin());
  document.getElementById('nav').innerHTML = pages.map(([id,ic,lb]) =>
    `<button class="nb${S.pg===id?' on':''}" onclick="navigate('${id}')">${ic} ${lb}</button>`).join('');
  document.getElementById('ct-eq').textContent = `${S.equipamentos.length} equip.`;
  ({ dashboard:renderDash, inventario:renderInv, admin:renderAdmin, er:renderER, docs:renderDocs }[pg] || renderDash)();
}

// ─── DASHBOARD ────────────────────────────────────────────
function renderDash() {
  const eq=S.equipamentos, tot=eq.length;
  const cnt = s => eq.filter(e=>e.status===s).length;
  const byFil = S.filiais.map(f=>({n:(f.nome.split('–')[1]||f.nome).trim(), c:eq.filter(e=>String(e.filialId)===String(f.id)).length})).sort((a,b)=>b.c-a.c);
  const byFab = S.fabricantes.map(f=>({n:f.nome, c:eq.filter(e=>String(e.fabId)===String(f.id)).length})).sort((a,b)=>b.c-a.c);
  const bars  = (it,cl) => it.map(f=>`<div class="brow"><span class="blbl">${esc(f.n)}</span><div class="btr"><div class="bf" style="width:${tot?Math.round(f.c/tot*100):0}%;background:${cl}"></div></div><span class="bnum">${f.c}</span></div>`).join('');
  document.getElementById('ct').innerHTML = `
    <div class="ptitle" style="margin-bottom:16px">Dashboard</div>
    <div class="sgrid">
      <div class="sc sc-i"><div class="si2">📦</div><div class="sv">${tot}</div><div class="sl">Total</div></div>
      <div class="sc sc-g"><div class="si2">✅</div><div class="sv">${cnt('Ativo')}</div><div class="sl">Ativos</div></div>
      <div class="sc sc-y"><div class="si2">🔧</div><div class="sv">${cnt('Em Manutenção')}</div><div class="sl">Em Manutenção</div></div>
      <div class="sc sc-s"><div class="si2">⛔</div><div class="sv">${cnt('Inativo')}</div><div class="sl">Inativos</div></div>
    </div>
    <div class="cgrid">
      <div class="card"><h3 style="font-weight:700;margin-bottom:12px;font-size:14px">Por Filial</h3>${bars(byFil,'#4f46e5')}</div>
      <div class="card"><h3 style="font-weight:700;margin-bottom:12px;font-size:14px">Por Fabricante</h3>${bars(byFab,'#16a34a')}</div>
    </div>`;
}

// ─── INVENTÁRIO ───────────────────────────────────────────
function renderInv() {
  const q = S.srch.toLowerCase();
  const rows = S.equipamentos.filter(e => {
    const m = !q || [e.ptm,e.serie,bid(S.fabricantes,e.fabId)?.nome||'',bid(S.modelos,e.modeloId)?.nome||'',e.loc,e.div].join(' ').toLowerCase().includes(q);
    return m && (!S.fst||e.status===S.fst) && (!S.ffil||String(e.filialId)===S.ffil);
  });
  const sOpts = STS.map(s=>`<option value="${s}"${S.fst===s?' selected':''}>${s}</option>`).join('');
  const fOpts = S.filiais.map(f=>`<option value="${f.id}"${S.ffil===String(f.id)?' selected':''}>${esc(f.nome)}</option>`).join('');

  const rowActs = ptm => isAdmin()
    ? `<button class="btn bsm bv" onclick="viewEq('${ptm}')">👁</button>
       <button class="btn bsm be" onclick="editEq('${ptm}')">✏️</button>
       <button class="btn bsm bd" onclick="delEq('${ptm}')">🗑</button>`
    : `<button class="btn bsm bv" onclick="viewEq('${ptm}')">👁</button>`;

  const trs = rows.map(e => `<tr>
    <td><b style="color:#4f46e5;font-family:monospace">${esc(e.ptm)}</b></td>
    <td>${esc(bid(S.filiais,e.filialId)?.nome||'—')}</td>
    <td>${esc(bid(S.fabricantes,e.fabId)?.nome||'—')}</td>
    <td>${esc(bid(S.modelos,e.modeloId)?.nome||'—')}</td>
    <td style="color:#64748b">${esc(e.serie||'—')}</td>
    <td>${esc(e.dtAq||'—')}</td>
    <td>${esc(e.cap||'—')}</td>
    <td>${esc(e.div||'—')}</td>
    <td>${esc(e.loc||'—')}</td>
    <td>${bdg(e.status)}</td>
    <td>${esc(e.fonte||'—')}</td>
    <td>${esc(bid(S.tecnicos,e.tecId)?.nome||'—')}</td>
    <td><div style="display:flex;gap:3px">${rowActs(esc(e.ptm))}</div></td>
  </tr>`).join('') || `<tr><td colspan="13" style="text-align:center;padding:32px;color:#94a3b8">Nenhum equipamento encontrado</td></tr>`;

  document.getElementById('ct').innerHTML = `
    <div class="phd">
      <h1 class="ptitle">Inventário de Equipamentos</h1>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn bg" onclick="expJSON()">⬇ JSON</button>
        <button class="btn bo" onclick="expXLSX()">⬇ XLSX</button>
        ${isAdmin() ? '<button class="btn bp" onclick="addEq()">+ Novo Equipamento</button>' : ''}
      </div>
    </div>
    <div class="tbar">
      <input class="inp" style="max-width:270px" placeholder="Buscar PTM, série, modelo, local…" value="${esc(S.srch)}" oninput="S.srch=this.value;renderInv()">
      <select class="inp" style="width:auto" onchange="S.fst=this.value;renderInv()"><option value="">Todos os status</option>${sOpts}</select>
      <select class="inp" style="width:auto" onchange="S.ffil=this.value;renderInv()"><option value="">Todas as filiais</option>${fOpts}</select>
    </div>
    <div class="twrap">
      <table>
        <thead><tr><th>PTM</th><th>Loja</th><th>Fabricante</th><th>Modelo</th><th>Série</th><th>Dt. Aquisição</th><th>Capacidade</th><th>Divisão</th><th>Localização</th><th>Status</th><th>Fonte</th><th>Técnico</th><th>Ações</th></tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:5px">${rows.length} equipamento(s) exibido(s)</p>`;
}

// FORM EQUIPAMENTO
function eqForm(e) {
  const v   = k => esc(e ? e[k]||'' : '');
  const opt = (arr,val) => arr.map(x=>`<option value="${x.id}"${String(x.id)===String(val)?' selected':''}>${esc(x.nome)}</option>`).join('');
  const mods  = e?.fabId ? S.modelos.filter(m=>String(m.fabId)===String(e.fabId)) : [];
  const stos  = STS.map(s=>`<option${(e?.status||'Ativo')===s?' selected':''}>${s}</option>`).join('');
  const th    = () => S.imgs.map((img,i)=>`<div class="thumb"><img src="${img.data}" alt=""><button onclick="rmImg(${i})">×</button></div>`).join('');
  return `<div class="fg">
    <div class="fl"><label>PTM *</label><input class="inp" id="fp" value="${v('ptm')}" placeholder="PTM-0001"${e?' disabled':''}></div>
    <div class="fl"><label>Número de Série</label><input class="inp" id="fs" value="${v('serie')}" placeholder="SN-XXXXX"></div>
    <div class="fl"><label>Filial</label><select class="inp" id="ff"><option value="">Selecione…</option>${opt(S.filiais,e?.filialId)}</select></div>
    <div class="fl"><label>Fabricante</label><select class="inp" id="ffb" onchange="chgFab(this.value)"><option value="">Selecione…</option>${opt(S.fabricantes,e?.fabId)}</select></div>
    <div class="fl"><label>Modelo</label><select class="inp" id="fm"><option value="">Selecione…</option>${opt(mods,e?.modeloId)}</select></div>
    <div class="fl"><label>Status</label><select class="inp" id="fst2">${stos}</select></div>
    <div class="fl"><label>Data de Aquisição</label><input type="date" class="inp" id="fda" value="${v('dtAq')}"></div>
    <div class="fl"><label>Fonte</label><input class="inp" id="ffo" value="${v('fonte')}" placeholder="Compra Direta, Licitação…"></div>
    <div class="fl"><label>Capacidade</label><input class="inp" id="fcp" value="${v('cap')}" placeholder="16GB / 512GB SSD"></div>
    <div class="fl"><label>Divisão</label><input class="inp" id="fdv" value="${v('div')}" placeholder="TI, Financeiro…"></div>
    <div class="fl"><label>Localização</label><input class="inp" id="flc" value="${v('loc')}" placeholder="Sala 201"></div>
    <div class="fl"><label>Técnico Responsável</label><select class="inp" id="ftc"><option value="">Selecione…</option>${opt(S.tecnicos,e?.tecId)}</select></div>
    <div class="fl s2"><label>Observação</label><textarea class="inp" id="fob" rows="2">${v('obs')}</textarea></div>
    <div class="fl s2"><label>Imagens (Prova)</label>
      <div class="dz" onclick="document.getElementById('fi').click()">📎 Clique para anexar imagens</div>
      <div class="thumbs" id="ithumbs">${th()}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
    <button class="btn bgh" onclick="closeModal()">Cancelar</button>
    <button class="btn bp" onclick="saveEq()">Salvar Equipamento</button>
  </div>`;
}

function addEq()  { S.eptm=null; S.imgs=[]; openM('Novo Equipamento', eqForm(null), true); }
function editEq(ptm) {
  const e = S.equipamentos.find(x=>x.ptm===ptm);
  S.eptm = ptm; S.imgs = [...(e.imgs||[])];
  openM(`Editar: ${ptm}`, eqForm(e), true);
}

async function saveEq() {
  const g = id => document.getElementById(id)?.value || '';
  const ptm = (S.eptm || g('fp')).trim();
  if (!ptm) { alert('PTM é obrigatório'); return; }
  const d = {
    ptm, serie:g('fs'), filialId:g('ff')?+g('ff'):'', fabId:g('ffb')?+g('ffb'):'',
    modeloId:g('fm')?+g('fm'):'', dtAq:g('fda'), cap:g('fcp'), div:g('fdv'),
    loc:g('flc'), status:g('fst2')||'Ativo', fonte:g('ffo'),
    tecId:g('ftc')?+g('ftc'):'', obs:g('fob'), dtAt:tod(), imgs:[...S.imgs]
  };
  await apiFetch(S.eptm ? `/api/equipamentos/${S.eptm}` : '/api/equipamentos',
    { method: S.eptm ? 'PUT' : 'POST', body: JSON.stringify(d) });
  closeModal(); await loadAll();
}

async function delEq(ptm) {
  if (!confirm(`Remover equipamento ${ptm}?`)) return;
  await apiFetch(`/api/equipamentos/${ptm}`, { method:'DELETE' });
  await loadAll();
}

function viewEq(ptm) {
  const e = S.equipamentos.find(x=>x.ptm===ptm); if(!e) return;
  const rows = [
    ['PTM',esc(e.ptm)],['Série',esc(e.serie||'—')],
    ['Filial',esc(bid(S.filiais,e.filialId)?.nome||'—')],
    ['Fabricante',esc(bid(S.fabricantes,e.fabId)?.nome||'—')],
    ['Modelo',esc(bid(S.modelos,e.modeloId)?.nome||'—')],
    ['Status',bdg(e.status)],['Dt. Aquisição',esc(e.dtAq||'—')],
    ['Fonte',esc(e.fonte||'—')],['Capacidade',esc(e.cap||'—')],
    ['Divisão',esc(e.div||'—')],['Localização',esc(e.loc||'—')],
    ['Técnico',esc(bid(S.tecnicos,e.tecId)?.nome||'—')],['Dt. Atualização',esc(e.dtAt||'—')]
  ];
  const cells = rows.map(([l,v])=>`<div class="dc"><div class="dl">${l}</div><div class="dv">${v}</div></div>`).join('');
  const obs  = e.obs ? `<div class="dc" style="grid-column:span 2"><div class="dl">Observação</div><div class="dv">${esc(e.obs)}</div></div>` : '';
  const imgs = e.imgs?.length
    ? `<div style="margin-top:10px"><div class="dl" style="margin-bottom:7px">Imagens (Clique para ampliar)</div>
       <div class="thumbs">${e.imgs.map(i => {
         const imgSrc = esc(i.data);
         const imgName = esc(i.name || 'Imagem do Equipamento');
         return `<div class="thumb" style="width:80px; height:80px; cursor:pointer;" onclick="zoomImg('${imgSrc}', '${imgName}')">
           <img src="${imgSrc}" style="width:80px; height:80px; border-radius:10px; object-fit:cover; display:block;" alt="${imgName}">
         </div>`;
       }).join('')}</div></div>` : '';
  openM(`Detalhes: ${ptm}`, `<div class="dg">${cells}${obs}</div>${imgs}`);
}

function zoomImg(src, name) {
  openM(name || 'Visualizar Imagem', `
    <div style="text-align:center;">
      <img src="${src}" style="max-width:100%; max-height:calc(100vh - 160px); border-radius:8px; object-fit:contain; display:block; margin:0 auto;" alt="">
    </div>
    <div style="display:flex; justify-content:flex-end; margin-top:14px;">
      <button class="btn bgh" onclick="closeModal()">Fechar</button>
    </div>
  `, false);
}

function chgFab(fid) {
  const sel = document.getElementById('fm'); if(!sel) return;
  sel.innerHTML = `<option value="">Selecione…</option>` +
    S.modelos.filter(m=>String(m.fabId)===String(fid)).map(m=>`<option value="${m.id}">${esc(m.nome)}</option>`).join('');
}

// IMAGENS
document.getElementById('fi').addEventListener('change', function() {
  Array.from(this.files).forEach(f => {
    const r = new FileReader();
    r.onload = ev => {
      S.imgs.push({ name:f.name, data:ev.target.result });
      const t = document.getElementById('ithumbs');
      if(t) t.innerHTML = S.imgs.map((img,i)=>`<div class="thumb"><img src="${img.data}" alt=""><button onclick="rmImg(${i})">×</button></div>`).join('');
    };
    r.readAsDataURL(f);
  });
  this.value = '';
});
function rmImg(i) {
  S.imgs.splice(i,1);
  const t = document.getElementById('ithumbs');
  if(t) t.innerHTML = S.imgs.map((img,j)=>`<div class="thumb"><img src="${img.data}" alt=""><button onclick="rmImg(${j})">×</button></div>`).join('');
}

// ─── EXPORT ───────────────────────────────────────────────
function expJSON() {
  const data = S.equipamentos.map(e => ({
    PTM:e.ptm, SERIE:e.serie, LOJA:bid(S.filiais,e.filialId)?.nome||'',
    FABRICANTE:bid(S.fabricantes,e.fabId)?.nome||'', MODELO:bid(S.modelos,e.modeloId)?.nome||'',
    DT_AQUISICAO:e.dtAq, CAPACIDADE:e.cap, DIVISAO:e.div, LOCALIZACAO:e.loc,
    STATUS:e.status, FONTE:e.fonte, TECNICO:bid(S.tecnicos,e.tecId)?.nome||'',
    OBSERVACAO:e.obs, DT_ATUALIZACAO:e.dtAt
  }));
  const b = new Blob([JSON.stringify({exportado:tod(),total:data.length,equipamentos:data},null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`inventario_${tod()}.json`; a.click();
}
function expXLSX() {
  const eq = S.equipamentos.map(e=>({'PTM':e.ptm,'LOJA':bid(S.filiais,e.filialId)?.nome||'','FABRICANTE':bid(S.fabricantes,e.fabId)?.nome||'','MODELO':bid(S.modelos,e.modeloId)?.nome||'','SÉRIE':e.serie,'DT AQUISIÇÃO':e.dtAq,'CAPACIDADE':e.cap,'DIVISÃO':e.div,'LOCALIZAÇÃO':e.loc,'STATUS':e.status,'FONTE':e.fonte,'TÉCNICO':bid(S.tecnicos,e.tecId)?.nome||'','OBSERVAÇÃO':e.obs,'DT ATUALIZAÇÃO':e.dtAt}));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(eq);
  ws['!cols'] = [10,22,14,18,14,13,18,12,13,14,16,18,30,14].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,'Inventário');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.filiais.map(f=>({ID:f.id,NOME:f.nome,'CÓDIGO':f.cod}))),'Filiais');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.fabricantes.map(f=>({ID:f.id,NOME:f.nome}))),'Fabricantes');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S.modelos.map(m=>({ID:m.id,NOME:m.nome,FABRICANTE:bid(S.fabricantes,m.fabId)?.nome||''}))),'Modelos');
  XLSX.writeFile(wb,`inventario_${tod()}.xlsx`);
}

// ─── ADMINISTRAÇÃO ────────────────────────────────────────
function adminTabs() {
  return [
    ['filiais','🏢 Filiais'],['fabricantes','🏭 Fabricantes'],
    ['modelos','🖥️ Modelos'],['tecnicos','👤 Técnicos'],['usuarios','🔐 Usuários']
  ];
}

function renderAdmin() {
  document.getElementById('ct').innerHTML = `
    <div class="ptitle" style="margin-bottom:14px">Administração</div>
    <div class="tabs">${adminTabs().map(([id,lb])=>`<button class="tb${S.atab===id?' on':''}" onclick="S.atab='${id}';renderATab()">${lb}</button>`).join('')}</div>
    <div id="atbl"></div>`;
  renderATab();
}

function renderATab() {
  const tbl = document.getElementById('atbl'); if(!tbl) return;
  const act  = (tp,id) => `<div style="display:flex;gap:3px">
    <button class="btn bsm be" onclick="editA('${tp}',${id})">✏️</button>
    <button class="btn bsm bd" onclick="delA('${tp}',${id})">🗑</button></div>`;
  const aTbl = (cols,rows,tp) => `
    <div class="phd" style="margin-bottom:12px">
      <span style="font-size:14px;font-weight:700;color:#374151"></span>
      <button class="btn bp" onclick="addA('${tp}')">+ Adicionar</button>
    </div>
    <div class="twrap"><table>
      <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols.length+1}" style="text-align:center;padding:24px;color:#94a3b8">Nenhum registro</td></tr>`}</tbody>
    </table></div>`;

  const tp = S.atab;
  if      (tp==='filiais')     tbl.innerHTML = aTbl(['Nome','Código'], S.filiais.map(f=>`<tr><td>${esc(f.nome)}</td><td>${esc(f.cod)}</td><td>${act('filiais',f.id)}</td></tr>`).join(''), tp);
  else if (tp==='fabricantes') tbl.innerHTML = aTbl(['Nome'], S.fabricantes.map(f=>`<tr><td>${esc(f.nome)}</td><td>${act('fabricantes',f.id)}</td></tr>`).join(''), tp);
  else if (tp==='modelos')     tbl.innerHTML = aTbl(['Nome','Fabricante'], S.modelos.map(m=>`<tr><td>${esc(m.nome)}</td><td>${esc(bid(S.fabricantes,m.fabId)?.nome||'—')}</td><td>${act('modelos',m.id)}</td></tr>`).join(''), tp);
  else if (tp==='tecnicos')    tbl.innerHTML = aTbl(['Nome','Email','Telefone'], S.tecnicos.map(t=>`<tr><td>${esc(t.nome)}</td><td>${esc(t.email)}</td><td>${esc(t.tel||'—')}</td><td>${act('tecnicos',t.id)}</td></tr>`).join(''), tp);
  else if (tp==='usuarios')    tbl.innerHTML = aTbl(['Nome','Email','Perfil','Status'],
    S.usuarios.map(u=>`<tr>
      <td>${esc(u.nome)}</td><td>${esc(u.email)}</td>
      <td>${u.perfil==='admin'?'<span class="badge sa">Admin</span>':'<span class="badge sr">Visualizador</span>'}</td>
      <td>${u.ativo?'<span class="badge sa">Ativo</span>':'<span class="badge sd">Inativo</span>'}</td>
      <td>${act('usuarios',u.id)}</td></tr>`).join(''), tp);
}

function addA(tp)  { S.eaTab=tp; S.eaId=null; openM('Adicionar', aForm(tp,null)); }
function editA(tp,id) {
  S.eaTab=tp; S.eaId=id;
  const arr = { filiais:S.filiais, fabricantes:S.fabricantes, modelos:S.modelos, tecnicos:S.tecnicos, usuarios:S.usuarios }[tp];
  openM('Editar', aForm(tp, arr.find(x=>x.id===id)));
}

function aForm(tp, d) {
  const v    = k => esc(d ? d[k]||'' : '');
  const fabs = S.fabricantes.map(f=>`<option value="${f.id}"${d&&String(d.fabId)===String(f.id)?' selected':''}>${esc(f.nome)}</option>`).join('');
  const btns = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
    <button class="btn bgh" onclick="closeModal()">Cancelar</button>
    <button class="btn bp" onclick="saveA()">Salvar</button></div>`;
  const body = {
    filiais:      `<div class="fg"><div class="fl"><label>Nome da Filial *</label><input class="inp" id="af1" value="${v('nome')}"></div><div class="fl"><label>Código *</label><input class="inp" id="af2" value="${v('cod')}"></div></div>`,
    fabricantes:  `<div class="fl"><label>Nome do Fabricante *</label><input class="inp" id="af1" value="${v('nome')}"></div>`,
    modelos:      `<div class="fg"><div class="fl"><label>Nome do Modelo *</label><input class="inp" id="af1" value="${v('nome')}"></div><div class="fl"><label>Fabricante *</label><select class="inp" id="af2"><option value="">Selecione…</option>${fabs}</select></div></div>`,
    tecnicos:     `<div class="fg"><div class="fl"><label>Nome *</label><input class="inp" id="af1" value="${v('nome')}"></div><div class="fl"><label>Email *</label><input type="email" class="inp" id="af2" value="${v('email')}"></div><div class="fl s2"><label>Telefone</label><input class="inp" id="af3" value="${v('tel')}"></div></div>`,
    usuarios:     `<div class="fg">
      <div class="fl"><label>Nome *</label><input class="inp" id="af1" value="${v('nome')}"></div>
      <div class="fl"><label>Email *</label><input type="email" class="inp" id="af2" value="${v('email')}"></div>
      <div class="fl"><label>Perfil</label><select class="inp" id="af3">
        <option value="viewer"${!d||d.perfil!=='admin'?' selected':''}>Visualizador</option>
        <option value="admin"${d?.perfil==='admin'?' selected':''}>Administrador</option>
      </select></div>
      <div class="fl"><label>Status</label><select class="inp" id="af4">
        <option value="1"${!d||d.ativo!==0?' selected':''}>Ativo</option>
        <option value="0"${d?.ativo===0?' selected':''}>Inativo</option>
      </select></div>
      <div class="fl s2"><label>Senha${d?' (em branco = sem alteração)':' *'}</label>
        <input type="password" class="inp" id="af5" placeholder="${d?'Nova senha (opcional)':'Senha inicial'}">
      </div></div>`,
  }[tp] || '';
  return body + btns;
}

async function saveA() {
  const g = id => document.getElementById(id)?.value || '';
  const tp = S.eaTab;
  let body = {};
  if      (tp==='filiais')     { if(!g('af1')||!g('af2')){alert('Preencha todos os campos');return;} body={nome:g('af1'),cod:g('af2')}; }
  else if (tp==='fabricantes') { if(!g('af1')){alert('Nome obrigatório');return;} body={nome:g('af1')}; }
  else if (tp==='modelos')     { if(!g('af1')||!g('af2')){alert('Preencha todos os campos');return;} body={nome:g('af1'),fabId:+g('af2')}; }
  else if (tp==='tecnicos')    { if(!g('af1')||!g('af2')){alert('Nome e email obrigatórios');return;} body={nome:g('af1'),email:g('af2'),tel:g('af3')}; }
  else if (tp==='usuarios')    {
    if(!g('af1')||!g('af2')){alert('Nome e email obrigatórios');return;}
    if(!S.eaId&&!g('af5')){alert('Senha obrigatória para novo usuário');return;}
    body = {nome:g('af1'),email:g('af2'),perfil:g('af3')||'viewer',ativo:g('af4')!=='0'};
    if(g('af5')) body.senha = g('af5');
  }
  const url  = S.eaId ? `/api/${tp}/${S.eaId}` : `/api/${tp}`;
  const meth = S.eaId ? 'PUT' : 'POST';
  await apiFetch(url, { method:meth, body:JSON.stringify(body) });
  closeModal(); await loadAll(); renderAdmin();
}

async function delA(tp, id) {
  if (tp==='usuarios' && id===AUTH?.id) { alert('Você não pode remover seu próprio usuário'); return; }
  const arr  = {filiais:S.filiais,fabricantes:S.fabricantes,modelos:S.modelos,tecnicos:S.tecnicos,usuarios:S.usuarios}[tp];
  const item = arr?.find(x=>x.id===id);
  if (!confirm(`Remover "${esc(item?.nome||item?.email)}"?`)) return;
  await apiFetch(`/api/${tp}/${id}`, { method:'DELETE' });
  await loadAll(); renderAdmin();
}

// ─── MODELO ER ────────────────────────────────────────────
function renderER() {
  document.getElementById('ct').innerHTML = `
    <div class="ptitle" style="margin-bottom:6px">Modelo Entidade-Relacionamento</div>
    <p style="font-size:13px;color:#64748b;margin-bottom:14px">Diagrama conceitual das entidades e seus relacionamentos</p>
    <div class="card" style="overflow-x:auto">${erSVG()}</div>
    <div style="margin-top:12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:12px 16px">
      <p style="font-size:12px;font-weight:700;color:#4338ca;margin-bottom:7px">Legenda</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px;color:#4338ca">
        <span>🔑 Chave Primária (PK)</span><span>🔗 Chave Estrangeira (FK)</span><span>- - Relacionamento</span>
        <span>1:N — Um para muitos</span><span>N:1 — Muitos para um</span><span>Seta indica direção</span>
      </div>
    </div>`;
}

function erSVG() {
  const E = [
    {x:275,y:90,w:245,t:'EQUIPAMENTO',pk:'ptm (PK)',a:['numero_serie','dt_aquisicao','capacidade','divisao','localizacao','status','fonte','observacao','dt_atualizacao','filial_id → FK','fabricante_id → FK','modelo_id → FK','tecnico_id → FK']},
    {x:10,y:20,w:188,t:'FILIAL',pk:'id (PK)',a:['nome','codigo']},
    {x:570,y:20,w:175,t:'FABRICANTE',pk:'id (PK)',a:['nome']},
    {x:570,y:205,w:175,t:'MODELO',pk:'id (PK)',a:['nome','fabricante_id → FK']},
    {x:10,y:290,w:188,t:'TÉCNICO',pk:'id (PK)',a:['nome','email','telefone']},
    {x:10,y:500,w:188,t:'USUÁRIO',pk:'id (PK)',a:['nome','email','senha_hash','perfil','ativo']},
    {x:275,y:555,w:245,t:'IMAGEM',pk:'id (PK)',a:['nome_arquivo','dados_base64','equipamento_id → FK']},
  ];
  const RH=18,HD=30,PK=22;
  const eh=e=>HD+PK+e.a.length*RH, ex=e=>e.x+e.w/2, ey=e=>e.y+eh(e)/2;
  const lines=[
    {a:E[1],b:E[0],la:'N',lb:'1',m:'pertence a'},
    {a:E[2],b:E[3],la:'1',lb:'N',m:'possui'},
    {a:E[3],b:E[0],la:'N',lb:'1',m:'classifica'},
    {a:E[4],b:E[0],la:'N',lb:'1',m:'gerencia'},
    {a:E[0],b:E[6],la:'1',lb:'N',m:'contém'},
  ];
  const ls=lines.map(({a,b,la,lb,m})=>{
    const x1=ex(a),y1=ey(a),x2=ex(b),y2=ey(b),mx=(x1+x2)/2,my=(y1+y2)/2;
    return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a5b4fc" stroke-width="2" stroke-dasharray="6,3" marker-end="url(#arr)"/>
      <rect x="${mx-28}" y="${my-9}" width="56" height="18" rx="4" fill="white" stroke="#c7d2fe" stroke-width="1"/>
      <text x="${mx}" y="${my+4}" text-anchor="middle" fill="#4f46e5" font-size="10" font-weight="600">${esc(m)}</text>
      <text x="${x1+(x2-x1)*.13}" y="${y1+(y2-y1)*.13-7}" fill="#6366f1" font-size="11" font-weight="700">${la}</text>
      <text x="${x1+(x2-x1)*.87}" y="${y1+(y2-y1)*.87-7}" fill="#6366f1" font-size="11" font-weight="700">${lb}</text>
    </g>`;
  }).join('');
  const es=E.map(e=>{
    const h=eh(e);
    const ats=e.a.map((at,i)=>{const ay=e.y+HD+PK+i*RH,fk=at.includes('→');return`<g><rect x="${e.x}" y="${ay}" width="${e.w}" height="${RH}" fill="${i%2===0?'#f9fafb':'white'}"/><line x1="${e.x}" y1="${ay}" x2="${e.x+e.w}" y2="${ay}" stroke="#e5e7eb" stroke-width=".5"/><text x="${e.x+9}" y="${ay+13}" fill="${fk?'#7c3aed':'#374151'}" font-size="10" font-style="${fk?'italic':'normal'}">${fk?'🔗 ':''}${esc(at)}</text></g>`;}).join('');
    return `<g>
      <rect x="${e.x}" y="${e.y}" width="${e.w}" height="${h}" rx="8" fill="white" stroke="#6366f1" stroke-width="1.5"/>
      <rect x="${e.x}" y="${e.y}" width="${e.w}" height="${HD}" rx="8" fill="#4f46e5"/>
      <rect x="${e.x}" y="${e.y+HD-6}" width="${e.w}" height="6" fill="#4f46e5"/>
      <text x="${e.x+e.w/2}" y="${e.y+19}" text-anchor="middle" fill="white" font-size="12" font-weight="700">${esc(e.t)}</text>
      <rect x="${e.x}" y="${e.y+HD}" width="${e.w}" height="${PK}" fill="#eef2ff"/>
      <text x="${e.x+9}" y="${e.y+HD+15}" fill="#4338ca" font-size="11" font-weight="700">🔑 ${esc(e.pk)}</text>
      ${ats}
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 790 760" style="width:100%;min-width:600px;font-family:'Segoe UI',sans-serif">
    <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/></marker></defs>
    ${ls}${es}
  </svg>`;
}

// ─── DOCS ─────────────────────────────────────────────────
function renderDocs() {
  document.getElementById('ct').innerHTML = `<div class="card rm">
<h1>📋 InventárioTI — Documentação</h1>
<p style="color:#64748b;margin-bottom:4px">Guia de utilização, autenticação e banco de dados local</p>
<h2>🔐 Autenticação</h2>
<p>O sistema usa tokens gerados no login e enviados em cada requisição via <code>Authorization: Bearer &lt;token&gt;</code>.</p>
<ul>
  <li><strong>Admin</strong> — acesso total: cadastrar, editar, remover equipamentos e itens de administração, gerenciar usuários</li>
  <li><strong>Visualizador</strong> — acesso somente leitura: ver dashboard, inventário e exportar JSON/XLSX</li>
</ul>
<div class="note">👤 Credencial padrão: <code>admin@empresa.com</code> / <code>admin123</code> — altere após o primeiro acesso!</div>
<h2>🚀 Como Utilizar</h2>
<ol>
  <li><strong>Administração → Filiais</strong>: cadastre as lojas/unidades</li>
  <li><strong>Fabricantes</strong>: cadastre os fabricantes</li>
  <li><strong>Modelos</strong>: cadastre vinculados aos fabricantes</li>
  <li><strong>Técnicos</strong>: cadastre os responsáveis</li>
  <li><strong>Usuários</strong>: crie contas para a equipe</li>
  <li><strong>Inventário → + Novo Equipamento</strong>: registre os ativos</li>
</ol>
<h2>🗄️ Banco de Dados — Instalação</h2>
<pre>mkdir inventario-api && cd inventario-api
npm init -y
npm install express better-sqlite3 bcryptjs cors
# coloque index.html, server.js e schema.sql nesta pasta
node server.js
# Acesse: http://localhost:3000</pre>
<h2>📁 Estrutura</h2>
<pre>inventario-api/
 ├── index.html   ← frontend (este arquivo)
 ├── server.js    ← API REST + autenticação
 ├── schema.sql   ← DDL das tabelas
 ├── inventario.db← banco SQLite (gerado automaticamente)
 └── package.json</pre>
<div class="note">💡 Para MySQL: substitua <code>better-sqlite3</code> por <code>mysql2</code> e <code>AUTOINCREMENT</code> por <code>AUTO_INCREMENT</code>.</div>
</div>`;
}
