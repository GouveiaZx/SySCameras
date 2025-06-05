import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e chave anônima são necessárias');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Funções auxiliares para autenticação
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}

export async function signUp(email: string, password: string, name: string, role: string = 'CLIENT') {
  try {
    console.log('Iniciando registro para:', email);
    
    // Tentar criar usuário no Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
      options: {
        data: {
          name: name,
          role: role
        }
      }
  });
  
  if (error) {
      console.error('Erro do Supabase Auth:', error);
      
      // Se é erro de usuário já existente, dar uma mensagem mais clara
      if (error.message.includes('already_registered') || error.message.includes('User already registered')) {
        throw new Error(`O email ${email} já está cadastrado. Use "Fazer Login" ou "Esqueci minha senha".`);
      }
      
    throw new Error(error.message);
  }
  
    console.log('Usuário criado no Supabase Auth:', data);
    
    // Inserir usuário na tabela users do banco
    if (data.user) {
      console.log('Inserindo usuário na tabela users...');
      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            email: email,
            name: name,
            role: role.toUpperCase()
          }
        ])
        .select()
        .single();
    
      if (insertError) {
        console.error('Erro ao inserir na tabela users:', insertError);
        // Se o usuário já existe na tabela, não é erro crítico
        if (!insertError.message.includes('duplicate key value')) {
          throw new Error('Erro ao criar perfil do usuário');
        }
      } else {
        console.log('Usuário inserido na tabela users:', userData);
      }
    }
    
    return data;
    
  } catch (err) {
    console.error('Erro geral no registro:', err);
    throw err;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user;
}

export async function getUserProfile(token: string) {
  try {
    // Buscar dados do usuário autenticado no Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Usuário não encontrado no auth');
    }

    console.log('Usuário autenticado:', user.id);
    
    // Buscar dados completos do usuário na tabela users
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (dbError) {
      console.error('Erro ao buscar usuário na tabela users:', dbError);
      
      // Se o usuário não existe na tabela, criar automaticamente
      if (dbError.code === 'PGRST116') { // Not found
        console.log('Usuário não encontrado na tabela, criando...');
        const { data: newUserData, error: createError } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
              role: user.user_metadata?.role || 'CLIENT'
            }
          ])
          .select()
          .single();
    
        if (createError) {
          throw new Error('Erro ao criar perfil do usuário');
        }
        
        console.log('Perfil criado automaticamente:', newUserData);
        return { user: newUserData };
      }
      
      throw new Error('Erro ao buscar perfil do usuário');
    }
    
    console.log('Perfil do usuário carregado:', userData);
    
    return {
      user: userData
    };
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    throw error;
  }
} 
