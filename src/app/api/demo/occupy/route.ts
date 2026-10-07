import { bookingInputSchema } from '@/contracts/bookings';
import { getContainer } from '@/server/container';
import { demoToolsDisabled } from '@/server/demo';
import { handleErrors, parseJsonBody } from '@/server/http';

/** Demo only: another "user" books the given slot, so the next save hits a real 409. */
export async function POST(request: Request) {
  return (
    demoToolsDisabled() ??
    handleErrors(async () => {
      const { date, start, end } = await parseJsonBody(request, bookingInputSchema);
      const body = JSON.stringify({ date, start, end, title: 'Бронь коллеги (демо)' });
      return getContainer().handlers.create(new Request(request.url, { method: 'POST', body }));
    })
  );
}
