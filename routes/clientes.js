const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// Listar todos os clientes
router.get('/', (req, res) => {
  const query = 'SELECT * FROM clientes WHERE ativo = 1 ORDER BY nome';
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        clientes: rows,
        total: rows.length
      });
    }
  });
});

// Buscar cliente por ID
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const query = 'SELECT * FROM clientes WHERE id = ? AND ativo = 1';
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Erro ao buscar cliente:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else if (!row) {
      res.status(404).json({ error: 'Cliente não encontrado' });
    } else {
      res.json({
        success: true,
        cliente: row
      });
    }
  });
});

// Cadastrar novo cliente
router.post('/', (req, res) => {
  const { nome, telefone } = req.body;
  
  // Validações
  if (!nome) {
    return res.status(400).json({ 
      error: 'Nome é obrigatório' 
    });
  }
  
  if (nome.length < 2) {
    return res.status(400).json({ 
      error: 'Nome deve ter pelo menos 2 caracteres' 
    });
  }
  
  const query = `
    INSERT INTO clientes (nome, telefone)
    VALUES (?, ?)
  `;
  
  db.run(query, [nome, telefone || null], function(err) {
    if (err) {
      console.error('Erro ao cadastrar cliente:', err);
      res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    } else {
      res.status(201).json({
        success: true,
        message: 'Cliente cadastrado com sucesso',
        cliente: {
          id: this.lastID,
          nome,
          telefone
        }
      });
    }
  });
});

// Atualizar cliente
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { nome, telefone } = req.body;
  
  // Validações
  if (!nome) {
    return res.status(400).json({ 
      error: 'Nome é obrigatório' 
    });
  }
  
  const query = `
    UPDATE clientes 
    SET nome = ?, telefone = ?
    WHERE id = ? AND ativo = 1
  `;
  
  db.run(query, [nome, telefone || null, id], function(err) {
    if (err) {
      console.error('Erro ao atualizar cliente:', err);
      res.status(500).json({ error: 'Erro ao atualizar cliente' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Cliente não encontrado' });
    } else {
      res.json({
        success: true,
        message: 'Cliente atualizado com sucesso'
      });
    }
  });
});

// Deletar cliente (soft delete)
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const query = 'UPDATE clientes SET ativo = 0 WHERE id = ? AND ativo = 1';
  
  db.run(query, [id], function(err) {
    if (err) {
      console.error('Erro ao deletar cliente:', err);
      res.status(500).json({ error: 'Erro ao deletar cliente' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Cliente não encontrado' });
    } else {
      res.json({
        success: true,
        message: 'Cliente removido com sucesso'
      });
    }
  });
});

// Buscar histórico de compras do cliente
router.get('/:id/historico', (req, res) => {
  const clienteId = req.params.id;
  
  const query = `
    SELECT 
      v.id,
      v.tipo_venda,
      v.forma_pagamento,
      v.valor_total,
      v.status,
      v.created_at,
      GROUP_CONCAT(p.nome || ' (x' || iv.quantidade || ')') as itens
    FROM vendas v
    LEFT JOIN itens_venda iv ON v.id = iv.venda_id
    LEFT JOIN produtos p ON iv.produto_id = p.id
    WHERE v.cliente_id = ?
    GROUP BY v.id
    ORDER BY v.created_at DESC
  `;
  
  db.all(query, [clienteId], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar histórico:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        historico: rows,
        total: rows.length
      });
    }
  });
});

module.exports = router;
