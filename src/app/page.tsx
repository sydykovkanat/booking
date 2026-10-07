import { Suspense } from 'react';

import { CalendarScreen } from '@/features/bookings/components/calendar-screen';

export default function HomePage() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
