# InventárioTI

Sistema de gerenciamento de inventário de equipamentos de TI com interface web e API backend.

## 📋 Descrição

InventárioTI é uma aplicação web para cadastro, controle e acompanhamento de equipamentos de tecnologia da informação. O sistema permite gerenciar filiais, fabricantes, modelos, técnicos responsáveis e equipamentos com suas respectivas documentações em imagem.

## 🚀 Características

- ✅ **Autenticação segura** com tokens e criptografia bcrypt
- ✅ **Gerenciamento de equipamentos** com rastreamento completo
- ✅ **Banco de dados SQLite** para persistência local
- ✅ **Interface responsiva** em HTML/CSS/JavaScript
- ✅ **API REST** com Express.js
- ✅ **CORS habilitado** para requisições cross-origin
- ✅ **Segurança com CSP** (Content Security Policy)
- ✅ **Suporte a imagens** para documentação de equipamentos

## 📦 Requisitos

- Node.js 14+
- npm

## 🔧 Instalação

1. Clone ou extraia o projeto
2. Instale as dependências:

```bash
npm install
```

## 📝 Dependências

- **express** (^5.2.1) - Framework web
- **better-sqlite3** (^12.10.0) - Banco de dados SQLite
- **bcryptjs** (^3.0.3) - Criptografia de senhas
- **cors** (^2.8.6) - Controle de CORS

## 🎯 Uso

Inicie o servidor:

```bash
node server.js
```

O servidor será executado em `http://localhost:3000`

## 🗄️ Banco de Dados

O projeto utiliza SQLite com as seguintes tabelas:

- **filiais** - Unidades/sedes da empresa
- **fabricantes** - Marcas dos equipamentos
- **modelos** - Modelos de equipamentos
- **técnicos** - Técnicos responsáveis
- **equipamentos** - Equipamentos cadastrados (tabela principal)
- **imagens** - Documentação visual dos equipamentos

O esquema é criado automaticamente a partir do arquivo `schema.sql` ao iniciar o servidor.

## 🔐 Segurança

- ✅ Senhas criptografadas com bcryptjs
- ✅ Autenticação baseada em tokens
- ✅ Content Security Policy configurada
- ✅ Validação de entrada de dados
- ✅ Proteção contra requisições não autorizadas

## 📁 Estrutura do Projeto

```
.
├── index.html          # Interface web
├── server.js           # Servidor backend
├── schema.sql          # Esquema do banco de dados
├── package.json        # Dependências do projeto
├── README.md           # Este arquivo
├── .gitignore          # Arquivos ignorados pelo git
└── inventario.db       # Banco de dados SQLite (criado em runtime)
```

## 👤 Perfis de Usuário

O sistema suporta diferentes perfis com permissões distintas para controle de acesso.

## 📞 Contato

Para mais informações sobre o projeto, consulte a documentação do código.

---

**Desenvolvido com ❤️ para gerenciamento eficiente de equipamentos de TI**
