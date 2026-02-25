import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Repeat } from 'lucide-react';
import './VideoPlayer.css';
import { DEFAULT_FPS, EPSILON } from '../../constants';
import { Timeline } from './Timeline';
import { SketchTools } from './SketchTools';
import { AnnotationLayer } from './AnnotationLayer';
import { AnnotationShortcutView } from './AnnotationShortcutView';
import { useStore } from '../../store/useStore';
import { useDrawing } from '../../hooks/useDrawing';
import { useNotification } from '../Notification/NotificationContext';
import { finalizeExport, applyColorCorrection, drawAnnotation } from '../../utils/exportUtils';
import { useViewNavigation } from '../../hooks/useViewNavigation';
import { computeDisplaySize } from '../Whiteboard/utils/mediaUtils';
import { useAnnotationHistory } from '../../hooks/useAnnotationHistory';
import { useAnnotationActions } from '../../hooks/useAnnotationActions';
import { useColorCorrection } from '../../hooks/useColorCorrection';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';

interface VideoPlayerProps {
	src: string;
	nodeId: string; // Needed for saving annotations
	isFullscreen?: boolean;
	onToggleFullscreen?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, nodeId, isFullscreen = false, onToggleFullscreen }) => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const videoAreaRef = useRef<HTMLDivElement>(null);
	const updateNode = useStore((state) => state.updateNode);
	const node = useStore((state) => state.nodes.find(n => n.id === nodeId));
	const { addNotification } = useNotification();

	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [isMuted, setIsMuted] = useState(false);
	const [isLooping, setIsLooping] = useState(false);
	const [showFrames, setShowFrames] = useState(true);
	const fps = DEFAULT_FPS;
	const [playbackRate, setPlaybackRate] = useState(1);
	const [showShortcuts, setShowShortcuts] = useState(false);
	const [trimView, setTrimView] = useState(false);

	// Color Correction State
	const { saturation, contrast, brightness, setSaturation, setContrast, setBrightness } = useColorCorrection();

	// A-B Loop State
	const inPoint = node?.inPoint ?? null;
	const outPoint = node?.outPoint ?? null;
	const setInPoint = React.useCallback((val: number | null) => {
		if (node) updateNode(node.id, { inPoint: val !== null ? val : undefined });
	}, [node, updateNode]);
	const setOutPoint = React.useCallback((val: number | null) => {
		if (node) updateNode(node.id, { outPoint: val !== null ? val : undefined });
	}, [node, updateNode]);

	// Sketching State
	const drawingState = useDrawing();
	const {
		activeTool, setActiveTool,
		showAnnotations, setShowAnnotations
	} = drawingState;

	const nav = useViewNavigation();
	const { zoom, pan, isFlipped, isPanning } = nav;

	const dimensions = useContainerDimensions(videoAreaRef);
	const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

	// Compute responsive display size preserving aspect ratio
	const { width: displayWidth, height: displayHeight } = computeDisplaySize(dimensions, mediaSize);

	const currentFrame = Math.floor((currentTime + EPSILON) * fps);

	const togglePlay = React.useCallback(() => {
		if (videoRef.current) {
			if (videoRef.current.paused) {
				videoRef.current.play();
				setIsPlaying(true);
			} else {
				videoRef.current.pause();
				setIsPlaying(false);
			}
		}
	}, []);

	const toggleLoop = React.useCallback(() => {
		setIsLooping(prev => !prev);
	}, []);

	const stepFrame = React.useCallback((frames: number) => {
		if (videoRef.current) {
			videoRef.current.pause();
			setIsPlaying(false);

			// Get current time directly from element to be fresh
			const videoTime = videoRef.current.currentTime;
			const currentFrame = Math.floor((videoTime + EPSILON) * fps);

			// Calculate target frame
			const targetFrame = currentFrame + frames;
			// Set time to the "center" of the frame to avoid boundary issues
			const newTime = (targetFrame + 0.5) / fps;
			videoRef.current.currentTime = newTime;

			// Update state immediately
			setCurrentTime(newTime);
			setProgress((newTime / duration) * 100);
		}
	}, [fps, duration]); // Added deps

	const handleSeek = (percentage: number) => {
		if (videoRef.current) {
			const time = (percentage / 100) * duration;
			videoRef.current.currentTime = time;
			setProgress(percentage);
			setCurrentTime(time);
		}
	};

	const toggleMute = () => {
		if (videoRef.current) {
			videoRef.current.muted = !isMuted;
			setIsMuted(!isMuted);
		}
	};

	const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newSpeed = parseFloat(e.target.value);
		setPlaybackRate(newSpeed);
	};

	// Playback Loop (requestAnimationFrame for smooth UI)
	useEffect(() => {
		let animationFrameId: number;

		const loop = () => {
			if (videoRef.current && !videoRef.current.paused) {
				const time = videoRef.current.currentTime;

				// Loop Logic
				if (outPoint !== null && time >= outPoint && isLooping) {
					videoRef.current.currentTime = inPoint !== null ? inPoint : 0;
				}

				setCurrentTime(time);
				setProgress((time / videoRef.current.duration) * 100);

				animationFrameId = requestAnimationFrame(loop);
			}
		};

		if (isPlaying) {
			loop();
		}

		return () => {
			cancelAnimationFrame(animationFrameId);
		};
	}, [isPlaying, isLooping, inPoint, outPoint]);

	const inPointRef = useRef(inPoint);
	inPointRef.current = inPoint;
	const initialLoadRef = useRef(false);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const updateDurationAndSeek = () => {
			setDuration(video.duration);
			if (!initialLoadRef.current && inPointRef.current !== null) {
				video.currentTime = inPointRef.current;
				setCurrentTime(inPointRef.current);
				setProgress((inPointRef.current / video.duration) * 100);
				initialLoadRef.current = true;
			}
		};

		const onEnded = () => {
			if (isLooping) {
				video.currentTime = inPoint !== null ? inPoint : 0;
				video.play();
			} else {
				setIsPlaying(false);
			}
		};

		video.addEventListener('loadedmetadata', updateDurationAndSeek);
		video.addEventListener('ended', onEnded);

		if (video.readyState >= 1) {
			updateDurationAndSeek();
		}

		return () => {
			video.removeEventListener('loadedmetadata', updateDurationAndSeek);
			video.removeEventListener('ended', onEnded);
		};
	}, [isLooping, inPoint]);

	useEffect(() => {
		if (videoRef.current) {
			videoRef.current.playbackRate = playbackRate;
		}
	}, [playbackRate]);

	const handleSeekToFrame = React.useCallback((frame: number) => {
		if (videoRef.current) {
			// Center of frame
			const newTime = (frame + 0.5) / fps;
			videoRef.current.currentTime = newTime;
			videoRef.current.pause();
			setIsPlaying(false);

			// Update state immediately
			setCurrentTime(newTime);
			setProgress((newTime / duration) * 100);
		}
	}, [fps, duration]);

	const { undo, redo } = useAnnotationHistory(nodeId);
	const { handleUpdateAnnotation, handleClearAnnotation, handleClearAllAnnotations, handleAddComment } = useAnnotationActions(nodeId);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!videoRef.current) return;

			// If text input is focused, ignore
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			// Undo/Redo handling
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
				return;
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				redo();
				return;
			}

			if (e.ctrlKey || e.metaKey) return;

			switch (e.key.toLowerCase()) {
				case ' ':
				case 'k':
					e.preventDefault();
					togglePlay();
					break;
				case 'arrowleft':
					e.preventDefault();
					if (e.shiftKey) {
						if (!node?.annotations) return;
						const videoTime = videoRef.current.currentTime;
						const currentF = Math.floor((videoTime + EPSILON) * fps);
						const frames = Object.keys(node.annotations).map(Number).sort((a, b) => a - b);
						const prev = [...frames].reverse().find(f => f < currentF);
						if (prev !== undefined) handleSeekToFrame(prev);
					} else {
						stepFrame(-1);
					}
					break;
				case 'arrowright':
					e.preventDefault();
					if (e.shiftKey) {
						if (!node?.annotations) return;
						const videoTime = videoRef.current.currentTime;
						const currentF = Math.floor((videoTime + EPSILON) * fps);
						const frames = Object.keys(node.annotations).map(Number).sort((a, b) => a - b);
						const next = frames.find(f => f > currentF);
						if (next !== undefined) handleSeekToFrame(next);
					} else {
						stepFrame(1);
					}
					break;
				case 'i':
					setInPoint(videoRef.current.currentTime);
					setIsLooping(true);
					break;
				case 'o':
					setOutPoint(videoRef.current.currentTime);
					setIsLooping(true);
					break;
				case 'r':
					setInPoint(null);
					setOutPoint(null);
					break;
				case 'b':
					setActiveTool('brush');
					break;
				case 'g':
					setActiveTool('grunge');
					break;
				case 'e':
					setActiveTool('eraser');
					break;
				case 'h':
					nav.handleResetView();
					break;
				case 'f':
					onToggleFullscreen?.();
					break;
				case 'm':
					nav.setIsFlipped(!isFlipped);
					break;
				case 'v':
					setShowAnnotations(!showAnnotations);
					break;
				case '?':
					setShowShortcuts(v => !v);
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [isPlaying, activeTool, fps, inPoint, outPoint, setActiveTool, stepFrame, node?.annotations, handleSeekToFrame, nav, undo, redo, setInPoint, setOutPoint, isFlipped, showAnnotations, setShowAnnotations, onToggleFullscreen, togglePlay]);

	const wrappedHandleClearAnnotation = () => handleClearAnnotation(currentFrame);

	const formatTime = (time: number) => {
		if (showFrames) {
			return `${Math.floor(time * fps)}`;
		}
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
	};

	const handleExportPDF = async () => {
		if (!videoRef.current || !node) return;

		// Dynamically import jsPDF to avoid loading it until needed
		const { jsPDF } = await import('jspdf');

		const video = videoRef.current;
		const originalTime = video.currentTime;
		const wasPlaying = !video.paused;

		if (wasPlaying) video.pause();

		// Gather all relevant frames (annotations or comments)
		const annotatedFrames = new Set<number>();
		if (node.annotations) {
			Object.keys(node.annotations).forEach(k => annotatedFrames.add(Number(k)));
		}
		if (node.comments) {
			node.comments.forEach(c => annotatedFrames.add(c.frame));
		}

		const sortedFrames = Array.from(annotatedFrames).sort((a, b) => a - b);

		if (sortedFrames.length === 0) {
			alert('No annotations or comments to export.');
			if (wasPlaying) video.play();
			return;
		}

		// Initial setup for PDF
		// Landscape A4? Or fit to image? Let's use A4 Landscape for now as video is usually wide.
		const doc = new jsPDF({
			orientation: 'landscape',
			unit: 'mm',
			format: 'a4'
		});

		const pageWidth = doc.internal.pageSize.getWidth();
		const pageHeight = doc.internal.pageSize.getHeight();
		// Margins
		const margin = 10;
		const maxImgHeight = pageHeight - (margin * 3) - 20; // 20mm for text
		const maxImgWidth = pageWidth - (margin * 2);
		// Calculate image size while maintaining aspect ratio
		const imgRatio = video.videoHeight / video.videoWidth;
		let contentWidth = maxImgWidth;
		let imgHeight = contentWidth * imgRatio;
		if (imgHeight > maxImgHeight) {
			imgHeight = maxImgHeight;
			contentWidth = imgHeight / imgRatio;
		}
		const imgX = margin + (maxImgWidth - contentWidth) / 2;

		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext('2d');

		// Process each frame
		for (let i = 0; i < sortedFrames.length; i++) {
			const frame = sortedFrames[i];
			const frameTime = (frame + 0.5) / fps;

			// Seek
			video.currentTime = frameTime;

			// Wait for seek to complete
			await new Promise<void>((resolve) => {
				const onSeeked = () => {
					video.removeEventListener('seeked', onSeeked);
					resolve();
				};
				video.addEventListener('seeked', onSeeked);
			});

			if (!ctx) continue;

			// Draw Video
			applyColorCorrection(ctx, { saturation, contrast, brightness });
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			ctx.filter = 'none';

			// Draw Annotation
			const annotationUrl = node.annotations?.[frame];
			if (annotationUrl) {
				await drawAnnotation(ctx, annotationUrl, canvas.width, canvas.height);
			}

			// Add Page (except first one is already there)
			if (i > 0) doc.addPage();

			// Add Image to PDF
			const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG for compression
			doc.addImage(imgData, 'JPEG', imgX, margin, contentWidth, imgHeight);

			// Add Info + Comments rendered as image to support Japanese text
			const totalSeconds = Math.floor(frameTime);
			const tcMin = Math.floor(totalSeconds / 60);
			const tcSec = totalSeconds % 60;
			const tcFrame = frame % Math.round(fps);
			const timecode = `${String(tcMin).padStart(2, '0')}:${String(tcSec).padStart(2, '0')}:${String(tcFrame).padStart(2, '0')}`;

			const frameComments = node.comments?.filter(c => c.frame === frame) || [];
			const infoLines = [
				`Frame: ${frame}  TC: ${timecode}`,
				...frameComments.map(c => `  - ${c.text}`)
			];

			// Render text lines into a canvas so Japanese characters are preserved
			const textScale = 2;
			const lineH = 18 * textScale;
			const textCanvas = document.createElement('canvas');
			textCanvas.width = Math.round(contentWidth * textScale * (96 / 25.4));
			textCanvas.height = lineH * infoLines.length + 8 * textScale;
			const tCtx = textCanvas.getContext('2d')!;
			tCtx.fillStyle = '#ffffff';
			tCtx.fillRect(0, 0, textCanvas.width, textCanvas.height);
			tCtx.fillStyle = '#222222';
			tCtx.font = `${12 * textScale}px sans-serif`;
			infoLines.forEach((line, idx) => {
				tCtx.fillText(line, 4 * textScale, (idx + 1) * lineH - 4 * textScale);
			});
			const textImgData = textCanvas.toDataURL('image/png');
			const textImgH = (textCanvas.height / textCanvas.width) * contentWidth;
			doc.addImage(textImgData, 'PNG', imgX, margin + imgHeight + 2, contentWidth, textImgH)
		}

		// Restore state
		video.currentTime = originalTime;
		if (wasPlaying) video.play();

		// Save
		doc.save(`annotations_${Date.now()}.pdf`);
		addNotification('PDF Exported Successfully', 'success');
	};

	const handleExport = () => {
		if (!videoRef.current || !node) return;

		const options = { addToWhiteboard: true, useColorCorrection: true };
		const video = videoRef.current;
		const width = video.videoWidth;
		const height = video.videoHeight;

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// 1. Draw Video Frame with CC applied
		applyColorCorrection(ctx, { saturation, contrast, brightness });
		ctx.drawImage(video, 0, 0, width, height);
		ctx.filter = 'none';

		// 2. Draw Annotations
		const annotationUrl = node.annotations?.[currentFrame];
		const onComplete = () => finalizeExport(canvas, options, { nodeId, node, addNotification }, currentFrame);

		if (annotationUrl) {
			drawAnnotation(ctx, annotationUrl, width, height).then(onComplete);
		} else {
			onComplete();
		}
	};

	return (
		<div className="video-player-container" ref={containerRef} style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
			{/* Left Side: Player */}
			<div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
				<div
					className="video-area"
					ref={(el) => { (videoAreaRef as React.MutableRefObject<HTMLDivElement | null>).current = el; nav.containerRef.current = el; }}
					onWheel={nav.handleWheel}
					onMouseDown={nav.handleMouseDown}
					onMouseMove={nav.handleMouseMove}
					onMouseUp={nav.handleMouseUp}
					onMouseLeave={nav.handleMouseUp}
					onContextMenu={(e) => e.preventDefault()}
					style={{
						position: 'relative',
						width: '100%',
						flex: 1,
						overflow: 'hidden',
						background: '#000',
						cursor: isPanning ? 'grabbing' : undefined
					}}
				>
					<div
						className="transform-container"
						style={{
							width: '100%',
							height: '100%',
							transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) scaleX(${isFlipped ? - 1 : 1})`,
							transformOrigin: 'center',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
					>
						<div
							className="media-wrapper"
							style={{
								position: 'relative',
								width: displayWidth,
								height: displayHeight,
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center'
							}}
						>
							<video
								ref={videoRef}
								src={src}
								className="video-element"
								onClick={() => { if (!isPanning) togglePlay(); }}
								playsInline
								onLoadedMetadata={(e) => {
									setMediaSize({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
								}}
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'fill',
									pointerEvents: 'auto',
									filter: `saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`
								}}
							/>
							{showAnnotations && (
								<AnnotationLayer
									width={mediaSize.width || dimensions.width}
									height={mediaSize.height || dimensions.height}
									currentFrame={currentFrame}
									isPlaying={isPlaying}
									annotations={node?.annotations || {}}
									onUpdateAnnotation={handleUpdateAnnotation}
									drawingState={drawingState}
								/>
							)}
						</div>
					</div>
				</div>

				<SketchTools
					drawingState={drawingState}
					onClear={wrappedHandleClearAnnotation}
					onClearAll={handleClearAllAnnotations}
					onFlip={() => nav.setIsFlipped(!isFlipped)}
					isFlipped={isFlipped}
					onResetView={nav.handleResetView}
					onExport={handleExport}
					onExportPDF={handleExportPDF}
					colorCorrection={{ saturation, setSaturation, contrast, setContrast, brightness, setBrightness }}
					commentsProps={{ comments: node?.comments || [], currentFrame, onAddComment: handleAddComment, onSeek: handleSeekToFrame }}
					isFullscreen={isFullscreen}
					onToggleFullscreen={onToggleFullscreen}
					onShowShortcuts={() => setShowShortcuts(v => !v)}
				/>
				{showShortcuts && <AnnotationShortcutView onClose={() => setShowShortcuts(false)} />}

				<div className="video-controls">
					{/* Left Controls: Play, Frame Step, Annotations */}
					<div className="control-group-left">
						<button className="control-button" onClick={togglePlay} title="Play/Pause (Space)">
							{isPlaying ? <Pause size={16} /> : <Play size={16} />}
						</button>
					</div>

					{/* Center: Timeline */}
					<div className="control-group-center" style={{ flex: 1, margin: '0 12px', minWidth: 0 }}>
						<Timeline
							progress={progress}
							duration={duration}
							inPoint={inPoint}
							outPoint={outPoint}
							onSeek={handleSeek}
							fps={fps}
							annotations={node?.annotations}
							trimView={trimView}
							onToggleTrimView={() => setTrimView(v => !v)}
						/>
					</div>

					{/* Right Controls: Settings, Volume */}
					<div className="control-group-right">
						<select
							className="speed-select"
							value={playbackRate}
							onChange={handleSpeedChange}
							title="Playback Speed"
						>
							<option value="0.25">0.25x</option>
							<option value="0.5">0.5x</option>
							<option value="1">1x</option>
							<option value="1.5">1.5x</option>
							<option value="2">2x</option>
						</select>

						<button className={`control-button ${isLooping ? 'active' : ''}`} onClick={toggleLoop} title="Loop (Auto-enabled with I/O)">
							<Repeat size={16} />
						</button>

						<div className="time-display" onClick={() => setShowFrames(!showFrames)} title="Click to toggle Time/Frames">
							<span className="current-time">{formatTime(currentTime)}</span>
							<span className="separator" />
							<span className="total-time">{formatTime(duration)}</span>
						</div>

						<button className="control-button" onClick={toggleMute}>
							{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
						</button>
					</div>
				</div>
			</div>

		</div>
	);
};
