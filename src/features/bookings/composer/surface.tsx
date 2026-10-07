'use client';

import type { ReactNode, RefObject } from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent } from '@/components/ui/popover';

export type Presentation = 'popover' | 'dialog' | 'drawer';

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
 * a dialog when there is nothing to point at, a bottom drawer on phones.
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

  if (presentation === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-label={label} className="sm:max-w-md">
          {children}
        </DialogContent>
      </Dialog>
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
