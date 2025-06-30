const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// Relatório do dia atual
router.get('/diario', (req, res) => {
  const { data } = req.query;
  const dataConsulta = data || new Date().toISOString().split('T')[0];

  const query = `
    SELECT 
      forma_pagamento,
      SUM(valor_total) as total,
      COUNT(*) as quantidade,
      tipo_venda
    FROM vendas 
    WHERE DATE(created_at) = ?
    GROUP BY forma_pagamento, tipo_venda
  `;

  db.all(query, [dataConsulta], (err, rows) => {
    if (err) {
      console.error('Erro ao gerar relatório:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      let totalDinheiro = 0,
        totalCartao = 0,
        totalPix = 0;
      let vendasNormais = 0,
        vendasNota = 0;

      rows.forEach(row => {
        switch (row.forma_pagamento) {
          case 'dinheiro':
            totalDinheiro += row.total;
            break;
          case 'cartao':
            totalCartao += row.total;
            break;
          case 'pix':
            totalPix += row.total;
            break;
        }

        if (row.tipo_venda === 'normal') vendasNormais += row.quantidade;
        if (row.tipo_venda === 'nota') vendasNota += row.quantidade;
      });

      const totalGeral = totalDinheiro + totalCartao + totalPix;

      res.json({
        success: true,
        data: dataConsulta,
        relatorio: {
          total_dinheiro: totalDinheiro,
          total_cartao: totalCartao,
          total_pix: totalPix,
          total_geral: totalGeral,
          vendas_normais: vendasNormais,
          vendas_nota: vendasNota,
          detalhes: rows
        }
      });
    }
  });
});

// Relatório mensal
router.get('/mensal', (req, res) => {
  const { mes, ano } = req.query;
  const mesAtual = mes || (new Date().getMonth() + 1).toString().padStart(2, '0');
  const anoAtual = ano || new Date().getFullYear().toString();

  const query = `
    SELECT 
      DATE(created_at) as data,
      forma_pagamento,
      tipo_venda,
      SUM(valor_total) as total,
      COUNT(*) as quantidade
    FROM vendas 
    WHERE strftime('%Y-%m', created_at) = ?
    GROUP BY DATE(created_at), forma_pagamento, tipo_venda
    ORDER BY data DESC
  `;

  db.all(query, [`${anoAtual}-${mesAtual}`], (err, rows) => {
    if (err) {
      console.error('Erro ao gerar relatório mensal:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      // Agrupar por data
      const relatorioMensal = {};
      let totalGeralMes = 0;

      rows.forEach(row => {
        if (!relatorioMensal[row.data]) {
          relatorioMensal[row.data] = {
            data: row.data,
            total_dinheiro: 0,
            total_cartao: 0,
            total_pix: 0,
            total_dia: 0,
            vendas_normais: 0,
            vendas_nota: 0
          };
        }

        relatorioMensal[row.data][`total_${row.forma_pagamento}`] += row.total;
        relatorioMensal[row.data].total_dia += row.total;
        relatorioMensal[row.data][`vendas_${row.tipo_venda}`] += row.quantidade;

        totalGeralMes += row.total;
      });

      res.json({
        success: true,
        periodo: `${mesAtual}/${anoAtual}`,
        total_geral_mes: totalGeralMes,
        dias: Object.values(relatorioMensal)
      });
    }
  });
});

// Relatório de produtos mais vendidos
router.get('/produtos-mais-vendidos', (req, res) => {
  const { data_inicio, data_fim, limite = 10 } = req.query;

  let query = `
    SELECT 
      p.id,
      p.nome,
      SUM(iv.quantidade) as total_vendido,
      SUM(iv.subtotal) as receita_total,
      AVG(iv.preco_unitario) as preco_medio
    FROM itens_venda iv
    JOIN produtos p ON iv.produto_id = p.id
    JOIN vendas v ON iv.venda_id = v.id
    WHERE 1=1
  `;

  const params = [];

  if (data_inicio) {
    query += ' AND DATE(v.created_at) >= ?';
    params.push(data_inicio);
  }

  if (data_fim) {
    query += ' AND DATE(v.created_at) <= ?';
    params.push(data_fim);
  }

  query += `
    GROUP BY p.id, p.nome
    ORDER BY total_vendido DESC
    LIMIT ?
  `;

  params.push(parseInt(limite));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Erro ao gerar relatório de produtos:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        periodo: {
          data_inicio: data_inicio || 'início',
          data_fim: data_fim || 'hoje'
        },
        produtos: rows
      });
    }
  });
});

// Relatório de clientes que mais compram
router.get('/clientes-mais-ativos', (req, res) => {
  const { data_inicio, data_fim, limite = 10 } = req.query;

  let query = `
    SELECT 
      c.id,
      c.nome,
      c.telefone,
      COUNT(v.id) as total_compras,
      SUM(v.valor_total) as valor_total_compras,
      AVG(v.valor_total) as ticket_medio,
      MAX(v.created_at) as ultima_compra
    FROM clientes c
    JOIN vendas v ON c.id = v.cliente_id
    WHERE c.ativo = 1
  `;

  const params = [];

  if (data_inicio) {
    query += ' AND DATE(v.created_at) >= ?';
    params.push(data_inicio);
  }

  if (data_fim) {
    query += ' AND DATE(v.created_at) <= ?';
    params.push(data_fim);
  }

  query += `
    GROUP BY c.id, c.nome, c.telefone
    ORDER BY total_compras DESC
    LIMIT ?
  `;

  params.push(parseInt(limite));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Erro ao gerar relatório de clientes:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        periodo: {
          data_inicio: data_inicio || 'início',
          data_fim: data_fim || 'hoje'
        },
        clientes: rows
      });
    }
  });
});

// Relatório de vendas pendentes (notas não pagas)
router.get('/vendas-pendentes', (req, res) => {
  const query = `
    SELECT 
      v.*,
      c.nome as cliente_nome,
      c.telefone as cliente_telefone,
      GROUP_CONCAT(p.nome || ' (x' || iv.quantidade || ')') as itens,
      julianday('now') - julianday(v.created_at) as dias_pendente
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    LEFT JOIN itens_venda iv ON v.id = iv.venda_id
    LEFT JOIN produtos p ON iv.produto_id = p.id
    WHERE v.tipo_venda = 'nota' AND v.status = 'pendente'
    GROUP BY v.id
    ORDER BY v.created_at ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar vendas pendentes:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      const totalPendente = rows.reduce((total, venda) => total + venda.valor_total, 0);

      res.json({
        success: true,
        total_pendente: totalPendente,
        quantidade_vendas: rows.length,
        vendas: rows
      });
    }
  });
});

module.exports = router;
