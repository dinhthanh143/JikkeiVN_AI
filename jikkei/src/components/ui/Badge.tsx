import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  children: ReactNode
}

export default function Badge({
  variant = 'primary',
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    primary: 'bg-jikkei-accent text-white',
    secondary: 'bg-jikkei-black-700 text-jikkei-accent',
    success: 'bg-green-500 text-white',
    warning: 'bg-yellow-500 text-white',
    danger: 'bg-red-500 text-white',
  }

  return (
    <div
      className={cn('inline-block px-3 py-1 rounded-full text-sm font-semibold', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}
