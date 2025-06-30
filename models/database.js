const sqlite3 = require('sqlite3').verbose();

// Criar conexão com o banco
const db = new sqlite3.Database('vendas.db', err => {
  if (err) {
    console.error('Erro ao conectar com o banco:', err.message);
  } else {
    console.log('✅ Conectado ao banco SQLite');
  }
});

// Função para criar todas as tabelas
function criarTabelas() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de produtos
      db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        preco_normal REAL NOT NULL,
        preco_nota REAL NOT NULL,
        estoque INTEGER DEFAULT 0,
        ativo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de clientes
      db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT,
        telefone TEXT,
        endereco TEXT,
        ativo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Tabela de vendas
      db.run(`CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        tipo_venda TEXT NOT NULL,
        forma_pagamento TEXT NOT NULL,
        valor_total REAL NOT NULL,
        status TEXT DEFAULT 'pendente',
        observacoes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes (id)
      )`);

      // Tabela de itens da venda
      db.run(`CREATE TABLE IF NOT EXISTS itens_venda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venda_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_unitario REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (venda_id) REFERENCES vendas (id),
        FOREIGN KEY (produto_id) REFERENCES produtos (id)
      )`);

      // Tabela de relatórios diários
      db.run(
        `CREATE TABLE IF NOT EXISTS relatorios_diarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data DATE NOT NULL UNIQUE,
        total_dinheiro REAL DEFAULT 0,
        total_cartao REAL DEFAULT 0,
        total_pix REAL DEFAULT 0,
        total_geral REAL DEFAULT 0,
        vendas_normais INTEGER DEFAULT 0,
        vendas_nota INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
        err => {
          if (err) {
            console.error('Erro ao criar tabelas:', err);
            reject(err);
          } else {
            console.log('✅ Tabelas criadas/verificadas');
            resolve();
          }
        }
      );
    });
  });
}

// Função para fechar conexão
function fecharConexao() {
  return new Promise(resolve => {
    db.close(err => {
      if (err) {
        console.error('Erro ao fechar banco:', err.message);
      } else {
        console.log('🔐 Conexão com banco fechada');
      }
      resolve();
    });
  });
}

module.exports = {
  db,
  criarTabelas,
  fecharConexao
};
