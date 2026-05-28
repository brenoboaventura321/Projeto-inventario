CREATE TABLE IF NOT EXISTS filiais (
  id   SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cod  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS fabricantes (
  id   SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS modelos (
  id     SERIAL PRIMARY KEY,
  nome   TEXT NOT NULL,
  fab_id INTEGER NOT NULL REFERENCES fabricantes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tecnicos (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  tel   TEXT
);

CREATE TABLE IF NOT EXISTS equipamentos (
  ptm          TEXT PRIMARY KEY,
  serie        TEXT,
  filial_id    INTEGER REFERENCES filiais(id),
  fab_id       INTEGER REFERENCES fabricantes(id),
  modelo_id    INTEGER REFERENCES modelos(id),
  dt_aquisicao TEXT,
  capacidade   TEXT,
  divisao      TEXT,
  localizacao  TEXT,
  status       TEXT NOT NULL DEFAULT 'Ativo',
  fonte        TEXT,
  tecnico_id   INTEGER REFERENCES tecnicos(id),
  observacao   TEXT,
  dt_atualiz   TEXT DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS imagens (
  id        SERIAL PRIMARY KEY,
  equip_ptm TEXT NOT NULL REFERENCES equipamentos(ptm) ON DELETE CASCADE,
  nome_arq  TEXT,
  dados     TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
  id     SERIAL PRIMARY KEY,
  nome   TEXT NOT NULL,
  email  TEXT NOT NULL UNIQUE,
  senha  TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'viewer',
  ativo  INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_eq_filial ON equipamentos(filial_id);
CREATE INDEX IF NOT EXISTS idx_eq_fab    ON equipamentos(fab_id);
CREATE INDEX IF NOT EXISTS idx_eq_status ON equipamentos(status);
CREATE INDEX IF NOT EXISTS idx_img_equip ON imagens(equip_ptm);