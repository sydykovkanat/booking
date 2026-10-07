'use client';

import { IconDoor, IconRestore } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { appConfig } from '@/config/app-config';
import { BOOKING_RULES } from '@/domain/config';

import { formatDuration } from '../lib/format';

const RULES = [
  `${BOOKING_RULES.workStart}–${BOOKING_RULES.workEnd}`,
  `${formatDuration(BOOKING_RULES.minDurationMinutes)} – ${formatDuration(BOOKING_RULES.maxDurationMinutes)}`,
  `шаг ${BOOKING_RULES.stepMinutes} мин`,
];

export function AppHeader({ onResetDemo }: { onResetDemo: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
        <IconDoor className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-semibold">Переговорка</p>
        <p className="truncate text-ui-sm text-muted-foreground">Бронирование на рабочий день</p>
      </div>

      <ul aria-label="Правила бронирования" className="hidden items-center gap-1.5 md:flex">
        {RULES.map((rule) => (
          <li key={rule} className="rounded-full bg-card px-3 py-1 text-ui-sm text-muted-foreground tabular-nums shadow-card">
            {rule}
          </li>
        ))}
      </ul>

      {appConfig.demoTools && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onResetDemo} aria-label="Сбросить демо-данные">
          <IconRestore aria-hidden />
          <span className="max-sm:hidden">Сбросить демо</span>
        </Button>
      )}
    </header>
  );
}
