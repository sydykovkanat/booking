import 'server-only';

import { appConfig } from '@/config/app-config';

const MAX_LATENCY_MS = 5_000;

function latencyRange(): [number, number] {
  const [min = 0, max = min] = (process.env.DEMO_LATENCY_MS ?? '')
    .split('-')
    .map((v) => Math.min(Math.max(Number(v) || 0, 0), MAX_LATENCY_MS));
  return [min, Math.max(min, max)];
}

/** Artificial latency so loading and submitting states are visible on the demo. */
export async function simulateLatency(): Promise<void> {
  const [min, max] = latencyRange();
  if (max === 0) return;
  const ms = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function demoToolsDisabled(): Response | null {
  return appConfig.demoTools ? null : new Response(null, { status: 404 });
}
