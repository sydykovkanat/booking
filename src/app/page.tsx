import { Suspense } from 'react';

import { BookingsScreen } from '@/features/bookings/components/bookings-screen';

export default function HomePage() {
  return (
    <Suspense>
      <BookingsScreen />
    </Suspense>
  );
}
