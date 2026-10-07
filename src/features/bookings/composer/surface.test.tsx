import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type Presentation, Surface } from './surface';

describe('Surface', () => {
  it.each<Presentation>(['side', 'drawer', 'popover'])('renders as %s with an accessible name', async (presentation) => {
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const onClose = vi.fn();

    render(
      <Surface open presentation={presentation} anchor={anchor} label="Новая бронь" onClose={onClose}>
        <button type="button">Внутри</button>
      </Surface>,
    );

    expect(await screen.findByRole('dialog', { name: 'Новая бронь' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Внутри' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <Surface open={false} presentation="side" label="Новая бронь" onClose={vi.fn()}>
        <p>скрыто</p>
      </Surface>,
    );
    expect(screen.queryByText('скрыто')).not.toBeInTheDocument();
  });
});

describe('Surface closing', () => {
  it.each<Presentation>(['side', 'drawer', 'popover'])('%s reports when it has finished closing', async (presentation) => {
    const onExited = vi.fn();
    const props = { presentation, label: 'Новая бронь', onClose: vi.fn(), onExited, anchor: document.body };
    const { rerender } = render(
      <Surface open {...props}>
        <p>форма</p>
      </Surface>,
    );
    await screen.findByText('форма');
    expect(onExited).not.toHaveBeenCalled();

    rerender(
      <Surface open={false} {...props}>
        <p>форма</p>
      </Surface>,
    );
    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1));
  });
});
