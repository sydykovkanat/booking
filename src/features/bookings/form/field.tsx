import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}

export const fieldErrorId = (id: string) => `${id}-error`;
export const fieldHintId = (id: string) => `${id}-hint`;

/** Label + control + hint/error. The control must reference the ids via aria-describedby. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={fieldErrorId(id)} className="text-[13px] text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={fieldHintId(id)} className="text-[13px] text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function describedBy(id: string, error: string | undefined, hasHint = false): string | undefined {
  if (error) return fieldErrorId(id);
  return hasHint ? fieldHintId(id) : undefined;
}
