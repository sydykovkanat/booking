'use client';

import { useQueryClient } from '@tanstack/react-query';

import { demoApi } from '@/lib/api/demo-api';

import { bookingKeys } from '../api/query-keys';
import { notify } from '../lib/notify';

/** Demo only: restore the seed data and refresh every cached list. */
export function useResetDemo(onDone: () => void) {
  const queryClient = useQueryClient();

  return async () => {
    if (!(await demoApi.reset())) {
      notify('error', 'Не удалось сбросить данные');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    onDone();
    notify('success', 'Данные сброшены к демо-набору');
  };
}
