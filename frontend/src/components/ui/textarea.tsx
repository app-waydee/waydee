import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { fieldClasses } from './input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldClasses, 'min-h-24 resize-y px-4 py-3 text-sm', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
