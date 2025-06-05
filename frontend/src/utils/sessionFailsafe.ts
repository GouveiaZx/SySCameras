/**
 * Failsafe para sessão - Valida sessão antes de operações críticas
 */

import { supabase } from '@/utils/supabase';

let isValidating = false;
let lastValidation = 0;
const VALIDATION_INTERVAL = 30000; // 30 segundos

/**
 * Failsafe DEFINITIVO - valida sessão antes de QUALQUER operação
 */
export async function ensureValidSessionFailsafe(): Promise<boolean> {
  const now = Date.now();
  
  // Se validamos recentemente, assumir válida
  if (now - lastValidation < VALIDATION_INTERVAL && !isValidating) {
    return true;
  }

  if (isValidating) {
    // Aguardar validação atual
    let attempts = 0;
    while (isValidating && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return now - lastValidation < VALIDATION_INTERVAL;
  }

  try {
    isValidating = true;
    console.log('🔒 FAILSAFE: Validação crítica de sessão...');

    // Tentar refresh da sessão
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      console.error('🚨 FAILSAFE: Sessão inválida detectada!');
      
      // Tentar get session como fallback
      const { data: { session: fallbackSession } } = await supabase.auth.getSession();
      
      if (!fallbackSession) {
        console.error('🚨 FAILSAFE: Nenhuma sessão encontrada, forçando logout');
        await supabase.auth.signOut();
        window.location.href = '/login';
        return false;
      } else {
        console.log('✅ FAILSAFE: Sessão fallback encontrada');
        lastValidation = now;
        return true;
      }
    }

    console.log('✅ FAILSAFE: Sessão validada com sucesso');
    lastValidation = now;
    return true;
    
  } catch (error) {
    console.error('🚨 FAILSAFE: Erro crítico na validação:', error);
    return false;
  } finally {
    isValidating = false;
  }
}

/**
 * Wrapper para fetch com validação automática de sessão
 */
export async function fetchWithSessionValidation(url: string, options: RequestInit = {}): Promise<Response> {
  // Validar sessão ANTES de fazer a requisição
  const isValid = await ensureValidSessionFailsafe();
  
  if (!isValid) {
    throw new Error('AUTHENTICATION_ERROR');
  }
  
  const response = await fetch(url, options);
  
  // Se response for 401, tentar validar novamente
  if (response.status === 401) {
    console.warn('🚨 FAILSAFE: 401 detectado, revalidando sessão...');
    const retryValid = await ensureValidSessionFailsafe();
    
    if (retryValid) {
      // Retry com nova sessão
      console.log('🔄 FAILSAFE: Retry após revalidação...');
      return fetch(url, options);
    } else {
      throw new Error('AUTHENTICATION_ERROR');
    }
  }
  
  return response;
}

/**
 * Inicializar verificação periódica de sessão mais agressiva
 */
export function initializeSessionFailsafe() {
  console.log('🔒 FAILSAFE: Inicializando verificação periódica agressiva...');
  
  // Verificar sessão a cada 1 minuto
  setInterval(async () => {
    try {
      console.log('⏰ FAILSAFE: Verificação periódica (1 min)...');
      await ensureValidSessionFailsafe();
    } catch (error) {
      console.error('🚨 FAILSAFE: Erro na verificação periódica:', error);
    }
  }, 60000); // 1 minuto
  
  // Verificar ao focar a janela
  window.addEventListener('focus', async () => {
    try {
      console.log('👁️ FAILSAFE: Window focado, verificando sessão...');
      await ensureValidSessionFailsafe();
    } catch (error) {
      console.error('🚨 FAILSAFE: Erro na verificação de foco:', error);
    }
  });
  
  // Verificar antes de mudanças de página
  window.addEventListener('beforeunload', async () => {
    try {
      await ensureValidSessionFailsafe();
    } catch (error) {
      console.error('🚨 FAILSAFE: Erro na verificação antes de unload:', error);
    }
  });
} 
