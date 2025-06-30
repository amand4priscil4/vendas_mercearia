console.log('🔄 Iniciando servidor...');

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

// Importar configuração do banco e rotas
const { criarTabelas, fecharConexao } = require('./models/database');
const produtosRoutes = require('./routes/produtos');
const clientesRoutes = require('./routes/clientes');
const vendasRoutes = require('./routes/vendas');
const relatoriosRoutes = require('./routes/relatorios');

console.log('✅ Dependências e módulos carregados');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do WhatsApp
const WHATSAPP_CONFIG = {
  adminPhone: '5581999999999',
  apiUrl: 'https://api.whatsapp.com/send'
};

// ==================== ROTAS PRINCIPAIS ====================

// Rota de teste
app.get('/', (req, res) => {
  res.json({
    message: 'API Sistema de Vendas funcionando!',
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Organizado',
    endpoints: {
      produtos: [
        'GET /api/produtos - Listar produtos',
        'POST /api/produtos - Cadastrar produto',
        'PUT /api/produtos/:id - Atualizar produto',
        'DELETE /api/produtos/:id - Deletar produto'
      ],
      clientes: [
        'GET /api/clientes - Listar clientes',
        'POST /api/clientes - Cadastrar cliente',
        'PUT /api/clientes/:id - Atualizar cliente',
        'DELETE /api/clientes/:id - Deletar cliente',
        'GET /api/clientes/:id/historico - Histórico do cliente'
      ],
      vendas: [
        'GET /api/vendas - Listar vendas',
        'POST /api/vendas - Registrar venda',
        'GET /api/vendas/:id - Buscar venda',
        'PATCH /api/vendas/:id/status - Atualizar status'
      ],
      relatorios: [
        'GET /api/relatorios/diario - Relatório diário',
        'GET /api/relatorios/mensal - Relatório mensal',
        'GET /api/relatorios/produtos-mais-vendidos - Top produtos',
        'GET /api/relatorios/clientes-mais-ativos - Top clientes',
        'GET /api/relatorios/vendas-pendentes - Vendas pendentes'
      ]
    }
  });
});

// Rota de ping para teste
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString()
  });
});

// ==================== CONFIGURAR ROTAS ====================

// Usar as rotas importadas
app.use('/api/produtos', produtosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/relatorios', relatoriosRoutes);

// ==================== FUNÇÕES AUXILIARES ====================

// Função para gerar relatório diário automático
function gerarRelatorioDiario() {
  const hoje = new Date().toISOString().split('T')[0];
  console.log(`📊 Gerando relatório automático para ${hoje}`);

  // Fazer request interno para o endpoint de relatório
  const http = require('http');

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: `/api/relatorios/diario?data=${hoje}`,
    method: 'GET'
  };

  const req = http.request(options, res => {
    let data = '';

    res.on('data', chunk => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const relatorio = JSON.parse(data);
        if (relatorio.success) {
          const { relatorio: dados } = relatorio;

          const mensagem = `
📊 *RELATÓRIO DIÁRIO - ${hoje}*

💰 Dinheiro: R$ ${dados.total_dinheiro.toFixed(2)}
💳 Cartão: R$ ${dados.total_cartao.toFixed(2)}  
📱 PIX: R$ ${dados.total_pix.toFixed(2)}

🎯 *Total do dia: R$ ${dados.total_geral.toFixed(2)}*

📋 Vendas normais: ${dados.vendas_normais}
📝 Vendas na nota: ${dados.vendas_nota}
          `.trim();

          console.log('📱 Relatório diário gerado:', mensagem);

          // Aqui você pode enviar para WhatsApp
          // enviarWhatsAppRelatorio(mensagem);
        }
      } catch (error) {
        console.error('Erro ao processar relatório:', error);
      }
    });
  });

  req.on('error', error => {
    console.error('Erro ao gerar relatório:', error);
  });

  req.end();
}

// ==================== AGENDAMENTOS ====================

// Agendar relatório diário para 21:00 (descomente para ativar)
/*
cron.schedule('0 21 * * *', () => {
  console.log('🕘 Executando relatório diário automático às 21:00');
  gerarRelatorioDiario();
}, {
  timezone: "America/Recife"
});
*/

console.log('⏰ Agendamento de relatório disponível (desabilitado)');

// ==================== MIDDLEWARE DE ERRO ====================

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    message: `A rota ${req.method} ${req.originalUrl} não existe`,
    endpoints_disponiveis: 'Acesse GET / para ver todos os endpoints'
  });
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro interno:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: 'Algo deu errado no servidor'
  });
});

// ==================== INICIALIZAÇÃO ====================

async function iniciarServidor() {
  try {
    // Criar tabelas do banco
    await criarTabelas();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📱 Acesse: http://localhost:${PORT}`);
      console.log(`📊 API: http://localhost:${PORT}/api/`);
      console.log(`🔧 Estrutura organizada em models/ e routes/`);
      console.log(`⏰ Relatório diário configurado para 21:00`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// ==================== ENCERRAMENTO GRACIOSO ====================

// Fechar conexão do banco ao encerrar aplicação
process.on('SIGINT', async () => {
  console.log('\n🔄 Encerrando servidor...');

  try {
    await fecharConexao();
    console.log('✅ Servidor encerrado graciosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao encerrar:', error);
    process.exit(1);
  }
});

// ==================== INICIAR APLICAÇÃO ====================

iniciarServidor();
