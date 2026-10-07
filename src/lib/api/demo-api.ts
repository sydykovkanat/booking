import type { BookingInput } from '@/domain/booking';

/** Demo-only endpoints (enabled with NEXT_PUBLIC_DEMO_TOOLS=true). Not part of the product API. */
export const demoApi = {
  async occupy(range: BookingInput): Promise<boolean> {
    const res = await fetch('/api/demo/occupy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(range),
    });
    return res.ok;
  },

  async reset(): Promise<boolean> {
    const res = await fetch('/api/demo/reset', { method: 'POST' });
    return res.ok;
  },
};
