import { AlertTriangleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface FormAlertProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'error' | 'warning';
}

export function FormAlert({ title, children, action, tone = 'error' }: FormAlertProps) {
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-2xl p-4 text-sm', tone === 'error' ? 'bg-destructive/8' : 'bg-warning/10')}
    >
      <AlertTriangleIcon
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', tone === 'error' ? 'text-destructive' : 'text-warning')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-muted-foreground">{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
