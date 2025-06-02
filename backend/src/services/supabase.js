const { createClient } = require('@supabase/supabase-js');

// Inicializar o cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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