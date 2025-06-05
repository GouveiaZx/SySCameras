const { supabase } = require('../services/supabase');
const { 
  authenticate, 
  isAdmin, 
  isIntegrator, 
  isClient 
} = require('../middlewares/auth');

// Esquemas para validação do Fastify
const clientSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 },
    company: { type: 'string' },
    isActive: { type: 'boolean' }
  },
  required: ['name', 'email', 'password']
};

const clientUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 },
    company: { type: 'string' },
    isActive: { type: 'boolean' }
  }
};

/**
 * Rotas de clientes para o Fastify
 * @param {FastifyInstance} fastify - Instância do Fastify
 * @param {Object} options - Opções do plugin
 */
async function clientRoutes(fastify, options) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', authenticate);
  
  // Lista todos os clientes (filtrados por permissão)
  fastify.get('/clients', {
    preHandler: isIntegrator, // Pelo menos integrador
    handler: async (request, reply) => {
      try {
        const { role, id: userId } = request.user;
        let clients = [];
        
        if (role === 'ADMIN') {
          // Admin vê todos os clientes
          const { data, error } = await supabase
            .from('clients')
            .select(`
              *,
              users!inner (
                email,
                isActive
              )
            `)
            .order('createdAt', { ascending: false });
            
          if (error) throw error;
          clients = data;
        } else if (role === 'INTEGRATOR') {
          // Integrador vê apenas seus clientes
          const { data: integrator } = await supabase
            .from('integrators')
            .select('id')
            .eq('userId', userId)
            .single();
          
          if (!integrator) {
            return reply.code(404).send({
              error: 'Integrador não encontrado',
              message: 'Perfil de integrador não encontrado'
            });
          }
          
          const { data, error } = await supabase
            .from('clients')
            .select(`
              *,
              users!inner (
                email,
                isActive
              )
            `)
            .eq('integratorId', integrator.id)
            .order('createdAt', { ascending: false });
            
          if (error) throw error;
          clients = data;
        }
        
        // Formatar resposta
        const formattedClients = clients.map(client => ({
          id: client.id,
          name: client.name,
          email: client.users?.email,
          company: client.company,
          isActive: client.users?.isActive,
          integratorId: client.integratorId,
          userId: client.userId,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt
        }));
        
        return reply.code(200).send(formattedClients);
      } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível listar os clientes'
        });
      }
    }
  });
  
  // Obter um cliente específico
  fastify.get('/clients/:id', {
    preHandler: isIntegrator, // Pelo menos integrador
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const { role, id: userId } = request.user;
        
        // Buscar o cliente
        const { data: client, error } = await supabase
          .from('clients')
          .select(`
            *,
            users!inner (
              email,
              isActive
            )
          `)
          .eq('id', id)
          .single();
        
        if (error || !client) {
          return reply.code(404).send({
            error: 'Cliente não encontrado',
            message: 'Cliente não encontrado no sistema'
          });
        }
        
        // Verificar permissões
        if (role === 'INTEGRATOR') {
          const { data: integrator } = await supabase
            .from('integrators')
            .select('id')
            .eq('userId', userId)
            .single();
          
          if (!integrator || client.integratorId !== integrator.id) {
            return reply.code(403).send({
              error: 'Permissão negada',
              message: 'Você não tem permissão para acessar este cliente'
            });
          }
        }
        
        // Formatar resposta
        const formattedClient = {
          id: client.id,
          name: client.name,
          email: client.users?.email,
          company: client.company,
          isActive: client.users?.isActive,
          integratorId: client.integratorId,
          userId: client.userId,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt
        };
        
        return reply.code(200).send(formattedClient);
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível buscar o cliente'
        });
      }
    }
  });
  
  // Criar um novo cliente
  fastify.post('/clients', {
    schema: {
      body: clientSchema
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: async (request, reply) => {
      try {
        const { name, email, password, company, isActive } = request.body;
        const { role, id: userId } = request.user;
        
        console.log(`➕ Criando novo cliente: ${email}`);
        
        // Verificar se email já existe
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();
        
        if (existingUser) {
          return reply.code(400).send({ 
            error: 'Email já está em uso',
            message: 'Este email já está cadastrado no sistema'
          });
        }
        
        // Obter integrador ID
        let integratorId;
        if (role === 'ADMIN') {
          // Admin pode especificar integrador ou usar o primeiro disponível
          const { data: firstIntegrator } = await supabase
            .from('integrators')
            .select('id')
            .limit(1)
            .single();
          integratorId = firstIntegrator?.id;
        } else {
          const { data: integrator } = await supabase
            .from('integrators')
            .select('id')
            .eq('userId', userId)
            .single();
          integratorId = integrator?.id;
        }
        
        if (!integratorId) {
          return reply.code(400).send({
            error: 'Integrador não encontrado',
            message: 'Não foi possível determinar o integrador responsável'
          });
        }
        
        // Criar usuário primeiro
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert([{
            email,
            password: await fastify.bcrypt.hash(password),
            name,
            role: 'CLIENT',
            isActive: isActive ?? true
          }])
          .select()
          .single();
        
        if (userError) {
          console.error('❌ Erro ao criar usuário:', userError);
          return reply.code(500).send({ 
            error: 'Falha ao criar usuário',
            message: 'Não foi possível criar o usuário no sistema'
          });
        }
        
        // Criar cliente
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert([{
            name,
            userId: newUser.id,
            integratorId,
            company: company || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (clientError) {
          console.error('❌ Erro ao criar cliente:', clientError);
          // Tentar limpar o usuário criado
          await supabase.from('users').delete().eq('id', newUser.id);
          return reply.code(500).send({ 
            error: 'Falha ao criar cliente',
            message: 'Não foi possível criar o cliente no sistema'
          });
        }
        
        console.log(`✅ Cliente criado: ${email} -> ${newClient.id}`);
        
        // Retornar cliente criado
        const formattedClient = {
          id: newClient.id,
          name: newClient.name,
          email: newUser.email,
          company: newClient.company,
          isActive: newUser.isActive,
          integratorId: newClient.integratorId,
          userId: newClient.userId,
          createdAt: newClient.createdAt,
          updatedAt: newClient.updatedAt
        };
        
        return reply.code(201).send({
          message: 'Cliente criado com sucesso',
          client: formattedClient
        });
      } catch (error) {
        console.error('❌ Erro ao criar cliente:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível criar o cliente'
        });
      }
    }
  });
  
  // Atualizar um cliente existente
  fastify.put('/clients/:id', {
    schema: {
      body: clientUpdateSchema
    },
    preHandler: isIntegrator, // Pelo menos integrador
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const { name, email, password, company, isActive } = request.body;
        const { role, id: userId } = request.user;
        
        console.log(`✏️ Atualizando cliente: ${id}`);
        
        // Buscar o cliente atual
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single();
        
        if (clientError || !client) {
          return reply.code(404).send({
            error: 'Cliente não encontrado',
            message: 'Cliente não encontrado no sistema'
          });
        }
        
        // Verificar permissões
        if (role === 'INTEGRATOR') {
          const { data: integrator } = await supabase
            .from('integrators')
            .select('id')
            .eq('userId', userId)
            .single();
          
          if (!integrator || client.integratorId !== integrator.id) {
            return reply.code(403).send({
              error: 'Permissão negada',
              message: 'Você não tem permissão para editar este cliente'
            });
          }
        }
        
        // Atualizar dados do usuário se necessário
        if (email || password || isActive !== undefined || name) {
          const userUpdateData = {};
          
          if (email) {
            // Verificar se o email já existe (exceto o atual)
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('email', email)
              .neq('id', client.userId)
              .single();
            
            if (existingUser) {
              return reply.code(400).send({
                error: 'Email já está em uso',
                message: 'Este email já está cadastrado no sistema'
              });
            }
            userUpdateData.email = email;
          }
          
          if (password) {
            userUpdateData.password = await fastify.bcrypt.hash(password);
          }
          
          if (isActive !== undefined) userUpdateData.isActive = isActive;
          if (name) userUpdateData.name = name;
          
          const { error: userError } = await supabase
            .from('users')
            .update(userUpdateData)
            .eq('id', client.userId);
          
          if (userError) {
            console.error('❌ Erro ao atualizar usuário:', userError);
            return reply.code(500).send({
              error: 'Falha ao atualizar dados do usuário',
              message: 'Não foi possível atualizar os dados do usuário'
            });
          }
        }
        
        // Atualizar dados do cliente
        const clientUpdateData = {
          updatedAt: new Date().toISOString()
        };
        
        if (name) clientUpdateData.name = name;
        if (company !== undefined) clientUpdateData.company = company;
        
        const { data: updatedClient, error: updateError } = await supabase
          .from('clients')
          .update(clientUpdateData)
          .eq('id', id)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ Erro ao atualizar cliente:', updateError);
          return reply.code(500).send({
            error: 'Falha ao atualizar cliente',
            message: 'Não foi possível atualizar o cliente'
          });
        }
        
        console.log(`✅ Cliente atualizado: ${id}`);
        
        // Buscar dados atualizados do usuário
        const { data: updatedUser } = await supabase
          .from('users')
          .select('email, isActive')
          .eq('id', client.userId)
          .single();
        
        // Formatar resposta
        const formattedClient = {
          id: updatedClient.id,
          name: updatedClient.name,
          email: updatedUser?.email,
          company: updatedClient.company,
          isActive: updatedUser?.isActive,
          integratorId: updatedClient.integratorId,
          userId: updatedClient.userId,
          createdAt: updatedClient.createdAt,
          updatedAt: updatedClient.updatedAt
        };
        
        return reply.code(200).send({
          message: 'Cliente atualizado com sucesso',
          client: formattedClient
        });
      } catch (error) {
        console.error('❌ Erro ao atualizar cliente:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível atualizar o cliente'
        });
      }
    }
  });
  
  // Remover um cliente
  fastify.delete('/clients/:id', {
    preHandler: isIntegrator, // Pelo menos integrador
    handler: async (request, reply) => {
      try {
        const { id } = request.params;
        const { role, id: userId } = request.user;
        
        console.log(`🗑️ Excluindo cliente: ${id}`);
        
        // Buscar o cliente
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single();
        
        if (clientError || !client) {
          return reply.code(404).send({
            error: 'Cliente não encontrado',
            message: 'Cliente não encontrado no sistema'
          });
        }
        
        // Verificar permissões
        if (role === 'INTEGRATOR') {
          const { data: integrator } = await supabase
            .from('integrators')
            .select('id')
            .eq('userId', userId)
            .single();
          
          if (!integrator || client.integratorId !== integrator.id) {
            return reply.code(403).send({
              error: 'Permissão negada',
              message: 'Você não tem permissão para excluir este cliente'
            });
          }
        }
        
        // Verificar se há câmeras associadas
        const { data: cameras } = await supabase
          .from('cameras')
          .select('id')
          .eq('clientId', id);
        
        if (cameras && cameras.length > 0) {
          return reply.code(400).send({
            error: 'Cliente possui câmeras',
            message: `Este cliente possui ${cameras.length} câmera(s) associada(s). Remova as câmeras antes de excluir o cliente.`
          });
        }
        
        // Excluir o cliente
        const { error: deleteClientError } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);
        
        if (deleteClientError) {
          console.error('❌ Erro ao excluir cliente:', deleteClientError);
          return reply.code(500).send({
            error: 'Falha ao remover cliente',
            message: 'Não foi possível remover o cliente'
          });
        }
        
        // Excluir o usuário associado
        const { error: deleteUserError } = await supabase
          .from('users')
          .delete()
          .eq('id', client.userId);
        
        if (deleteUserError) {
          console.error('❌ Erro ao excluir usuário (não crítico):', deleteUserError);
          // Não falhar aqui pois o cliente já foi removido
        }
        
        console.log(`✅ Cliente excluído: ${id}`);
        
        return reply.code(200).send({
          message: 'Cliente removido com sucesso'
        });
      } catch (error) {
        console.error('❌ Erro ao excluir cliente:', error);
        return reply.code(500).send({
          error: 'Erro interno',
          message: 'Não foi possível excluir o cliente'
        });
      }
    }
  });
}

module.exports = clientRoutes;