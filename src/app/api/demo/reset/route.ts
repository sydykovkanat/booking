import { resetToSeed } from '@/server/container';
import { demoToolsDisabled } from '@/server/demo';

export async function POST() {
  const disabled = demoToolsDisabled();
  if (disabled) return disabled;
  resetToSeed();
  return new Response(null, { status: 204 });
}
