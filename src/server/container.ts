import 'server-only';

import { appConfig } from '@/config/app-config';
import { getRoomNow } from '@/domain/time';

import { createBookingHandlers, type BookingHandlers } from './handlers';
import { createInMemoryRepository, type BookingsRepository } from './repository';
import { createSeed } from './seed';

interface Container {
  repository: BookingsRepository;
  handlers: BookingHandlers;
}

const clock = () => new Date();

function createContainer(): Container {
  const repository = createInMemoryRepository(createSeed(getRoomNow(clock(), appConfig.roomTimeZone)));
  return {
    repository,
    handlers: createBookingHandlers({ repository, clock, timeZone: appConfig.roomTimeZone }),
  };
}

// Survives hot reloads in dev, so the in-memory data is not wiped on every edit.
const globalForContainer = globalThis as typeof globalThis & { __bookingContainer?: Container };

export function getContainer(): Container {
  globalForContainer.__bookingContainer ??= createContainer();
  return globalForContainer.__bookingContainer;
}

export function resetToSeed(): void {
  getContainer().repository.reset(createSeed(getRoomNow(clock(), appConfig.roomTimeZone)));
}
