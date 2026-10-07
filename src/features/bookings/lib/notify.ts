import { toast } from '@/components/ui/toast';

type NotifyType = 'success' | 'info' | 'error';

/** Thin wrapper over the kit's toast manager, so features do not depend on its API shape. */
export function notify(type: NotifyType, title: string, description?: string): void {
  toast.add({ type, title, description });
}
