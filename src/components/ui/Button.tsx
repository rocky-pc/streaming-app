'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:pointer-events-none'

    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
      secondary: 'bg-gray-800 text-white hover:bg-gray-700 active:bg-gray-600 border border-gray-700',
      outline: 'border border-gray-700 bg-transparent hover:bg-gray-800 active:bg-gray-900',
      ghost: 'bg-transparent hover:bg-gray-800 active:bg-gray-900',
      destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm rounded-md',
      md: 'h-10 px-4 py-2 text-sm rounded-md',
      lg: 'h-12 px-6 text-base rounded-lg',
      icon: 'h-10 w-10 rounded-md',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
            <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }