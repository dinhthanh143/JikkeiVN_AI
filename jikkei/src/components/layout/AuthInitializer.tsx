import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AudioManager from '@/components/layout/AudioManager'

export default function AuthInitializer() {
  const { initialize, isInitialized } = useAuth()

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(145deg, #fff0f8 0%, #fde8f5 55%, #ffd6ec 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px', zIndex: 9999,
      }}>
        <span style={{ fontFamily: "'Comfortaa', 'Quicksand', sans-serif", fontSize: '2rem', fontWeight: 700, letterSpacing: '0.1em', color: '#5a1a4a' }}>
          JIKKEI
        </span>
        <div style={{ width: '160px', height: '4px', background: 'rgba(255, 182, 193, 0.35)', borderRadius: '99px', overflow: 'hidden', border: '1px solid rgba(255, 133, 179, 0.3)' }}>
          <div style={{ height: '100%', width: '40%', background: 'linear-gradient(90deg, rgba(255,133,179,0.4), #f472b6, rgba(255,214,231,0.95))', borderRadius: '99px', boxShadow: '0 0 12px rgba(244, 114, 182, 0.5)', animation: 'jkSpin 1.2s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes jkSpin { 0% { transform: translateX(-120%); } 100% { transform: translateX(310%); } }`}</style>
      </div>
    )
  }

  return (
    <>
      <AudioManager />
      <Outlet />
    </>
  )
}
