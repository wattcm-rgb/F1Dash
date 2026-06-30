import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectorCell from '../../components/qualifying/SectorCell';

// fmtTime: sub-minute times render as "28.000", lap times as "1:23.456"
describe('SectorCell', () => {
  it('renders the formatted time for a sub-minute sector', () => {
    render(<SectorCell time={28.5} colour="green" />);
    expect(screen.getByText('28.500')).not.toBeNull();
  });

  it('renders a dash when time is null', () => {
    render(<SectorCell time={null} colour="grey" />);
    expect(screen.getByText('—')).not.toBeNull();
  });

  it('applies purple text colour for purple sector', () => {
    const { container } = render(<SectorCell time={27.5} colour="purple" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(168, 85, 247)');
  });

  it('applies green text colour for green sector', () => {
    const { container } = render(<SectorCell time={28.0} colour="green" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(74, 222, 128)');
  });

  it('applies yellow text colour for yellow sector', () => {
    const { container } = render(<SectorCell time={29.0} colour="yellow" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(250, 204, 21)');
  });

  it('applies grey text colour for grey sector', () => {
    const { container } = render(<SectorCell time={null} colour="grey" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('rgb(51, 65, 85)');
  });

  it('renders bold font weight for non-grey colours', () => {
    const { container } = render(<SectorCell time={28.0} colour="purple" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontWeight).toBe('700');
  });

  it('renders normal font weight for grey', () => {
    const { container } = render(<SectorCell time={null} colour="grey" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontWeight).toBe('400');
  });

  it('formats a lap-length time with minutes', () => {
    render(<SectorCell time={83.456} colour="green" />);
    expect(screen.getByText('1:23.456')).not.toBeNull();
  });

  it('pads seconds correctly for times just over a minute', () => {
    render(<SectorCell time={61.005} colour="yellow" />);
    expect(screen.getByText('1:01.005')).not.toBeNull();
  });
});
