require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { initSchedulers } = require('./scheduler');
const { configureSwagger } = require('./utils/swagger');

// Configurar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Registrar plugins
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || '*',
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret'
});

// Registrar bcrypt como decorador
fastify.decorate('bcrypt', bcrypt);

// Decorador para Supabase
fastify.decorate('supabase', supabase);

// Registrar Swagger (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  configureSwagger(fastify).catch(err => {
    fastify.log.error('Erro ao configurar Swagger:', err);
  });
}

// Decorador para verificar token JWT DO SUPABASE
fastify.decorate('authenticate', async function(request, reply) {
  try {
    console.log('🔐 Iniciando verificação de autenticação...');
    
    const authHeader = request.headers.authorization;
    console.log('📋 Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Header de autorização inválido');
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação não fornecido'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    console.log('🎫 Token extraído (primeiros 20 chars):', token.substring(0, 20) + '...');
    
    // Verificar token com Supabase
    console.log('🔍 Verificando token com Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Erro do Supabase:', error.message);
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação inválido ou expirado'
      });
    }
    
    if (!user) {
      console.log('❌ Usuário não encontrado no Supabase');
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação inválido ou expirado'
      });
    }

    console.log('✅ Usuário validado no Supabase:', user.id);

    // Buscar perfil do usuário no banco de dados
    console.log('🔍 Buscando perfil do usuário no banco...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log('❌ Erro ao buscar perfil:', profileError.message);
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Usuário não encontrado'
      });
    }

    if (!userProfile) {
      console.log('❌ Perfil de usuário não encontrado');
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Usuário não encontrado'
      });
    }

    console.log('✅ Perfil do usuário encontrado:', userProfile.email, userProfile.role);

    // Adicionar usuário ao request
    request.user = userProfile;
    console.log('✅ Autenticação concluída com sucesso');
    
  } catch (err) {
    console.error('💥 Erro crítico na autenticação:', err);
    fastify.log.error('Erro na autenticação:', err);
    return reply.code(401).send({ 
      error: 'Não autorizado',
      message: 'Erro ao validar token de autenticação'
    });
  }
});

// Registrar rotas
fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
fastify.register(require('./routes/cameras'), { prefix: '/api' });
fastify.register(require('./routes/recordings'), { prefix: '/api/recordings' });
fastify.register(require('./routes/alerts'), { prefix: '/api/alerts' });
fastify.register(require('./routes/motionDetection'), { prefix: '/api' });
fastify.register(require('./routes/recordingSchedule'), { prefix: '/api' });
fastify.register(require('./routes/schedules'), { prefix: '/api/schedules' });
fastify.register(require('./routes/stream'), { prefix: '/api/stream' });
fastify.register(require('./routes/docs'), { prefix: '/api/docs' });

// Registrar rotas administrativas
fastify.register(require('./routes/admin'), { prefix: '/api/admin' });

// Rota de teste
fastify.get('/', async () => {
  return { message: 'API de Monitoramento de Câmeras IP em funcionamento' };
});

// Tratamento de erros global
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Verificar se é um erro de validação do Fastify
  if (error.validation) {
    return reply.code(400).send({
      error: 'Erro de validação',
      message: 'Os dados fornecidos não são válidos',
      details: error.validation
    });
  }
  
  // Erro genérico
  reply.code(500).send({
    error: 'Erro interno',
    message: 'Ocorreu um erro inesperado no servidor'
  });
});

// Manipulador para rotas não encontradas
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Não encontrado',
    message: 'O recurso solicitado não existe'
  });
});

// Iniciar servidor
const start = async () => {
  try {
    // Iniciar agendador de tarefas (desativado para testes do Swagger)
    if (process.env.ENABLE_SCHEDULERS === 'true') {
      initSchedulers();
    } else {
      console.log('Agendadores desativados para teste do Swagger');
    }
    
    await fastify.listen({ 
      port: process.env.PORT || 3001,
      host: '0.0.0.0'
    });
    console.log(`Servidor rodando em ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 