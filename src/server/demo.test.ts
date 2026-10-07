import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./demo');
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('demo helpers', () => {
  it('hides demo endpoints unless enabled', async () => {
    const off = await load({ NEXT_PUBLIC_DEMO_TOOLS: 'false' });
    expect(off.demoToolsDisabled()?.status).toBe(404);

    const on = await load({ NEXT_PUBLIC_DEMO_TOOLS: 'true' });
    expect(on.demoToolsDisabled()).toBeNull();
  });

  it('resolves immediately without configured latency', async () => {
    const { simulateLatency } = await load({ DEMO_LATENCY_MS: '' });
    await expect(simulateLatency()).resolves.toBeUndefined();
  });

  it('waits within the configured range, capped at 5s', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const { simulateLatency } = await load({ DEMO_LATENCY_MS: '100-99999' });

    let done = false;
    void simulateLatency().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
