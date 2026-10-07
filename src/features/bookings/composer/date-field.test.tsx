import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateField } from './date-field';

describe('DateField', () => {
  it('shows the date and picks another from the calendar, past days disabled', async () => {
    const onChange = vi.fn();
    render(<DateField value="2026-10-08" min="2026-10-07" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Дата: 8 октября/ }));
    expect(await screen.findByRole('button', { name: /(^|\D)6 октября/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /(^|\D)15 октября/ }));
    expect(onChange).toHaveBeenCalledWith('2026-10-15');
  });

  it('is locked for an ongoing booking', () => {
    render(<DateField value="2026-10-08" disabled onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Дата: 8 октября/ })).toBeDisabled();
  });
});
