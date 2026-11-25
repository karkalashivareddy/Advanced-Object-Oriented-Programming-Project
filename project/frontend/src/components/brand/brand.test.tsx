import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeartPulse, Route } from 'lucide-react';
import { BloodstreamVisual } from './BloodstreamVisual';
import { JourneyVessel } from './JourneyVessel';

function matchMedia(reduced: boolean) {
  return (query: string): MediaQueryList => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bloodstream brand visuals', () => {
  it('exposes a labelled illustration and animated cells by default', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));

    const { container } = render(<BloodstreamVisual label="Illustrative blood flow" />);

    expect(screen.getByRole('img', { name: 'Illustrative blood flow' })).toBeInTheDocument();
    expect(container.querySelectorAll('animateMotion').length).toBeGreaterThan(0);
  });

  it('removes motion cells when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', matchMedia(true));

    const { container } = render(<BloodstreamVisual label="Illustrative blood flow" />);

    expect(container.querySelectorAll('animateMotion')).toHaveLength(0);
  });

  it('presents the donor-to-delivery sequence as an ordered list', () => {
    render(
      <JourneyVessel
        stages={[
          { label: 'Donate', detail: 'Donation recorded', icon: HeartPulse },
          { label: 'Deliver', detail: 'Handover recorded', icon: Route },
        ]}
      />,
    );

    const journey = screen.getByRole('group', { name: 'Donor to delivery journey' });
    expect(journey.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Donate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deliver' })).toBeInTheDocument();
  });

  it('reveals the selected journey stage for pointer and keyboard users', () => {
    const { container } = render(<JourneyVessel stages={[
      { label: 'Donate', detail: 'Record donor consent.', icon: HeartPulse },
      { label: 'Deliver', detail: 'Confirm the handover.', icon: Route },
    ]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Deliver stage' }));

    expect(screen.getByRole('button', { name: 'Show Deliver stage' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('02 · Deliver')).toBeInTheDocument();
    expect(container.querySelector('.journey-vessel__selection')).toHaveTextContent('Confirm the handover.');
  });
});
