'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function Sidebar() {
  const { user, isAdmin, isIntegrator, isClient, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="w-64 bg-gray-800 text-white h-full flex flex-col">
      <div className="p-5 border-b border-gray-700">
        <h2 className="text-2xl font-bold">Sistema CFTV</h2>
        {user && (
          <p className="text-sm text-gray-400 mt-2">
            {user.name} <span className="bg-blue-600 text-xs px-2 py-1 rounded ml-1">{user.role}</span>
          </p>
        )}
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard" className="block py-2.5 px-4 rounded hover:bg-gray-700">
              Painel
            </Link>
          </li>
          <li>
            <Link href="/dashboard/live" className="block py-2.5 px-4 rounded hover:bg-gray-700">
              Visualização ao Vivo
            </Link>
          </li>
          <li>
            <Link href="/dashboard/cameras" className="block py-2.5 px-4 rounded hover:bg-gray-700">
              Câmeras
            </Link>
          </li>
          <li>
            <Link href="/dashboard/recordings" className="block py-2.5 px-4 rounded hover:bg-gray-700">
              Gravações
            </Link>
          </li>
          {(isAdmin || isIntegrator) && (
            <li>
              <Link href="/dashboard/schedule" className="block py-2.5 px-4 rounded hover:bg-gray-700">
                Agendamentos
              </Link>
            </li>
          )}
          {(isAdmin || isIntegrator) && (
            <li>
              <Link href="/dashboard/cameras/new" className="block py-2.5 px-4 rounded hover:bg-gray-700">
                Adicionar Câmera
              </Link>
            </li>
          )}
          {(isAdmin || isIntegrator) && (
            <li>
              <Link href="/dashboard/clients" className="block py-2.5 px-4 rounded hover:bg-gray-700">
                Clientes
              </Link>
            </li>
          )}
          {isAdmin && (
            <li>
              <Link href="/dashboard/integrators" className="block py-2.5 px-4 rounded hover:bg-gray-700">
                Integradores
              </Link>
            </li>
          )}
          {isAdmin && (
            <li>
              <Link href="/dashboard/settings" className="block py-2.5 px-4 rounded hover:bg-gray-700">
                Configurações
              </Link>
            </li>
          )}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <button 
          onClick={handleLogout}
          className="w-full py-2 px-4 bg-red-600 rounded hover:bg-red-700"
        >
          Sair
        </button>
      </div>
    </div>
  )
} 