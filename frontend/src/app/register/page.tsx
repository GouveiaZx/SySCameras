'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp, supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';
import { ImSpinner8 } from 'react-icons/im';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const router = useRouter();

  // Limpar erros quando o usuário começa a digitar
  useEffect(() => {
    if (name) setFieldErrors(prev => ({ ...prev, name: '' }));
  }, [name]);

  useEffect(() => {
    if (email) setFieldErrors(prev => ({ ...prev, email: '' }));
  }, [email]);

  useEffect(() => {
    if (password) setFieldErrors(prev => ({ ...prev, password: '' }));
  }, [password]);

  useEffect(() => {
    if (confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
  }, [confirmPassword]);

  const validateForm = () => {
    let isValid = true;
    const errors = { name: '', email: '', password: '', confirmPassword: '' };

    // Validar nome
    if (!name.trim()) {
      errors.name = 'O nome é obrigatório';
      isValid = false;
    } else if (name.trim().length < 2) {
      errors.name = 'O nome deve ter pelo menos 2 caracteres';
      isValid = false;
    }

    // Validar e-mail
    if (!email) {
      errors.email = 'O e-mail é obrigatório';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'O e-mail não é válido';
      isValid = false;
    }

    // Validar senha
    if (!password) {
      errors.password = 'A senha é obrigatória';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'A senha deve ter pelo menos 6 caracteres';
      isValid = false;
    }

    // Validar confirmação de senha
    if (!confirmPassword) {
      errors.confirmPassword = 'A confirmação de senha é obrigatória';
      isValid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Criando conta...');

    try {
      console.log('Tentando registrar usuário:', { email, name });
      const result = await signUp(email, password, name);
      console.log('Resultado do registro:', result);
      
      toast.success('Conta criada com sucesso!', { id: loadingToast });
      router.push('/login?registered=true');
      
    } catch (error) {
      console.error('Erro detalhado no registro:', error);
      
      let errorMessage = 'Erro ao registrar usuário';
      
      if (error instanceof Error) {
        if (error.message.includes('User already registered') || error.message.includes('already_registered')) {
          errorMessage = 'Este e-mail já está registrado. Tente fazer login.';
        } else if (error.message.includes('invalid_email')) {
          errorMessage = 'E-mail inválido. Verifique o formato.';
        } else if (error.message.includes('weak_password')) {
          errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres.';
        } else if (error.message.includes('signup_disabled')) {
          errorMessage = 'Registros estão desabilitados no momento.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header com logo/título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-sky-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sistema de Monitoramento
          </h1>
          <p className="text-gray-600">Câmeras IP em Nuvem</p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Criar nova conta</h2>
            <p className="text-gray-600 mt-1">Preencha os dados para começar</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Campo Nome */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900
                    ${fieldErrors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              {fieldErrors.name && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.name}</p>
              )}
            </div>

            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900
                    ${fieldErrors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            
            {/* Campo Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900
                    ${fieldErrors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>
            
            {/* Campo Confirmar Senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-gray-900
                    ${fieldErrors.confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}`}
                  placeholder="Repita sua senha"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
              )}
            </div>
            
            {/* Botão Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <ImSpinner8 className="animate-spin mr-2 h-5 w-5" />
                  <span>Criando conta...</span>
                </>
              ) : (
                'Criar conta'
              )}
            </button>
          </form>
          
          {/* Link para login */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Já possui uma conta?{' '}
              <Link 
                href="/login" 
                className="font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2024 Sistema de Monitoramento. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
} 
