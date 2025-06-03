const { createClient } = require('@supabase/supabase-js');

// Logs de debug
console.log('🔍 Iniciando configuração do Supabase...');
console.log('📍 SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('📍 SUPABASE_SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 'undefined');

// Inicializar o cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  console.error('📍 URL:', supabaseUrl);
  console.error('📍 Key:', supabaseKey ? 'exists' : 'missing');
  process.exit(1);
}

console.log('✅ Variáveis de ambiente do Supabase carregadas');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
});

console.log('✅ Cliente Supabase criado com sucesso');

// Teste imediato da conexão
console.log('🧪 Testando conexão imediatamente...');
supabase
  .from('cameras')
  .select('count')
  .then(result => {
    console.log('✅ Teste de conexão bem-sucedido:', result);
  })
  .catch(error => {
    console.error('❌ Teste de conexão falhou:', error);
  });

/**
 * Verifica o token JWT do Supabase
 * @param {string} token - Token JWT
 * @returns {Promise<Object>} - Dados do usuário
 */
async function verifyToken(token) {
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || !data.user) {
      throw new Error('Usuário não encontrado');
    }

    return data.user;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    throw error;
  }
}

/**
 * Obtém dados completos do usuário incluindo seu perfil no banco
 * @param {string} userId - ID do usuário no Supabase
 * @returns {Promise<Object>} - Dados completos do usuário
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    throw error;
  }
}

module.exports = {
  supabase,
  verifyToken,
  getUserProfile
}; 