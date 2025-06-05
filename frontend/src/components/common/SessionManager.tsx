'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function SessionManager() {
  const { refreshSession, isAuthenticated } = useAuth()
  const lastActivityRef = useRef(Date.now())
  const inactivityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Atualizar última atividade quando houver interação
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Eventos que indicam atividade do usuário
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true)
      })
    }
  }, [])

  // Verificar inatividade de forma MUITO conservadora
  useEffect(() => {
    if (!isAuthenticated) return

    inactivityCheckIntervalRef.current = setInterval(async () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivityRef.current
      
      // Se inativo por mais de 30 minutos, refrescar sessão preventivamente
      if (timeSinceLastActivity > 30 * 60 * 1000) {
        console.log('⚠️ Usuário inativo por mais de 30 minutos, validando sessão...')
        try {
          await refreshSession()
          console.log('✅ Sessão validada preventivamente com sucesso')
        } catch (error) {
          console.error('❌ Erro ao validar sessão preventivamente:', error)
        }
        // Resetar tempo de última atividade
        lastActivityRef.current = now
      }
    }, 15 * 60 * 1000) // Verificar a cada 15 minutos

    return () => {
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current)
      }
    }
  }, [isAuthenticated, refreshSession])

  // Detectar quando a aba volta ao foco após inatividade
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && isAuthenticated) {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current
        
        console.log(`👁️ Aba voltou ao foco após ${Math.round(timeSinceLastActivity / 60000)} minutos`)
        
        // Se a aba esteve oculta por mais de 10 minutos, validar sessão
        if (timeSinceLastActivity > 10 * 60 * 1000) {
          console.log('🔍 Aba voltou ao foco após inatividade, validando sessão...')
          try {
            const isValid = await refreshSession()
            if (isValid) {
              console.log('✅ Sessão validada ao retomar foco')
            } else {
              console.warn('❌ Sessão inválida detectada ao retomar foco')
            }
          } catch (error) {
            console.error('❌ Erro ao validar sessão ao retomar foco:', error)
          }
        }
        
        // Atualizar última atividade sempre que a aba voltar ao foco
        lastActivityRef.current = Date.now()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, refreshSession])

  // Este componente não renderiza nada
  return null
} 
