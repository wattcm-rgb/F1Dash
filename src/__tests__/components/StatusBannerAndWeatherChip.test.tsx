import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBanner from '../../components/StatusBanner';
import WeatherChip from '../../components/WeatherChip';

// ---------------------------------------------------------------------------
// StatusBanner
// ---------------------------------------------------------------------------

describe('StatusBanner — content', () => {
  it.each(['grey', 'amber', 'red'] as const)(
    'renders children text with tone=%s',
    (tone) => {
      render(<StatusBanner tone={tone}>Status message</StatusBanner>);
      expect(screen.getByText('Status message')).not.toBeNull();
    },
  );

  it('renders arbitrary React children', () => {
    render(<StatusBanner tone="amber"><strong>Bold child</strong></StatusBanner>);
    expect(screen.getByText('Bold child')).not.toBeNull();
  });
});

describe('StatusBanner — dot animation', () => {
  function getDot(container: HTMLElement): HTMLElement {
    // The dot is the first <span> inside the banner container.
    return container.querySelector('span') as HTMLElement;
  }

  it('pulses (animation contains "pulse") when tone is grey', () => {
    const { container } = render(<StatusBanner tone="grey">msg</StatusBanner>);
    expect(getDot(container).style.animation).toContain('pulse');
  });

  it('does not pulse (animation is "none") when tone is amber', () => {
    const { container } = render(<StatusBanner tone="amber">msg</StatusBanner>);
    expect(getDot(container).style.animation).toBe('none');
  });

  it('does not pulse (animation is "none") when tone is red', () => {
    const { container } = render(<StatusBanner tone="red">msg</StatusBanner>);
    expect(getDot(container).style.animation).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// WeatherChip
// ---------------------------------------------------------------------------

describe('WeatherChip — content', () => {
  it('renders the label', () => {
    render(<WeatherChip label="Air Temp" value="25°C" />);
    expect(screen.getByText('Air Temp')).not.toBeNull();
  });

  it('renders the value', () => {
    render(<WeatherChip label="Air Temp" value="25°C" />);
    expect(screen.getByText('25°C')).not.toBeNull();
  });
});

describe('WeatherChip — accent colour', () => {
  it('applies a different colour when accent=true vs accent=false (default)', () => {
    const { unmount } = render(<WeatherChip label="Rain" value="Yes" accent={true} />);
    const accentColor = (screen.getByText('Yes') as HTMLElement).style.color;
    unmount();
    render(<WeatherChip label="Rain" value="Yes" accent={false} />);
    const defaultColor = (screen.getByText('Yes') as HTMLElement).style.color;
    expect(accentColor).not.toBe(defaultColor);
  });

  it('applies the same colour when accent=false and accent is omitted', () => {
    const { unmount } = render(<WeatherChip label="Rain" value="Yes" accent={false} />);
    const explicitFalse = (screen.getByText('Yes') as HTMLElement).style.color;
    unmount();
    render(<WeatherChip label="Rain" value="Yes" />);
    const omitted = (screen.getByText('Yes') as HTMLElement).style.color;
    expect(explicitFalse).toBe(omitted);
  });

  it('label colour is independent of the accent prop', () => {
    const { unmount } = render(<WeatherChip label="Rain" value="Yes" accent={true} />);
    const labelAccent = (screen.getByText('Rain') as HTMLElement).style.color;
    unmount();
    render(<WeatherChip label="Rain" value="Yes" accent={false} />);
    const labelDefault = (screen.getByText('Rain') as HTMLElement).style.color;
    expect(labelAccent).toBe(labelDefault);
  });
});
