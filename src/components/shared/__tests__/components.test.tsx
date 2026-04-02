import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from '../CollapsibleSection';
import { IconButton } from '../IconButton';
import { Tooltip } from '../Tooltip';
import { Badge } from '../Badge';
import { Slider } from '../../ControlPanel/Slider';
import { NumberInput } from '../../ControlPanel/NumberInput';

// ---------- CollapsibleSection ----------

describe('CollapsibleSection', () => {
  it('renders title and children when open', () => {
    render(
      <CollapsibleSection title="Body A" defaultOpen>
        <span>child content</span>
      </CollapsibleSection>
    );
    expect(screen.getByText('Body A')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('hides children when defaultOpen=false', () => {
    render(
      <CollapsibleSection title="Body B" defaultOpen={false}>
        <span>hidden content</span>
      </CollapsibleSection>
    );
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('toggles open/closed on header click', () => {
    render(
      <CollapsibleSection title="Toggle" defaultOpen>
        <span>toggled child</span>
      </CollapsibleSection>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('toggled child')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText('toggled child')).toBeInTheDocument();
  });

  it('renders color dot when bodyColor is provided', () => {
    const { container } = render(
      <CollapsibleSection title="Red" bodyColor="#cc4444" defaultOpen>
        <span />
      </CollapsibleSection>
    );
    // dot is aria-hidden, check by class suffix
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('sets --body-color CSS variable when bodyColor is provided', () => {
    const { container } = render(
      <CollapsibleSection title="Red" bodyColor="#cc4444" defaultOpen>
        <span />
      </CollapsibleSection>
    );
    const section = container.firstChild as HTMLElement;
    expect(section.style.getPropertyValue('--body-color')).toBe('#cc4444');
  });

  it('does not render dot when bodyColor is omitted', () => {
    const { container } = render(
      <CollapsibleSection title="No color" defaultOpen>
        <span />
      </CollapsibleSection>
    );
    // The chevron SVG is also aria-hidden; check specifically for the dot by role (presentational circle)
    // The dot is a <span>, not an SVG — verify no span with aria-hidden exists
    const ariaHiddenSpans = container.querySelectorAll('span[aria-hidden="true"]');
    expect(ariaHiddenSpans.length).toBe(0);
  });
});

// ---------- IconButton ----------

describe('IconButton', () => {
  it('renders icon and fires onClick', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<svg data-testid="icon" />} onClick={onClick} title="Play" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire onClick when disabled=true', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<span />} onClick={onClick} disabled title="Reset" />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sets aria-label from title', () => {
    render(<IconButton icon={<span />} onClick={() => {}} title="Pause" />);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });
});

// ---------- Tooltip ----------

describe('Tooltip', () => {
  it('renders children and tooltip text', () => {
    render(
      <Tooltip text="Hint text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hint text');
  });
});

// ---------- Badge ----------

describe('Badge', () => {
  it('renders the provided text', () => {
    render(<Badge text="Chaotic" />);
    expect(screen.getByText('Chaotic')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge text="Stable" />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });
});

// ---------- Slider ----------

describe('Slider', () => {
  it('renders a range input with correct min/max/step/value', () => {
    render(<Slider value={5} min={1} max={10} step={0.5} onChange={() => {}} />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    expect(input.type).toBe('range');
    expect(input.min).toBe('1');
    expect(input.max).toBe('10');
    expect(input.step).toBe('0.5');
    expect(input.value).toBe('5');
  });

  it('calls onChange with the numeric value', () => {
    const onChange = vi.fn();
    render(<Slider value={3} min={0} max={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('sets --body-color CSS variable when bodyColor provided', () => {
    const { container } = render(
      <Slider value={5} min={0} max={10} onChange={() => {}} bodyColor="#44cc66" />
    );
    const input = container.firstChild as HTMLElement;
    expect(input.style.getPropertyValue('--body-color')).toBe('#44cc66');
  });

  it('maps value through log scale in logarithmic mode', () => {
    const onChange = vi.fn();
    render(<Slider value={10} min={1} max={1000} onChange={onChange} logarithmic />);
    const input = screen.getByRole('slider') as HTMLInputElement;
    // log(10)/log(1000) = 1/3 ≈ 0.333 — the internal value for 10 in [1,1000] log-scale
    const internal = parseFloat(input.value);
    expect(internal).toBeGreaterThan(0.3);
    expect(internal).toBeLessThan(0.37);
  });

  it('fires onChange with a back-converted value in logarithmic mode', () => {
    const onChange = vi.fn();
    render(<Slider value={1} min={1} max={1000} onChange={onChange} logarithmic />);
    // Drag to the middle of [0,1] → should back-convert to ~√1000 ≈ 31.6
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } });
    const emitted = onChange.mock.calls[0][0] as number;
    expect(emitted).toBeGreaterThan(25);
    expect(emitted).toBeLessThan(40);
  });
});

// ---------- NumberInput ----------

describe('NumberInput', () => {
  it('displays the current value', () => {
    render(<NumberInput value={42} min={0} max={100} onChange={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('42');
  });

  it('clamps above max on blur', () => {
    const onChange = vi.fn();
    render(<NumberInput value={50} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('clamps below min on blur', () => {
    const onChange = vi.fn();
    render(<NumberInput value={50} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '-10' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('reverts non-numeric input to last valid value on blur', () => {
    const onChange = vi.fn();
    render(<NumberInput value={50} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('50');
  });

  it('does not call onChange when the value is unchanged after clamping', () => {
    const onChange = vi.fn();
    render(<NumberInput value={50} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('submits valid value on Enter', () => {
    const onChange = vi.fn();
    render(<NumberInput value={10} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '77' } });
    // keyDown calls handleBlur() directly (jsdom doesn't propagate element.blur() as synthetic onBlur)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(77);
  });

  it('reverts to last valid value on Escape', () => {
    const onChange = vi.fn();
    render(<NumberInput value={30} min={0} max={100} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('30');
  });

  it('sets --body-color CSS variable when bodyColor provided', () => {
    const { container } = render(
      <NumberInput value={1} min={0} max={10} onChange={() => {}} bodyColor="#4466cc" />
    );
    const input = container.firstChild as HTMLElement;
    expect(input.style.getPropertyValue('--body-color')).toBe('#4466cc');
  });
});
