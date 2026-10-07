import 'server-only';

import { appConfig } from '@/config/app-config';
import { getRoomNow } from '@/domain/time';

import { createBookingHandlers, type BookingHandlers } from './handlers';
import { createInMemoryRepository, type BookingsRepository } from './repository';
import { createSeed } from './seed';

const clock = () => new Date();

// Only the data survives hot reloads in dev; handlers are rebuilt so code changes apply.
const globalForRepository = globalThis as typeof globalThis & { __bookingRepository?: BookingsRepository };

function getRepository(): BookingsRepository {
  globalForRepository.__bookingRepository ??= createInMemoryRepository(
    createSeed(getRoomNow(clock(), appConfig.roomTimeZone)),
  );
  return globalForRepository.__bookingRepository;
}

export function getContainer(): { repository: BookingsRepository; handlers: BookingHandlers } {
  const repository = getRepository();
  return { repository, handlers: createBookingHandlers({ repository, clock, timeZone: appConfig.roomTimeZone }) };
}

export function resetToSeed(): void {
  getRepository().reset(createSeed(getRoomNow(clock(), appConfig.roomTimeZone)));
}
