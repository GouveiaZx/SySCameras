'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Se não estiver carregando e não estiver autenticado, redirecionar para login
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
    // Se estiver autenticado, o AuthContext já fará o redirecionamento apropriado
  }, [loading, isAuthenticated, router]);

  // Mostrar loading enquanto verifica a autenticação
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Carregando...</p>
      </main>
    );
  }

  // Se chegou aqui e não está autenticado, mostrar loading até o redirecionamento
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">Redirecionando...</p>
    </main>
  );
} 