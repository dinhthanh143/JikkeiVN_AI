import type { ReactNode } from 'react'
import Navbar from './Navbar'

interface PageWrapperProps {
  children: ReactNode
  className?: string
}

export default function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <>
      <Navbar />
      <div className={`min-h-screen bg-[#0a0a0f] text-white pt-16 ${className}`}>{children}</div>
    </>
  )
}
