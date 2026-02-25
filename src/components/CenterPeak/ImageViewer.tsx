import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useDrawing } from '../../hooks/useDrawing';
import { AnnotationLayer } from './AnnotationLayer';
import { SketchTools } from './SketchTools';
import { AnnotationShortcutView } from './AnnotationShortcutView';
import { useNotification } from '../Notification/NotificationContext';
import { finalizeExport, applyColorCorrection, drawAnnotation } from '../../utils/exportUtils';
import { useViewNavigation } from '../../hooks/useViewNavigation';
import { computeDisplaySize } from '../Whiteboard/utils/mediaUtils';
import { useAnnotationHistory } from '../../hooks/useAnnotationHistory';
import { useAnnotationActions } from '../../hooks/useAnnotationActions';
import { useColorCorrection } from '../../hooks/useColorCorrection';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import './VideoPlayer.css';

interface ImageViewerProps {
	src: string;
	nodeId: string;
	isFullscreen?: boolean;
	onToggleFullscreen?: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, nodeId, isFullscreen = false, onToggleFullscreen }) => {
	const imageAreaRef = useRef<HTMLDivElement>(null);

	const node = useStore((state) => state.nodes.find(n => n.id === nodeId));
	const { addNotification } = useNotification();

	const drawingState = useDrawing();
	const { showAnnotations } = drawingState;

	const dimensions = useContainerDimensions(imageAreaRef);
	const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });

	// Compute responsive display size preserving aspect ratio
	const { width: displayWidth, height: displayHeight } = computeDisplaySize(dimensions, mediaSize);

	// Sidebar State

	// Color Correction State
	const { saturation, contrast, brightness, setSaturation, setContrast, setBrightness } = useColorCorrection();

	// Load image natural dimensions
	useEffect(() => {
		const img = new Image();
		img.onload = () => {
			setMediaSize({ width: img.naturalWidth, height: img.naturalHeight });
		};
		img.src = src;
	}, [src]);

	const { undo, redo, pushState } = useAnnotationHistory(nodeId);
	const { handleUpdateAnnotation, handleClearAnnotation, handleClearAllAnnotations, handleAddComment } = useAnnotationActions(nodeId, pushState, { fixedFrame: 0 });

	const [bgMode, setBgMode] = useState<'black' | 'checker'>('black');
	const [showShortcuts, setShowShortcuts] = useState(false);

	const nav = useViewNavigation();
	const { zoom, pan, isFlipped, isPanning } = nav;

	// Keyboard shortcuts for reset and undo/redo
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				e.stopPropagation();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
				return;
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				e.stopPropagation();
				redo();
				return;
			}
			if (e.ctrlKey || e.metaKey) return;
			switch (e.key.toLowerCase()) {
				case 'h':
					e.stopPropagation();
					nav.handleResetView();
					break;
				case 'b':
					e.stopPropagation();
					drawingState.setActiveTool('brush');
					break;
				case 'g':
					e.stopPropagation();
					drawingState.setActiveTool('grunge');
					break;
				case 'e':
					e.stopPropagation();
					drawingState.setActiveTool('eraser');
					break;
				case 'f':
					e.stopPropagation();
					onToggleFullscreen?.();
					break;
				case 'm':
					e.stopPropagation();
					nav.setIsFlipped(!isFlipped);
					break;
				case 'v':
					e.stopPropagation();
					drawingState.setShowAnnotations(!drawingState.showAnnotations);
					break;
				case '?':
					e.stopPropagation();
					setShowShortcuts(v => !v);
					break;
			}
		};
		const container = imageAreaRef.current?.parentElement;
		if (container) {
			container.addEventListener('keydown', handleKeyDown);
			container.focus(); // Ensure it can receive key events if it has tabIndex
		}
		return () => {
			if (container) container.removeEventListener('keydown', handleKeyDown);
		};
	}, [nav, undo, redo, drawingState, isFlipped, onToggleFullscreen]);

	const handleExportPDF = async () => {
		if (!imageAreaRef.current || !node) return;

		// Dynamically import jsPDF
		const { jsPDF } = await import('jspdf');

		const imgElement = imageAreaRef.current.querySelector('img');
		if (!imgElement) return;

		// Use natural width/height of the image
		const width = imgElement.naturalWidth;
		const height = imgElement.naturalHeight;

		// Create Canvas
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Draw Image
		applyColorCorrection(ctx, { saturation, contrast, brightness });
		ctx.drawImage(imgElement, 0, 0, width, height);
		ctx.filter = 'none';

		// Draw Annotation
		const annotationUrl = node.annotations?.[0];
		if (annotationUrl) {
			await drawAnnotation(ctx, annotationUrl, width, height);
		}

		// Initial setup for PDF
		const doc = new jsPDF({
			orientation: 'landscape', // Assume landscape for photos? Or check ratio?
			unit: 'mm',
			format: 'a4'
		});

		// Check aspect ratio to decide orientation?
		// Simple approach: landscape default as monitors are wide.

		const pageWidth = doc.internal.pageSize.getWidth();
		const pageHeight = doc.internal.pageSize.getHeight();
		const margin = 10;
		const maxImgHeight = pageHeight - (margin * 3) - 20;
		const maxImgWidth = pageWidth - (margin * 2);
		const imgRatio = height / width;
		// Fit image within max bounds preserving aspect ratio
		let contentWidth = maxImgWidth;
		let imgHeight = contentWidth * imgRatio;
		if (imgHeight > maxImgHeight) {
			imgHeight = maxImgHeight;
			contentWidth = imgHeight / imgRatio;
		}
		const imgX = margin + (maxImgWidth - contentWidth) / 2;

		// Add Image to PDF
		const imgData = canvas.toDataURL('image/jpeg', 0.85);
		doc.addImage(imgData, 'JPEG', imgX, margin, contentWidth, imgHeight);

		// Add Info + Comments rendered as image to support Japanese text
		const allComments = node.comments || [];
		const infoLines = [
			`Image Export  Date: ${new Date().toLocaleDateString()}`,
			...allComments.map(c => `  - ${c.text}`)
		];

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

		doc.save(`annotation_image_${Date.now()}.pdf`);
		addNotification('PDF Exported Successfully', 'success');
	};

	const handleExport = () => {
		if (!imageAreaRef.current || !node) return;
		const imgElement = imageAreaRef.current.querySelector('img');
		if (!imgElement) return;

		const options = { addToWhiteboard: true, useColorCorrection: true };
		const width = imgElement.naturalWidth;
		const height = imgElement.naturalHeight;

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// 1. Draw Image with CC applied
		applyColorCorrection(ctx, { saturation, contrast, brightness });
		ctx.drawImage(imgElement, 0, 0, width, height);
		ctx.filter = 'none';

		// 2. Draw Annotations (Frame 0)
		const annotationUrl = node.annotations?.[0];
		const onComplete = () => finalizeExport(canvas, options, { nodeId, node, addNotification }, 'image');

		if (annotationUrl) {
			drawAnnotation(ctx, annotationUrl, width, height).then(onComplete);
		} else {
			onComplete();
		}
	};



	return (
		<div className="video-player-container" tabIndex={0} style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
			{/* Left Side: Image Area */}
			<div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
				<div
					className="video-area"
					ref={(el) => { (imageAreaRef as React.MutableRefObject<HTMLDivElement | null>).current = el; nav.containerRef.current = el; }}
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
						background: bgMode === 'checker'
							? 'repeating-conic-gradient(#808080 0% 25%, #b0b0b0 0% 50%) 0 0 / 16px 16px'
							: '#000',
						cursor: isPanning ? 'grabbing' : undefined
					}}
				>
					<div
						className="transform-container"
						style={{
							width: '100%',
							height: '100%',
							transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) scaleX(${isFlipped ? -1 : 1})`,
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
							<img
								src={src}
								alt="Detail View"
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'fill',
									display: 'block',
									pointerEvents: 'auto',
									filter: `saturate(${saturation}) contrast(${contrast}) brightness(${brightness})`
								}}
							/>
							{showAnnotations && (
								<AnnotationLayer
									width={mediaSize.width || dimensions.width}
									height={mediaSize.height || dimensions.height}
									currentFrame={0} // Always 0 for images
									isPlaying={false}
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
					onClear={() => handleClearAnnotation(0)}
					onClearAll={handleClearAllAnnotations}
					onFlip={() => nav.setIsFlipped(!isFlipped)}
					isFlipped={isFlipped}
					onResetView={nav.handleResetView}
					isImage={true}
					onExport={handleExport}
					onExportPDF={handleExportPDF}
					colorCorrection={{ saturation, setSaturation, contrast, setContrast, brightness, setBrightness }}
					commentsProps={{ comments: node?.comments || [], currentFrame: 0, onAddComment: handleAddComment, onSeek: () => { }, isImage: true }}
					bgMode={bgMode}
					onBgToggle={() => setBgMode(m => m === 'black' ? 'checker' : 'black')}
					isFullscreen={isFullscreen}
					onToggleFullscreen={onToggleFullscreen}
					onShowShortcuts={() => setShowShortcuts(v => !v)}
				/>
				{showShortcuts && <AnnotationShortcutView onClose={() => setShowShortcuts(false)} isImage={true} />}
			</div>

		</div>
	);
};
