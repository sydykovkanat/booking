import { getContainer } from '@/server/container';
import { simulateLatency } from '@/server/demo';

export async function GET(request: Request) {
  await simulateLatency();
  return getContainer().handlers.list(request);
}

export async function POST(request: Request) {
  await simulateLatency();
  return getContainer().handlers.create(request);
}
