import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-lg transition-colors'

  const variantStyles = {
    primary: 'bg-jikkei-accent hover:bg-jikkei-pink-700 text-white',
    secondary: 'bg-jikkei-black-700 hover:bg-jikkei-black-600 text-white',
    outline: 'border-2 border-jikkei-accent text-jikkei-accent hover:bg-jikkei-accent hover:text-jikkei-black-900',
  }

  const sizeStyles = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}
