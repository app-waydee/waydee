import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Core 2.0 tablosu: çerçevesiz, satırlar yalnızca hairline ayraçla bölünür. */
export function DashTable({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function DashTh({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('px-3 pb-3 text-left text-[13px] font-semibold text-faint first:pl-0 last:pr-0', className)}
      {...props}
    />
  )
}

export function DashTr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-t border-line transition-colors hover:bg-subtle/60', className)} {...props} />
}

export function DashTd({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-4 align-middle first:pl-0 last:pr-0', className)} {...props} />
}

export function DashTableFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-5 flex items-center justify-between gap-3 border-t border-line pt-5 text-sm font-semibold text-muted',
        className,
      )}
      {...props}
    />
  )
}
