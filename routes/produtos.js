const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// Listar todos os produtos
router.get('/', (req, res) => {
  const query = 'SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome';

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar produtos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        produtos: rows,
        total: rows.length
      });
    }
  });
});

// Buscar produto por ID
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const query = 'SELECT * FROM produtos WHERE id = ? AND ativo = 1';

  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Erro ao buscar produto:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else if (!row) {
      res.status(404).json({ error: 'Produto não encontrado' });
    } else {
      res.json({
        success: true,
        produto: row
      });
    }
  });
});

// Cadastrar novo produto
router.post('/', (req, res) => {
  const { nome, preco_normal, preco_nota, estoque = 0 } = req.body;

  // Validações
  if (!nome || !preco_normal || !preco_nota) {
    return res.status(400).json({
      error: 'Nome, preço normal e preço nota são obrigatórios'
    });
  }

  if (preco_normal <= 0 || preco_nota <= 0) {
    return res.status(400).json({
      error: 'Preços devem ser maiores que zero'
    });
  }

  const query = `
    INSERT INTO produtos (nome, preco_normal, preco_nota, estoque)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [nome, preco_normal, preco_nota, estoque], function (err) {
    if (err) {
      console.error('Erro ao cadastrar produto:', err);
      res.status(500).json({ error: 'Erro ao cadastrar produto' });
    } else {
      res.status(201).json({
        success: true,
        message: 'Produto cadastrado com sucesso',
        produto: {
          id: this.lastID,
          nome,
          preco_normal,
          preco_nota,
          estoque
        }
      });
    }
  });
});

// Atualizar produto
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nome, preco_normal, preco_nota, estoque } = req.body;

  // Validações
  if (!nome || !preco_normal || !preco_nota) {
    return res.status(400).json({
      error: 'Nome, preço normal e preço nota são obrigatórios'
    });
  }

  const query = `
    UPDATE produtos 
    SET nome = ?, preco_normal = ?, preco_nota = ?, estoque = ?
    WHERE id = ? AND ativo = 1
  `;

  db.run(query, [nome, preco_normal, preco_nota, estoque, id], function (err) {
    if (err) {
      console.error('Erro ao atualizar produto:', err);
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
    } else {
      res.json({
        success: true,
        message: 'Produto atualizado com sucesso'
      });
    }
  });
});

// Deletar produto (soft delete)
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const query = 'UPDATE produtos SET ativo = 0 WHERE id = ? AND ativo = 1';

  db.run(query, [id], function (err) {
    if (err) {
      console.error('Erro ao deletar produto:', err);
      res.status(500).json({ error: 'Erro ao deletar produto' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
    } else {
      res.json({
        success: true,
        message: 'Produto removido com sucesso'
      });
    }
  });
});

module.exports = router;
