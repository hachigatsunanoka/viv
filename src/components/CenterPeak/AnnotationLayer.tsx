import React, { useRef, useEffect, useCallback } from 'react';
import type { DrawingState } from '../../hooks/useDrawing';
import { GRUNGE_TEXTURE_SIZE, GRUNGE_SCRATCH_COUNT } from '../../constants';

interface AnnotationLayerProps {
	width: number;
	height: number;
	currentFrame: number;
	isPlaying: boolean;
	annotations: Record<number, string>; // Frame -> DataURL
	onUpdateAnnotation: (frame: number, dataUrl: string) => void;
	drawingState: DrawingState;
}

// Procedurally generate a grunge texture (512x512 alpha-channel dots + circle fade)
const createGrungeTexture = (): HTMLImageElement => {
	const size = GRUNGE_TEXTURE_SIZE;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d')!;

	ctx.clearRect(0, 0, size, size);

	// Layer 1: scattered dots
	for (let i = 0; i < size * size * 0.25; i++) {
		const x = Math.random() * size;
		const y = Math.random() * size;
		const r = Math.random() * 2.5 + 0.3;
		ctx.globalAlpha = Math.random() * 0.9 + 0.1;
		ctx.fillStyle = '#000000';
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}

	// Layer 2: short scratchy strokes
	ctx.lineWidth = 1;
	ctx.strokeStyle = '#000000';
	for (let i = 0; i < GRUNGE_SCRATCH_COUNT; i++) {
		const x = Math.random() * size;
		const y = Math.random() * size;
		const len = Math.random() * 10 + 2;
		const angle = Math.random() * Math.PI * 2;
		ctx.globalAlpha = Math.random() * 0.6 + 0.1;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
		ctx.stroke();
	}

	ctx.globalAlpha = 1;

	// Apply radial fade mask: opaque center to transparent edge
	const cx = size / 2;
	const cy = size / 2;
	const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
	gradient.addColorStop(0, 'rgba(0,0,0,1)');
	gradient.addColorStop(0.55, 'rgba(0,0,0,0.85)');
	gradient.addColorStop(0.8, 'rgba(0,0,0,0.3)');
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.globalCompositeOperation = 'destination-in';
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);
	ctx.globalCompositeOperation = 'source-over';

	const img = new Image();
	img.src = canvas.toDataURL('image/png');
	return img;
};

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
	width,
	height,
	currentFrame,
	isPlaying,
	annotations,
	onUpdateAnnotation,
	drawingState
}) => {
	const {
		activeTool,
		brushColor,
		brushSize,
		grungeSize,
		eraserSize,
		brushOpacity,
		grungeOpacity,
		eraserOpacity,
		ghostingEnabled,
		onionSkinFrames
	} = drawingState;

	// Pick the right size/opacity for the active tool
	const activeSize = activeTool === 'grunge' ? grungeSize : activeTool === 'eraser' ? eraserSize : brushSize;
	const activeOpacity = activeTool === 'grunge' ? grungeOpacity : activeTool === 'eraser' ? eraserOpacity : brushOpacity;

	const displayCanvasRef = useRef<HTMLCanvasElement>(null);
	const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

	// Backing buffer holds committed annotation state for the current frame
	const backingBufferRef = useRef<HTMLCanvasElement | null>(null);
	const currentlyRenderedUrlRef = useRef<string | null>(null);

	// Stroke canvas: accumulates current brush/grunge stroke at full opacity,
	// composited at activeOpacity to display — prevents gaps and opacity accumulation
	const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);

	// Reusable offscreen canvas for grunge stamp (avoids per-stamp allocation)
	const grungeOffscreenRef = useRef<HTMLCanvasElement | null>(null);
	const grungeOffscreenSizeRef = useRef<number>(0);

	// Reusable canvas for committing strokes in stopDrawing (avoids per-stroke allocation)
	const commitCanvasRef = useRef<HTMLCanvasElement | null>(null);

	// Image cache: DataURL -> HTMLImageElement (avoids re-decoding same onion skin frames)
	const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

	const drawingFrameRef = useRef<number | null>(null);
	const lastPointRef = useRef<{ x: number; y: number } | null>(null);
	const rafRef = useRef<number | null>(null);
	const isDrawingRef = useRef(false);

	// Keep refs to current values for RAF closure
	const activeOpacityRef = useRef(activeOpacity);
	useEffect(() => { activeOpacityRef.current = activeOpacity; }, [activeOpacity]);

	// Keep refs for values used inside RAF/callbacks (avoid stale closures)
	const ghostingEnabledRef = useRef(ghostingEnabled);
	const isPlayingRef = useRef(isPlaying);
	const onionSkinFramesRef = useRef(onionSkinFrames);
	const annotationsRef = useRef(annotations);
	const currentFrameRef = useRef(currentFrame);
	useEffect(() => { ghostingEnabledRef.current = ghostingEnabled; }, [ghostingEnabled]);
	useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
	useEffect(() => { onionSkinFramesRef.current = onionSkinFrames; }, [onionSkinFrames]);
	useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
	useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);

	const grungeImageRef = useRef<HTMLImageElement | null>(null);

	useEffect(() => {
		const img = createGrungeTexture();
		img.onload = () => { grungeImageRef.current = img; };
		if (img.complete) grungeImageRef.current = img;
	}, []);

	// Evict stale image cache entries when annotations change
	useEffect(() => {
		const cache = imageCacheRef.current;
		const validUrls = new Set(Object.values(annotations));
		for (const key of cache.keys()) {
			if (!validUrls.has(key)) cache.delete(key);
		}
	}, [annotations]);

	// Ref to always-current renderDisplayLayer — avoids forward-reference issues with updateBackingBuffer/getCachedImage
	const renderDisplayLayerRef = useRef<(() => void) | null>(null);

	// Get (or load) a cached image for a DataURL.
	// Returns the image immediately if already decoded; otherwise starts loading and returns null.
	const getCachedImage = useCallback((src: string): HTMLImageElement | null => {
		const cache = imageCacheRef.current;
		if (cache.has(src)) {
			const img = cache.get(src)!;
			return img.complete ? img : null;
		}
		const img = new Image();
		img.onload = () => {
			// Trigger a redraw once the image is ready (only relevant for onion skins loaded after first render)
			if (!isDrawingRef.current) {
				renderDisplayLayerRef.current?.();
			}
		};
		img.src = src;
		cache.set(src, img);
		return img.complete ? img : null;
	}, []);

	const updateBackingBuffer = useCallback((dataUrl: string) => {
		if (!backingBufferRef.current) return;
		if (backingBufferRef.current.width === 0 || backingBufferRef.current.height === 0) return;

		const ctx = backingBufferRef.current.getContext('2d');
		if (!ctx) return;

		// Use cache to avoid redundant Image decoding
		const cached = imageCacheRef.current.get(dataUrl);
		if (cached && cached.complete) {
			ctx.clearRect(0, 0, backingBufferRef.current.width, backingBufferRef.current.height);
			ctx.drawImage(cached, 0, 0, backingBufferRef.current.width, backingBufferRef.current.height);
			currentlyRenderedUrlRef.current = dataUrl;
			renderDisplayLayerRef.current?.();
			return;
		}

		const img = new Image();
		img.onload = () => {
			if (!backingBufferRef.current || backingBufferRef.current.width === 0) return;
			ctx.clearRect(0, 0, backingBufferRef.current.width, backingBufferRef.current.height);
			ctx.drawImage(img, 0, 0, backingBufferRef.current.width, backingBufferRef.current.height);
			currentlyRenderedUrlRef.current = dataUrl;
			imageCacheRef.current.set(dataUrl, img);
			renderDisplayLayerRef.current?.();
		};
		img.src = dataUrl;
	}, []);

	// Draw onion skin frames onto the given context synchronously (using image cache).
	// Only draws images that are already decoded; skips frames not yet loaded.
	const drawOnionSkins = useCallback((context: CanvasRenderingContext2D) => {
		if (!ghostingEnabledRef.current || isPlayingRef.current) return;
		const ann = annotationsRef.current;
		const frame = currentFrameRef.current;
		const skinFrames = onionSkinFramesRef.current;

		const framesToDraw: { frame: number; opacity: number }[] = [];
		for (let i = 1; i <= skinFrames; i++) {
			if (ann[frame - i]) framesToDraw.push({ frame: frame - i, opacity: 0.3 - (i * 0.05) });
		}
		for (let i = 1; i <= skinFrames; i++) {
			if (ann[frame + i]) framesToDraw.push({ frame: frame + i, opacity: 0.3 - (i * 0.05) });
		}

		for (const { frame: f, opacity } of framesToDraw) {
			const img = getCachedImage(ann[f]);
			if (!img) continue; // not yet decoded — will re-render via onload callback
			context.globalAlpha = Math.max(0.05, opacity);
			context.drawImage(img, 0, 0, width, height);
		}
		context.globalAlpha = 1.0;
	}, [width, height, getCachedImage]);

	const renderDisplayLayer = useCallback((ctx: CanvasRenderingContext2D | null = null) => {
		if (width === 0 || height === 0) return;
		const context = ctx || displayCanvasRef.current?.getContext('2d');
		if (!context) return;

		context.clearRect(0, 0, width, height);

		// Onion skins (before current frame content so they appear underneath)
		drawOnionSkins(context);

		// Current frame from backing buffer
		if (backingBufferRef.current) {
			context.globalAlpha = 1.0;
			context.drawImage(backingBufferRef.current, 0, 0, width, height);
		} else if (annotations[currentFrame]) {
			const img = getCachedImage(annotations[currentFrame]);
			if (img) {
				context.globalAlpha = 1.0;
				context.drawImage(img, 0, 0, width, height);
			}
		}
	}, [width, height, annotations, currentFrame, drawOnionSkins, getCachedImage]);

	useEffect(() => {
		renderDisplayLayerRef.current = renderDisplayLayer;
	}, [renderDisplayLayer]);

	// Render display with active stroke overlay (for brush/grunge preview).
	// Also draws onion skins so they remain visible during drawing.
	const renderWithStroke = useCallback(() => {
		if (width === 0 || height === 0) return;
		const context = displayCanvasRef.current?.getContext('2d');
		if (!context) return;

		context.clearRect(0, 0, width, height);

		// Onion skins — drawn first so they sit underneath committed + active stroke
		drawOnionSkins(context);

		// Committed state
		if (backingBufferRef.current) {
			context.globalAlpha = 1.0;
			context.drawImage(backingBufferRef.current, 0, 0, width, height);
		}

		// Active stroke at activeOpacity
		if (strokeCanvasRef.current) {
			context.globalAlpha = activeOpacityRef.current;
			context.drawImage(strokeCanvasRef.current, 0, 0, width, height);
			context.globalAlpha = 1.0;
		}
	}, [width, height, drawOnionSkins]);

	useEffect(() => {
		if (width === 0 || height === 0) return;

		const setupCanvas = (canvas: HTMLCanvasElement | null, enableContext = false) => {
			if (!canvas) return null;
			canvas.width = width;
			canvas.height = height;
			if (enableContext) {
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					return ctx;
				}
			}
			return null;
		};

		const displayCtx = setupCanvas(displayCanvasRef.current, true);
		setupCanvas(drawingCanvasRef.current, true);

		if (!backingBufferRef.current) {
			backingBufferRef.current = document.createElement('canvas');
		}
		setupCanvas(backingBufferRef.current, false);

		if (!strokeCanvasRef.current) {
			strokeCanvasRef.current = document.createElement('canvas');
		}
		strokeCanvasRef.current.width = width;
		strokeCanvasRef.current.height = height;

		// Resize commit canvas (reused in stopDrawing)
		if (!commitCanvasRef.current) {
			commitCanvasRef.current = document.createElement('canvas');
		}
		commitCanvasRef.current.width = width;
		commitCanvasRef.current.height = height;

		// Reload annotation for current frame into backing buffer after canvas resize
		const url = annotationsRef.current[currentFrameRef.current];
		if (url) {
			currentlyRenderedUrlRef.current = null; // force reload
			updateBackingBuffer(url);
		} else {
			renderDisplayLayer(displayCtx);
		}
	}, [width, height, updateBackingBuffer, renderDisplayLayer]);

	useEffect(() => {
		renderDisplayLayer();
	}, [ghostingEnabled, onionSkinFrames, isPlaying, width, height, renderDisplayLayer]);

	const lastSyncedFrameRef = useRef<number | null>(null);

	useEffect(() => {
		const frameChanged = lastSyncedFrameRef.current !== currentFrame;
		lastSyncedFrameRef.current = currentFrame;

		const url = annotations[currentFrame];
		if (url) {
			if (!frameChanged && url === currentlyRenderedUrlRef.current) return;
			updateBackingBuffer(url);
		} else {
			currentlyRenderedUrlRef.current = null;
			if (backingBufferRef.current) {
				const ctx = backingBufferRef.current.getContext('2d');
				if (ctx && backingBufferRef.current.width > 0 && backingBufferRef.current.height > 0) {
					ctx.clearRect(0, 0, backingBufferRef.current.width, backingBufferRef.current.height);
				}
			}
			renderDisplayLayer();
		}
	}, [currentFrame, annotations, updateBackingBuffer, renderDisplayLayer]);

	const getCoordinates = (e: React.MouseEvent) => {
		const canvas = drawingCanvasRef.current;
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		const scaleX = width / rect.width;
		const scaleY = height / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	};

	const normalizedBrushSize = activeSize * (Math.min(width, height) / 1080);

	const stampGrunge = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
		if (!grungeImageRef.current || !grungeImageRef.current.complete) return;
		const size = normalizedBrushSize * 6;
		const gImg = grungeImageRef.current;

		// Reuse offscreen canvas — only recreate when stamp size changes
		if (!grungeOffscreenRef.current) {
			grungeOffscreenRef.current = document.createElement('canvas');
		}
		const off = grungeOffscreenRef.current;
		if (grungeOffscreenSizeRef.current !== size) {
			off.width = size;
			off.height = size;
			grungeOffscreenSizeRef.current = size;
		}
		const offCtx = off.getContext('2d')!;
		offCtx.clearRect(0, 0, size, size);

		offCtx.globalAlpha = 1;
		offCtx.fillStyle = brushColor;
		offCtx.fillRect(0, 0, size, size);

		offCtx.globalCompositeOperation = 'destination-in';
		offCtx.globalAlpha = 1;
		offCtx.drawImage(gImg, 0, 0, gImg.width, gImg.height, 0, 0, size, size);
		offCtx.globalCompositeOperation = 'source-over'; // reset for next reuse

		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		ctx.drawImage(off, x - size / 2, y - size / 2);
	};

	const startDrawing = (e: React.MouseEvent) => {
		if (e.button !== 0 || isPlaying || activeTool === 'none') return;

		const { x, y } = getCoordinates(e);
		isDrawingRef.current = true;
		drawingFrameRef.current = currentFrame;
		lastPointRef.current = { x, y };

		if (activeTool === 'eraser') {
			// Eraser works directly on the backing buffer in draw()
		} else {
			// Clear stroke canvas for new stroke
			if (strokeCanvasRef.current) {
				const sCtx = strokeCanvasRef.current.getContext('2d')!;
				sCtx.clearRect(0, 0, width, height);
				sCtx.lineCap = 'round';
				sCtx.lineJoin = 'round';
				sCtx.globalCompositeOperation = 'source-over';
				sCtx.globalAlpha = 1;

				if (activeTool === 'brush') {
					sCtx.strokeStyle = brushColor;
					sCtx.lineWidth = normalizedBrushSize;
					// Draw initial dot so a tap registers
					sCtx.beginPath();
					sCtx.arc(x, y, normalizedBrushSize / 2, 0, Math.PI * 2);
					sCtx.fillStyle = brushColor;
					sCtx.fill();
					// Start continuous path
					sCtx.beginPath();
					sCtx.moveTo(x, y);
				} else if (activeTool === 'grunge') {
					stampGrunge(sCtx, x, y);
				}
			}

			// RAF loop for live preview of active stroke (includes onion skins via renderWithStroke)
			const loop = () => {
				if (!isDrawingRef.current) return;
				renderWithStroke();
				rafRef.current = requestAnimationFrame(loop);
			};
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(loop);
		}
	};

	const draw = (e: React.MouseEvent) => {
		if (!isDrawingRef.current) return;
		const { x, y } = getCoordinates(e);
		const last = lastPointRef.current ?? { x, y };

		if (activeTool === 'eraser') {
			// Apply eraser directly to backing buffer each move
			if (backingBufferRef.current) {
				const bCtx = backingBufferRef.current.getContext('2d')!;
				bCtx.globalCompositeOperation = 'destination-out';
				bCtx.lineWidth = normalizedBrushSize * 2;
				bCtx.lineCap = 'round';
				bCtx.lineJoin = 'round';
				bCtx.globalAlpha = activeOpacity;
				bCtx.beginPath();
				bCtx.moveTo(last.x, last.y);
				bCtx.lineTo(x, y);
				bCtx.stroke();
				bCtx.globalCompositeOperation = 'source-over';
				bCtx.globalAlpha = 1;
			}
			renderDisplayLayer();
		} else if (activeTool === 'grunge') {
			if (strokeCanvasRef.current) {
				const sCtx = strokeCanvasRef.current.getContext('2d')!;
				stampGrunge(sCtx, x, y);
			}
		} else {
			// Brush: extend continuous path (no beginPath = no gaps)
			if (strokeCanvasRef.current) {
				const sCtx = strokeCanvasRef.current.getContext('2d')!;
				sCtx.lineTo(x, y);
				sCtx.stroke();
				// Move pen to current point without closing path
				sCtx.beginPath();
				sCtx.moveTo(x, y);
			}
		}

		lastPointRef.current = { x, y };
	};

	const stopDrawing = () => {
		if (!isDrawingRef.current) return;
		isDrawingRef.current = false;
		lastPointRef.current = null;

		// Stop RAF loop
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}

		const targetFrame = drawingFrameRef.current !== null ? drawingFrameRef.current : currentFrame;
		drawingFrameRef.current = null;

		// Reuse commit canvas (pre-allocated, same size as annotation canvas)
		const tempCanvas = commitCanvasRef.current;
		if (!tempCanvas) return;
		const tempCtx = tempCanvas.getContext('2d');
		if (!tempCtx) return;
		tempCtx.clearRect(0, 0, width, height);

		if (activeTool === 'eraser') {
			// Backing buffer was modified in-place — save its current state
			if (backingBufferRef.current) {
				tempCtx.drawImage(backingBufferRef.current, 0, 0, width, height);
			}
			renderDisplayLayer();
		} else {
			// Commit stroke canvas onto backing buffer
			if (backingBufferRef.current) {
				tempCtx.drawImage(backingBufferRef.current, 0, 0, width, height);
				if (strokeCanvasRef.current) {
					tempCtx.globalAlpha = activeOpacity;
					tempCtx.drawImage(strokeCanvasRef.current, 0, 0, width, height);
					tempCtx.globalAlpha = 1;
				}

				// Update backing buffer with committed composite
				const bCtx = backingBufferRef.current.getContext('2d')!;
				bCtx.clearRect(0, 0, width, height);
				bCtx.drawImage(tempCanvas, 0, 0, width, height);
			} else {
				if (strokeCanvasRef.current) {
					tempCtx.globalAlpha = activeOpacity;
					tempCtx.drawImage(strokeCanvasRef.current, 0, 0, width, height);
					tempCtx.globalAlpha = 1;
				}
			}

			// Clear stroke canvas
			if (strokeCanvasRef.current) {
				strokeCanvasRef.current.getContext('2d')!.clearRect(0, 0, width, height);
			}
			renderDisplayLayer();
		}

		const dataUrl = tempCanvas.toDataURL('image/png');
		currentlyRenderedUrlRef.current = dataUrl;
		// Cache the newly committed annotation so updateBackingBuffer can reuse it immediately
		const cachedImg = new Image();
		cachedImg.src = dataUrl;
		imageCacheRef.current.set(dataUrl, cachedImg);
		onUpdateAnnotation(targetFrame, dataUrl);
	};

	return (
		<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
			{/* Display Canvas (committed state + onion skins + stroke preview) */}
			<canvas
				ref={displayCanvasRef}
				width={width}
				height={height}
				className="annotation-layer-display"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					pointerEvents: 'none',
					width: '100%',
					height: '100%'
				}}
			/>
			{/* Drawing Canvas (interaction / hit target only) */}
			<canvas
				ref={drawingCanvasRef}
				width={width}
				height={height}
				className="annotation-layer-drawing"
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					pointerEvents: 'auto',
					touchAction: 'none',
					cursor: 'crosshair',
					width: '100%',
					height: '100%'
				}}
				onMouseDown={startDrawing}
				onMouseMove={draw}
				onMouseUp={stopDrawing}
				onMouseLeave={stopDrawing}
			/>
		</div>
	);
};
