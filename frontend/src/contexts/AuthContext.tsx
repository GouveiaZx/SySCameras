'use client';

import { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile, signOut } from '@/utils/supabase';

// Declaração global para lastKnownPath
declare global {
  interface Window {
    lastKnownPath?: string;
  }
}

// Definir tipos
type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'INTEGRATOR' | 'CLIENT';
  integrator?: any;
  client?: any;
};

type SessionType = {
  token: string;
  user?: UserProfile;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isIntegrator: boolean;
  isClient: boolean;
  session: SessionType | null;
  refreshSession: () => Promise<boolean>;
  ensureValidSession: () => Promise<boolean>;
};

// Criar o contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provedor do contexto
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const refreshingRef = useRef(false);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastValidationRef = useRef<number>(0);

  // Memoizar o objeto session para evitar re-renders infinitos
  const session = useMemo(() => {
    if (token && user) {
      return { token, user };
    }
    return null;
  }, [token, user]);

  // Função para redirecionar o usuário com base no papel (memoizada)
  const redirectBasedOnRole = useCallback((userRole: string, currentPath?: string) => {
    const path = currentPath || window.location.pathname;
    
    if (userRole === 'CLIENT') {
      if (!path.startsWith('/client')) {
        router.replace('/client');
      }
    } else if (userRole === 'INTEGRATOR' || userRole === 'ADMIN') {
      if (!path.startsWith('/dashboard')) {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  // Função ROBUSTA para validar sessão
  const ensureValidSession = useCallback(async (): Promise<boolean> => {
    const now = Date.now();
    
    // Se validamos recentemente (menos de 30 segundos), assumir válida
    if (now - lastValidationRef.current < 30000 && token && user) {
      return true;
    }

    if (refreshingRef.current) {
      // Aguardar o refresh atual
      await new Promise(resolve => setTimeout(resolve, 1000));
      return !!token && !!user;
    }

    try {
      refreshingRef.current = true;
      console.log('🔍 Validação obrigatória de sessão...');

      // Forçar refresh do token
      const { data: { session: supabaseSession }, error } = await supabase.auth.refreshSession();
      
      if (error || !supabaseSession) {
        console.warn('❌ Sessão inválida, forçando relogin');
        await signOut();
        setUser(null);
        setToken(null);
        router.replace('/login');
        return false;
      }

      const { access_token } = supabaseSession;
      console.log('✅ Sessão validada e refrescada');

      try {
        const profileData = await getUserProfile(access_token);
        setUser(profileData.user);
        setToken(access_token);
        lastValidationRef.current = now;
        
        console.log('✅ Perfil revalidado com sucesso');
        return true;
      } catch (profileError) {
        console.error('❌ Erro ao revalidar perfil:', profileError);
        setUser(null);
        setToken(null);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro crítico na validação de sessão:', error);
      setUser(null);
      setToken(null);
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, [token, user, router]);

  // Função para refrescar a sessão (mantida para compatibilidade)
  const refreshSession = useCallback(async (): Promise<boolean> => {
    return ensureValidSession();
  }, [ensureValidSession]);

  // Configurar verificação periódica MAIS agressiva
  useEffect(() => {
    if (!user) return;

    // Verificar sessão a cada 5 minutos
    sessionCheckIntervalRef.current = setInterval(async () => {
      console.log('⏰ Verificação periódica de sessão (5 min)...');
      await ensureValidSession();
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [user, ensureValidSession]);

  // Verificar sessão do usuário ao carregar a página
  useEffect(() => {
    if (initialized) return;

    const checkSession = async () => {
      try {
        console.log('🔄 Verificando sessão inicial...');
        
        // USAR getSession direto na inicialização para evitar loop
        const { data: { session: supabaseSession } } = await supabase.auth.getSession();
        
        if (supabaseSession) {
          const { access_token } = supabaseSession;
          
          try {
            const profileData = await getUserProfile(access_token);
            setUser(profileData.user);
            setToken(access_token);
            lastValidationRef.current = Date.now();
            
            const currentPath = window.location.pathname;
            
            if (currentPath === '/' || currentPath === '/login') {
              redirectBasedOnRole(profileData.user.role, currentPath);
            } else {
              const isClientAccessingDashboard = profileData.user.role === 'CLIENT' && currentPath.startsWith('/dashboard');
              const isUserAccessingClientArea = profileData.user.role !== 'CLIENT' && currentPath.startsWith('/client');
              
              if (isClientAccessingDashboard) {
                router.replace('/client');
              } else if (isUserAccessingClientArea) {
                router.replace('/dashboard');
              }
            }
          } catch (profileError) {
            console.error('❌ Erro ao carregar perfil na verificação inicial:', profileError);
            setUser(null);
            setToken(null);
          }
        } else {
          console.log('Nenhuma sessão encontrada na verificação inicial');
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar sessão inicial:', error);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    checkSession();
  }, [initialized, redirectBasedOnRole, router]);

  // Ouvir alterações de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      console.log('🔄 Auth state change:', event);
      
      if (event === 'SIGNED_IN' && supabaseSession) {
        try {
          const profileData = await getUserProfile(supabaseSession.access_token);
          setUser(profileData.user);
          setToken(supabaseSession.access_token);
          lastValidationRef.current = Date.now();
          redirectBasedOnRole(profileData.user.role);
        } catch (error) {
          console.error('❌ Erro ao processar login:', error);
          setUser(null);
          setToken(null);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 Usuário deslogado');
        setUser(null);
        setToken(null);
        lastValidationRef.current = 0;
        router.replace('/login');
      } else if (event === 'TOKEN_REFRESHED' && supabaseSession) {
        console.log('🔄 Token refrescado automaticamente');
        try {
          const profileData = await getUserProfile(supabaseSession.access_token);
          setUser(profileData.user);
          setToken(supabaseSession.access_token);
          lastValidationRef.current = Date.now();
        } catch (error) {
          console.error('❌ Erro ao processar token refrescado:', error);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [redirectBasedOnRole, router, ensureValidSession]);

  // Login (memoizado)
  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw new Error(error.message);
    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout (memoizado)
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await signOut();
      setUser(null);
      setToken(null);
      lastValidationRef.current = 0;
      
      // Limpar interval se existir
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      
      router.replace('/login');
    } catch (error) {
      console.error('❌ Erro ao fazer logout:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Valores do contexto (memoizados)
  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isIntegrator: user?.role === 'INTEGRATOR',
    isClient: user?.role === 'CLIENT',
    session,
    refreshSession,
    ensureValidSession
  }), [user, loading, login, logout, session, refreshSession, ensureValidSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook para usar o contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
} 