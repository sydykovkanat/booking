'use client';

import { IconX } from '@tabler/icons-react';
import type { ReactNode, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent } from '@/components/ui/popover';

/** `popover`: next to what was clicked. `side`: right-hand drawer (desktop). `drawer`: bottom sheet (phones). */
export type Presentation = 'popover' | 'side' | 'drawer';

interface SurfaceProps {
  open: boolean;
  presentation: Presentation;
  /** Popover only: the element to sit next to (a grid selection, a booking, a day cell). */
  anchor?: RefObject<Element | null> | Element | null;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * One place that decides *where* a panel appears: next to what was clicked on desktop,
 * a right-hand drawer when there is nothing to point at, a bottom drawer on phones.
 */
export function Surface({ open, presentation, anchor, label, onClose, children }: SurfaceProps) {
  const onOpenChange = (next: boolean) => !next && onClose();

  if (presentation === 'drawer') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
        <DrawerContent aria-label={label}>
          <DrawerTitle className="sr-only">{label}</DrawerTitle>
          <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (presentation === 'side') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
        <DrawerContent aria-label={label} className="data-[swipe-axis=x]:sm:[--drawer-content-width:28rem]">
          <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
            <DrawerTitle className="text-xl">{label}</DrawerTitle>
            <DrawerClose render={<Button variant="ghost" size="icon-sm" aria-label="Закрыть" />}>
              <IconX aria-hidden />
            </DrawerClose>
          </div>
          <div className="px-6 pb-6">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent
        anchor={anchor ?? undefined}
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        aria-label={label}
        className="w-[22rem] p-5"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
