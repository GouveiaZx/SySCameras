const { supabase } = require('../services/supabase');

/**
 * Registra um novo usuário
 * @param {Object} request - Objeto de requisição Fastify
 * @param {Object} reply - Objeto de resposta Fastify
 */
async function register(request, reply) {
  const { email, password, name, role = 'CLIENT' } = request.body;
  
  try {
    // Verificar se o email já está em uso
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      return reply.code(400).send({
        error: 'Email já registrado',
        message: 'Este email já está em uso'
      });
    }
    
    // Registrar no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) {
      console.error('Erro no registro do Supabase:', authError);
      return reply.code(400).send({
        error: 'Erro no registro',
        message: authError.message
      });
    }
    
    // Criar o usuário na tabela users
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role,
      })
      .select()
      .single();
    
    if (userError) {
      console.error('Erro ao criar usuário:', userError);
      return reply.code(500).send({
        error: 'Erro interno',
        message: 'Não foi possível criar o perfil do usuário'
      });
    }
    
    // Se for um integrador, criar registro de integrador
    if (role === 'INTEGRATOR') {
      const { error: integratorError } = await supabase
        .from('integrators')
        .insert({
          name,
          userId: newUser.id
        });
        
      if (integratorError) {
        console.error('Erro ao criar integrador:', integratorError);
      }
    } 
    // Se for um cliente, verificar se há um integrador para associar
    else if (role === 'CLIENT' && request.body.integratorId) {
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          name,
          userId: newUser.id,
          integratorId: request.body.integratorId
        });
        
      if (clientError) {
        console.error('Erro ao criar cliente:', clientError);
      }
    }
    
    return reply.code(201).send({
      message: 'Usuário registrado com sucesso',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
    
  } catch (error) {
    console.error('Erro no registro:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível completar o registro'
    });
  }
}

/**
 * Faz login de um usuário
 * @param {Object} request - Objeto de requisição Fastify
 * @param {Object} reply - Objeto de resposta Fastify
 */
async function login(request, reply) {
  const { email, password } = request.body;
  
  try {
    // Fazer login no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Erro no login:', error);
      return reply.code(401).send({
        error: 'Credenciais inválidas',
        message: error.message
      });
    }
    
    // Buscar informações do usuário no banco
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (userError || !user) {
      return reply.code(404).send({
        error: 'Usuário não encontrado',
        message: 'Perfil de usuário não encontrado no sistema'
      });
    }
    
    // Gerar token com Fastify JWT
    const token = data.session.access_token;
    
    // Retornar dados do usuário e token
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível realizar o login'
    });
  }
}

/**
 * Obtém o perfil do usuário atual
 * @param {Object} request - Objeto de requisição Fastify
 * @param {Object} reply - Objeto de resposta Fastify
 */
async function getUserProfile(request, reply) {
  try {
    // Dados básicos do usuário já fornecidos pelo middleware
    const userId = request.user.id;
    
    // Buscar informações adicionais com base no role
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !user) {
      return reply.code(404).send({
        error: 'Usuário não encontrado',
        message: 'Perfil de usuário não encontrado no sistema'
      });
    }
    
    let profileData = {};
    
    // Buscar dados específicos baseados no role
    if (user.role === 'INTEGRATOR') {
      const { data: integrator } = await supabase
        .from('integrators')
        .select('*')
        .eq('userId', userId)
        .single();
      profileData = { integrator };
    } else if (user.role === 'CLIENT') {
      const { data: client } = await supabase
        .from('clients')
        .select('*, integrator:integrators(*)')
        .eq('userId', userId)
        .single();
      profileData = { client };
    }
    
    // Retornar perfil completo
    return reply.code(200).send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ...profileData
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    return reply.code(500).send({
      error: 'Erro interno',
      message: 'Não foi possível buscar o perfil do usuário'
    });
  }
}

module.exports = {
  register,
  login,
  getUserProfile
}; 