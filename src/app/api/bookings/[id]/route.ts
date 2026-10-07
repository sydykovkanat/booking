import { getContainer } from '@/server/container';
import { simulateLatency } from '@/server/demo';

export async function PATCH(request: Request, ctx: RouteContext<'/api/bookings/[id]'>) {
  const { id } = await ctx.params;
  await simulateLatency();
  return getContainer().handlers.update(request, id);
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/bookings/[id]'>) {
  const { id } = await ctx.params;
  await simulateLatency();
  return getContainer().handlers.remove(id);
}
