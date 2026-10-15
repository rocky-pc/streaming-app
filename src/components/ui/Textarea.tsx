'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200 resize-y min-h-[100px]',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${textareaId}-helper`} className="mt-1.5 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }