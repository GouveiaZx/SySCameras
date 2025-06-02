const { createClient } = require('@supabase/supabase-js');

// Configurar cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Rotas administrativas
 */
async function adminRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', async function(request, reply) {
    try {
      // Usar o decorador authenticate que já configuramos no server.js
      await fastify.authenticate(request, reply);
      
      // Verificar se é admin
      const user = request.user;
      if (!user || user.role !== 'ADMIN') {
        return reply.code(403).send({ 
          error: 'Acesso negado',
          message: 'Apenas administradores podem acessar este recurso'
        });
      }
    } catch (err) {
      return reply.code(401).send({ 
        error: 'Não autorizado',
        message: 'Token de autenticação inválido ou expirado'
      });
    }
  });

  // Obter estatísticas gerais do sistema
  fastify.get('/stats', async (request, reply) => {
    try {
      console.log('📊 Buscando estatísticas do sistema...');
      
      // Usar Supabase para buscar dados
      const [camerasResult, alertsResult, clientsResult, integratorsResult] = await Promise.allSettled([
        supabase.from('cameras').select('id, status'),
        supabase.from('alerts').select('id, status'),
        supabase.from('clients').select('id'),
        supabase.from('integrators').select('id')
      ]);
      
      const cameras = camerasResult.status === 'fulfilled' ? camerasResult.value.data || [] : [];
      const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value.data || [] : [];
      const clients = clientsResult.status === 'fulfilled' ? clientsResult.value.data || [] : [];
      const integrators = integratorsResult.status === 'fulfilled' ? integratorsResult.value.data || [] : [];
      
      const totalCameras = cameras.length;
      const activeCameras = cameras.filter(camera => camera.status === 'online').length;
      const totalAlerts = alerts.length;
      const totalClients = clients.length;
      const totalIntegrators = integrators.length;
      
      console.log('✅ Estatísticas calculadas:', { 
        totalCameras, 
        activeCameras, 
        totalAlerts, 
        totalClients, 
        totalIntegrators 
      });
      
      return {
        totalIntegrators,
        totalClients,
        totalCameras,
        activeCameras,
        totalRecordings: 0, // Será implementado depois
        totalAlerts: {
          total: totalAlerts,
          new: 0,
          read: 0
        },
        storageUsed: {
          total: 0,
          percentage: 0
        }
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas do sistema:', error);
      return reply.status(500).send({ error: 'Erro interno ao obter estatísticas' });
    }
  });

  // Listar integradores
  fastify.get('/integrators', async (request, reply) => {
    try {
      console.log('👥 Buscando integradores...');
      
      // Usar Supabase para buscar integradores
      const { data: integrators, error } = await supabase
        .from('integrators')
        .select(`
          id,
          name,
          userId,
          users!inner (
            email,
            createdAt,
            active
          )
        `)
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar integradores:', error);
        return reply.status(500).send({ error: 'Erro interno ao listar integradores' });
      }

      // Formatar resposta
      const formattedIntegrators = (integrators || []).map(integrator => ({
        id: integrator.id,
        name: integrator.name,
        email: integrator.users?.email || '',
        createdAt: integrator.users?.createdAt || new Date().toISOString(),
        active: integrator.users?.active || false,
        clientsCount: 0, // Será implementado depois
        camerasCount: 0, // Será implementado depois
        userId: integrator.userId
      }));

      console.log('✅ Integradores encontrados:', formattedIntegrators.length);

      return {
        data: formattedIntegrators,
        meta: {
          total: formattedIntegrators.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      };
    } catch (error) {
      console.error('❌ Erro ao listar integradores:', error);
      return reply.status(500).send({ error: 'Erro interno ao listar integradores' });
    }
  });

  // Criar um novo integrador
  fastify.post('/integrators', async (request, reply) => {
    const { name, email, password } = request.body;
    
    // Validar dados
    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nome, email e senha são obrigatórios' });
    }
    
    try {
      console.log('➕ Criando novo integrador:', email);
      
      // Verificar se email já existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existingUser) {
        return reply.status(400).send({ error: 'Email já está em uso' });
      }
      
      // Criar usuário
      const hashedPassword = await fastify.bcrypt.hash(password, 10);
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          role: 'INTEGRATOR',
          password: hashedPassword,
          active: true
        })
        .select()
        .single();
      
      if (userError) {
        console.error('❌ Erro ao criar usuário:', userError);
        return reply.status(500).send({ error: 'Erro interno ao criar usuário' });
      }
      
      // Criar integrador
      const { data: integrator, error: integratorError } = await supabase
        .from('integrators')
        .insert({
          name,
          userId: user.id
        })
        .select()
        .single();
      
      if (integratorError) {
        console.error('❌ Erro ao criar integrador:', integratorError);
        return reply.status(500).send({ error: 'Erro interno ao criar integrador' });
      }
      
      console.log('✅ Integrador criado com sucesso:', integrator.id);
      
      return reply.status(201).send({
        ...integrator,
        email,
        createdAt: user.createdAt,
        active: true,
        clientsCount: 0,
        camerasCount: 0
      });
    } catch (error) {
      console.error('❌ Erro ao criar integrador:', error);
      return reply.status(500).send({ error: 'Erro interno ao criar integrador' });
    }
  });
}

module.exports = adminRoutes; 