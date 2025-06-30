const express = require('express');
const router = express.Router();
const { db } = require('../models/database');

// Função para enviar mensagem WhatsApp
async function enviarWhatsAppNota(venda, cliente, itens) {
  try {
    const itensTexto = itens.map(item => 
      `• ${item.produto_nome} (x${item.quantidade}) - R$ ${item.subtotal.toFixed(2)}`
    ).join('\n');
    
    const mensagem = `
🛒 *NOVA VENDA NA NOTA*

👤 Cliente: ${cliente?.nome || 'Cliente não cadastrado'}
📞 Telefone: ${cliente?.telefone || 'Não informado'}

📦 *Itens:*
${itensTexto}

💰 *Total: R$ ${venda.valor_total.toFixed(2)}*
📅 Data: ${new Date(venda.created_at).toLocaleString('pt-BR')}

⚠️ *Venda realizada na nota - acompanhar pagamento*
    `.trim();

    console.log('📱 Mensagem WhatsApp:', mensagem);
    
    // Aqui você pode integrar com a API do WhatsApp
    // Por exemplo: WhatsApp Business API, Twilio, etc.
    
    return { success: true, mensagem };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

// Listar todas as vendas
router.get('/', (req, res) => {
  const { tipo_venda, forma_pagamento, status, data } = req.query;
  
  let query = `
    SELECT 
      v.*,
      c.nome as cliente_nome,
      GROUP_CONCAT(p.nome || ' (x' || iv.quantidade || ')') as itens
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    LEFT JOIN itens_venda iv ON v.id = iv.venda_id
    LEFT JOIN produtos p ON iv.produto_id = p.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (tipo_venda) {
    query += ' AND v.tipo_venda = ?';
    params.push(tipo_venda);
  }
  
  if (forma_pagamento) {
    query += ' AND v.forma_pagamento = ?';
    params.push(forma_pagamento);
  }
  
  if (status) {
    query += ' AND v.status = ?';
    params.push(status);
  }
  
  if (data) {
    query += ' AND DATE(v.created_at) = ?';
    params.push(data);
  }
  
  query += ' GROUP BY v.id ORDER BY v.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Erro ao buscar vendas:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json({
        success: true,
        vendas: rows,
        total: rows.length
      });
    }
  });
});

// Buscar venda por ID
router.get('/:id', (req, res) => {
  const id = req.params.id;
  
  const query = `
    SELECT 
      v.*,
      c.nome as cliente_nome,
      c.telefone as cliente_telefone
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.id = ?
  `;
  
  db.get(query, [id], (err, venda) => {
    if (err) {
      console.error('Erro ao buscar venda:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else if (!venda) {
      res.status(404).json({ error: 'Venda não encontrada' });
    } else {
      // Buscar itens da venda
      const queryItens = `
        SELECT 
          iv.*,
          p.nome as produto_nome
        FROM itens_venda iv
        JOIN produtos p ON iv.produto_id = p.id
        WHERE iv.venda_id = ?
      `;
      
      db.all(queryItens, [id], (err, itens) => {
        if (err) {
          console.error('Erro ao buscar itens:', err);
          res.status(500).json({ error: 'Erro interno do servidor' });
        } else {
          res.json({
            success: true,
            venda: {
              ...venda,
              itens: itens
            }
          });
        }
      });
    }
  });
});

// Registrar nova venda
router.post('/', (req, res) => {
  const { 
    cliente_id, 
    tipo_venda, 
    forma_pagamento, 
    itens, 
    observacoes,
    data_pagamento
  } = req.body;
  
  // Validações
  if (!tipo_venda || !forma_pagamento || !itens || itens.length === 0) {
    return res.status(400).json({ 
      error: 'Tipo de venda, forma de pagamento e itens são obrigatórios' 
    });
  }
  
  if (!['normal', 'nota'].includes(tipo_venda)) {
    return res.status(400).json({ 
      error: 'Tipo de venda deve ser "normal" ou "nota"' 
    });
  }
  
  if (!['dinheiro', 'cartao', 'pix'].includes(forma_pagamento)) {
    return res.status(400).json({ 
      error: 'Forma de pagamento deve ser "dinheiro", "cartao" ou "pix"' 
    });
  }
  
  // Função para calcular diferença em dias
  function calcularDiasParaPagamento(dataPagamento) {
    if (!dataPagamento) return null;
    
    const hoje = new Date();
    const dataPageto = new Date(dataPagamento);
    const diffTime = dataPageto - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  // Calcular valor total
  let valorTotal = 0;
  let produtosProcessados = 0;
  let produtosValidados = [];
  
  // Validar cada produto
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const { produto_id, quantidade } = item;
    
    if (!produto_id || !quantidade || quantidade <= 0) {
      return res.status(400).json({ 
        error: 'Produto ID e quantidade são obrigatórios e quantidade deve ser maior que 0' 
      });
    }
    
    // Buscar produto
    db.get('SELECT * FROM produtos WHERE id = ? AND ativo = 1', [produto_id], (err, produto) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao validar produto' });
      }
      
      if (!produto) {
        return res.status(400).json({ error: `Produto ID ${produto_id} não encontrado` });
      }
      
      // Calcular preço baseado no tipo de venda e data de pagamento
      let precoUnitario;
      
      if (tipo_venda === 'normal') {
        precoUnitario = produto.preco_normal;
      } else if (tipo_venda === 'nota') {
        const diasParaPagamento = calcularDiasParaPagamento(data_pagamento);
        
        // Se data de pagamento for <= 10 dias ou não informada, usar preço normal
        if (diasParaPagamento === null || diasParaPagamento <= 10) {
          precoUnitario = produto.preco_normal;
        } else {
          precoUnitario = produto.preco_nota;
        }
      }
      
      const subtotal = precoUnitario * quantidade;
      
      produtosValidados.push({
        produto_id,
        quantidade,
        preco_unitario: precoUnitario,
        subtotal,
        produto_nome: produto.nome
      });
      
      valorTotal += subtotal;
      produtosProcessados++;
      
      // Se todos os produtos foram processados
      if (produtosProcessados === itens.length) {
        processarVenda();
      }
    });
  }
  
  function processarVenda() {
    // Inserir venda
    const queryVenda = `
      INSERT INTO vendas (cliente_id, tipo_venda, forma_pagamento, valor_total, data_pagamento, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(queryVenda, [cliente_id || null, tipo_venda, forma_pagamento, valorTotal, data_pagamento || null, observacoes || null], function(err) {
      if (err) {
        console.error('Erro ao inserir venda:', err);
        return res.status(500).json({ error: 'Erro ao registrar venda' });
      }
      
      const vendaId = this.lastID;
      let itensInseridos = 0;
      
      // Inserir itens da venda
      produtosValidados.forEach(item => {
        const queryItem = `
          INSERT INTO itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(queryItem, [vendaId, item.produto_id, item.quantidade, item.preco_unitario, item.subtotal], (err) => {
          if (err) {
            console.error('Erro ao inserir item:', err);
            return res.status(500).json({ error: 'Erro ao registrar itens da venda' });
          }
          
          itensInseridos++;
          
          // Se todos os itens foram inseridos
          if (itensInseridos === produtosValidados.length) {
            const vendaCompleta = {
              id: vendaId,
              cliente_id,
              tipo_venda,
              forma_pagamento,
              valor_total: valorTotal,
              data_pagamento,
              observacoes,
              itens: produtosValidados,
              created_at: new Date().toISOString()
            };
            
            // Se for venda na nota, enviar WhatsApp
            if (tipo_venda === 'nota') {
              if (cliente_id) {
                db.get('SELECT * FROM clientes WHERE id = ?', [cliente_id], async (err, cliente) => {
                  if (!err && cliente) {
                    await enviarWhatsAppNota(vendaCompleta, cliente, produtosValidados);
                  }
                });
              } else {
                enviarWhatsAppNota(vendaCompleta, null, produtosValidados);
              }
            }
            
            res.status(201).json({
              success: true,
              message: 'Venda registrada com sucesso',
              venda: vendaCompleta
            });
          }
        });
      });
    });
  }
});

// Atualizar status da venda (para marcar como pago)
router.patch('/:id/status', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  
  if (!['pendente', 'pago'].includes(status)) {
    return res.status(400).json({ 
      error: 'Status deve ser "pendente" ou "pago"' 
    });
  }
  
  const query = 'UPDATE vendas SET status = ? WHERE id = ?';
  
  db.run(query, [status, id], function(err) {
    if (err) {
      console.error('Erro ao atualizar status:', err);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    } else if (this.changes === 0) {
      res.status(404).json({ error: 'Venda não encontrada' });
    } else {
      res.json({
        success: true,
        message: `Venda marcada como ${status}`
      });
    }
  });
});

module.exports = router;
