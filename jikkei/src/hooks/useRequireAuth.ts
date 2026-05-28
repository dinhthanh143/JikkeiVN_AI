import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '@/store/usePlayerStore'

export function useRequireAuth(redirectTo = '/auth') {
  const { user, isInitialized } = usePlayerStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isInitialized && !user) {
      navigate(redirectTo, { replace: true })
    }
  }, [isInitialized, navigate, redirectTo, user])

  return { user, isInitialized }
}

export function useRequireAdmin(redirectTo = '/') {
  const { user, isInitialized } = usePlayerStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'admin')) {
      navigate(redirectTo, { replace: true })
    }
  }, [isInitialized, navigate, redirectTo, user])

  return { user, isInitialized }
}
