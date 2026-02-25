import React, { useRef, useEffect, useState } from 'react';
import './VideoPlayer.css';

interface TimelineProps {
	progress: number;
	duration: number;
	inPoint: number | null;
	outPoint: number | null;
	onSeek: (value: number) => void;
	fps?: number;
	annotations?: Record<number, string>;
	trimView?: boolean;
	onToggleTrimView?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
	progress,
	duration,
	inPoint,
	outPoint,
	onSeek,
	fps = 24,
	annotations = {},
	trimView = false,
	onToggleTrimView,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') ?? '');

	// Watch for theme changes
	useEffect(() => {
		const observer = new MutationObserver(() => {
			setTheme(document.documentElement.getAttribute('data-theme') ?? '');
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	}, []);

	// Handle Resize
	useEffect(() => {
		const updateSize = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.clientWidth,
					height: containerRef.current.clientHeight
				});
			}
		};

		updateSize();
		window.addEventListener('resize', updateSize);
		return () => window.removeEventListener('resize', updateSize);
	}, []);

	// Draw Timeline
	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx || dimensions.width === 0) return;

		const { width, height } = dimensions;
		// Set canvas size for high DPI
		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);

		// Read theme colors from CSS variables
		const style = getComputedStyle(document.documentElement);
		const bgColor = style.getPropertyValue('--color-bg-secondary').trim() || '#f5f5f7';
		const majorTickColor = style.getPropertyValue('--color-text-secondary').trim() || '#999';
		const minorTickColor = style.getPropertyValue('--color-border').trim() || '#ddd';

		// Clear
		ctx.clearRect(0, 0, width, height);

		// --- Background ---
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, width, height);

		if (duration <= 0) return;

		// In trim view mode, the visible window is [rangeStart, rangeEnd]
		const rangeStart = trimView && inPoint !== null ? inPoint : 0;
		const rangeEnd = trimView && outPoint !== null ? outPoint : duration;
		const rangeDuration = rangeEnd - rangeStart;

		if (rangeDuration <= 0) return;

		// Trim view indicator: subtle tinted background
		if (trimView && (inPoint !== null || outPoint !== null)) {
			ctx.fillStyle = 'rgba(0, 168, 255, 0.06)';
			ctx.fillRect(0, 0, width, height);
		}

		const totalFrames = Math.floor(rangeDuration * fps);
		const pxPerFrame = totalFrames > 0 ? width / totalFrames : 0;

		// --- Ticks & Annotation Markers ---
		const tickStride = pxPerFrame < 2 ? Math.ceil(2 / pxPerFrame) : 1;

		for (let f = 0; f < totalFrames; f++) {
			const absTime = rangeStart + (f / fps);
			const absFrame = Math.round(absTime * fps);
			const x = (f / totalFrames) * width;
			const isAnnotation = !!annotations[absFrame];

			if (isAnnotation) {
				ctx.fillStyle = '#FFD700';
				ctx.fillRect(x, 0, Math.max(1, pxPerFrame), height);
			} else if (f % tickStride === 0) {
				if (f % Math.round(fps) === 0) {
					ctx.fillStyle = majorTickColor;
					ctx.fillRect(x, height * 0.5, 1, height * 0.5);
				} else {
					ctx.fillStyle = minorTickColor;
					ctx.fillRect(x, height * 0.7, 1, height * 0.3);
				}
			}
		}

		// --- In/Out Points (only in full view) ---
		if (!trimView) {
			if (inPoint !== null) {
				const x = (inPoint / duration) * width;
				ctx.fillStyle = '#00a8ff';
				ctx.fillRect(x, 0, 2, height);
				ctx.fillRect(x, 0, 6, 4);
			}
			if (outPoint !== null) {
				const x = (outPoint / duration) * width;
				ctx.fillStyle = '#00a8ff';
				ctx.fillRect(x - 2, 0, 2, height);
				ctx.fillRect(x - 6, 0, 6, 4);
			}

			// --- Active Range ---
			if (inPoint !== null || outPoint !== null) {
				const start = inPoint !== null ? (inPoint / duration) * width : 0;
				const end = outPoint !== null ? (outPoint / duration) * width : width;
				ctx.fillStyle = 'rgba(0, 168, 255, 0.1)';
				ctx.fillRect(start, 0, end - start, height);
			}
		} else {
			// In trim view: draw edge markers at the boundaries
			if (inPoint !== null) {
				ctx.fillStyle = '#00a8ff';
				ctx.fillRect(0, 0, 3, height);
				ctx.fillRect(0, 0, 8, 4);
			}
			if (outPoint !== null) {
				ctx.fillStyle = '#00a8ff';
				ctx.fillRect(width - 3, 0, 3, height);
				ctx.fillRect(width - 8, 0, 8, 4);
			}
		}

		// --- Playhead ---
		// Map progress (0–100 over full duration) to x position within current view
		const currentTime = (progress / 100) * duration;
		const playheadX = trimView
			? ((currentTime - rangeStart) / rangeDuration) * width
			: (progress / 100) * width;

		// Only draw playhead if within view
		if (playheadX >= 0 && playheadX <= width) {
			ctx.fillStyle = '#007aff';
			ctx.fillRect(playheadX - 1, 0, 2, height);
			ctx.beginPath();
			ctx.moveTo(playheadX, height);
			ctx.lineTo(playheadX - 5, height - 8);
			ctx.lineTo(playheadX + 5, height - 8);
			ctx.fill();
		}

	}, [dimensions, progress, duration, fps, annotations, inPoint, outPoint, theme, trimView]);


	// Interaction: translate click position to seek percentage
	const handleInteraction = (clientX: number) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
		const ratio = x / rect.width;

		if (trimView && (inPoint !== null || outPoint !== null)) {
			const rangeStart = inPoint ?? 0;
			const rangeEnd = outPoint ?? duration;
			const seekTime = rangeStart + ratio * (rangeEnd - rangeStart);
			onSeek((seekTime / duration) * 100);
		} else {
			onSeek(ratio * 100);
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button !== 0) return;
		handleInteraction(e.clientX);

		const handleWindowMouseMove = (e: MouseEvent) => {
			handleInteraction(e.clientX);
		};
		const handleWindowMouseUp = () => {
			document.removeEventListener('mousemove', handleWindowMouseMove);
			document.removeEventListener('mouseup', handleWindowMouseUp);
		};
		document.addEventListener('mousemove', handleWindowMouseMove);
		document.addEventListener('mouseup', handleWindowMouseUp);
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		onToggleTrimView?.();
	};

	return (
		<div
			ref={containerRef}
			className="timeline-container"
			style={{ height: '30px', background: 'var(--color-bg-secondary)', cursor: 'pointer', position: 'relative' }}
			onMouseDown={handleMouseDown}
			onContextMenu={handleContextMenu}
			title={trimView ? 'Trim View (right-click to exit)' : 'Right-click to zoom to In/Out range'}
		>
			<canvas
				ref={canvasRef}
				style={{ width: '100%', height: '100%', display: 'block' }}
			/>
		</div>
	);
};
