import { useRef, useState, useCallback, useId } from 'react';
import './LabelSlider.css';

interface LabelSliderProps {
	label: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	onChange: (value: number) => void;
	/** Format the display number. Defaults to rounded integer. */
	formatValue?: (value: number) => string;
	width?: number | string;
}

export default function LabelSlider({
	label,
	min,
	max,
	step = 1,
	value,
	onChange,
	formatValue,
	width = 120,
}: LabelSliderProps) {
	const [active, setActive] = useState(false);
	const [hovered, setHovered] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const id = useId();

	const displayValue = formatValue ? formatValue(value) : String(Math.round(value));
	const pct = ((value - min) / (max - min)) * 100;

	const showValue = active || hovered;

	const handlePointerDown = useCallback(() => {
		setActive(true);
	}, []);

	const handlePointerUp = useCallback(() => {
		setActive(false);
		inputRef.current?.blur();
	}, []);

	return (
		<div
			className="label-slider"
			style={{ width }}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => { setHovered(false); }}
		>
			{/* filled track */}
			<div className="label-slider-fill" style={{ width: `${pct}%` }} />

			{/* thumb indicator line */}
			<div className="label-slider-thumb" style={{ left: `${pct}%` }} />

			<input
				ref={inputRef}
				id={id}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(parseFloat(e.target.value))}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				className="label-slider-input"
			/>

			{/* single text slot — swaps content */}
			<span className="label-slider-text" aria-live="polite">
				{showValue ? displayValue : label}
			</span>
		</div>
	);
}
