import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eraser, Eye, EyeOff, Trash2, Layers, FlipHorizontal, Move, Download, FileText, Paintbrush, SunMedium, MessageSquare, Grid3x3, Maximize, Minimize, CircleHelp } from 'lucide-react';
import type { DrawingState } from '../../hooks/useDrawing';
import type { Comment } from '../../store/useStore';
import LabelSlider from '../ui/LabelSlider';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatTimestamp } from '../../utils/formatting';
import './SketchTools.css';

export type ToolType = 'brush' | 'eraser' | 'grunge' | 'none';

const PRESET_COLORS = ['#ffffff', '#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

export interface ExportOptions {
	addToWhiteboard: boolean;
	useColorCorrection: boolean;
}

export interface ColorCorrectionValues {
	saturation: number;
	setSaturation: (v: number) => void;
	contrast: number;
	setContrast: (v: number) => void;
	brightness: number;
	setBrightness: (v: number) => void;
}

export interface CommentsProps {
	comments: Comment[];
	currentFrame: number;
	onAddComment: (text: string, frame: number) => void;
	onSeek: (frame: number) => void;
	isImage?: boolean;
}

interface SketchToolsProps {
	drawingState: DrawingState;
	onClear: () => void;
	onClearAll?: () => void;
	onFlip?: () => void;
	isFlipped?: boolean;
	onResetView?: () => void;
	isImage?: boolean;
	onExport?: () => void;
	onExportPDF?: () => void;
	colorCorrection?: ColorCorrectionValues;
	commentsProps?: CommentsProps;
	bgMode?: 'black' | 'checker';
	onBgToggle?: () => void;
	isFullscreen?: boolean;
	onToggleFullscreen?: () => void;
	onShowShortcuts?: () => void;
}

export const SketchTools: React.FC<SketchToolsProps> = ({
	drawingState,
	onClear,
	onClearAll,
	onFlip = () => { },
	isFlipped = false,
	onResetView = () => { },
	isImage = false,
	onExport,
	onExportPDF,
	colorCorrection,
	commentsProps,
	bgMode,
	onBgToggle,
	isFullscreen = false,
	onToggleFullscreen,
	onShowShortcuts,
}) => {
	const {
		activeTool,
		setActiveTool,
		brushColor,
		setBrushColor,
		brushSize,
		setBrushSize,
		grungeSize,
		setGrungeSize,
		eraserSize,
		setEraserSize,
		brushOpacity,
		setBrushOpacity,
		grungeOpacity,
		setGrungeOpacity,
		eraserOpacity,
		setEraserOpacity,
		ghostingEnabled,
		setGhostingEnabled,
		onionSkinFrames,
		setOnionSkinFrames,
		showAnnotations,
		setShowAnnotations
	} = drawingState;

	const [showOnionMenu, setShowOnionMenu] = useState(false);
	const [showClearMenu, setShowClearMenu] = useState(false);
	const [showColorCorrection, setShowColorCorrection] = useState(false);
	const [showComments, setShowComments] = useState(false);
	const [commentText, setCommentText] = useState('');
	const [tagFrame, setTagFrame] = useState(true);

	const commentsMenuRef = useRef<HTMLDivElement>(null);
	const ccMenuRef = useRef<HTMLDivElement>(null);
	const clearMenuRef = useRef<HTMLDivElement>(null);
	const commentsBottomRef = useRef<HTMLDivElement>(null);

	useClickOutside(commentsMenuRef, showComments, () => setShowComments(false));
	useClickOutside(clearMenuRef, showClearMenu, () => setShowClearMenu(false));
	useClickOutside(ccMenuRef, showColorCorrection, () => setShowColorCorrection(false));

	// Scroll to bottom when comments open or new comment added
	useEffect(() => {
		if (showComments && commentsBottomRef.current) {
			commentsBottomRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [showComments, commentsProps?.comments.length]);

	const handleCommentSubmit = () => {
		if (!commentsProps || !commentText.trim()) return;
		const frame = tagFrame ? commentsProps.currentFrame : -1;
		commentsProps.onAddComment(commentText, frame);
		setCommentText('');
	};

	const handleCommentKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleCommentSubmit();
		}
	};

	const sortedComments = commentsProps
		? [...commentsProps.comments].sort((a, b) => a.timestamp - b.timestamp)
		: [];

	// Check if CC values differ from default (1.0)
	const ccIsActive = colorCorrection
		? colorCorrection.saturation !== 1 || colorCorrection.contrast !== 1 || colorCorrection.brightness !== 1
		: false;

	// Per-tool size/opacity
	const currentSize = activeTool === 'grunge' ? grungeSize : activeTool === 'eraser' ? eraserSize : brushSize;
	const setCurrentSize = activeTool === 'grunge' ? setGrungeSize : activeTool === 'eraser' ? setEraserSize : setBrushSize;
	const currentOpacity = activeTool === 'grunge' ? grungeOpacity : activeTool === 'eraser' ? eraserOpacity : brushOpacity;
	const setCurrentOpacity = activeTool === 'grunge' ? setGrungeOpacity : activeTool === 'eraser' ? setEraserOpacity : setBrushOpacity;

	const ICON = 13;

	return (
		<div className="sketch-tools">
			{/* Left: visibility toggle */}
			<div className="tool-group">
				<button
					className={`tool-btn ${!showAnnotations ? 'active' : ''}`}
					onClick={() => setShowAnnotations(!showAnnotations)}
					title={showAnnotations ? "Hide Annotations" : "Show Annotations"}
				>
					{showAnnotations ? <Eye size={ICON} /> : <EyeOff size={ICON} />}
				</button>
			</div>

			<div className="separator" />

			{/* Drawing tools */}
			<div className="tool-group">
				<button
					className={`tool-btn ${activeTool === 'brush' ? 'active' : ''}`}
					onClick={() => { setActiveTool('brush'); setShowColorCorrection(false); }}
					title="Brush (B)"
				>
					<Pencil size={ICON} />
				</button>
				<button
					className={`tool-btn ${activeTool === 'grunge' ? 'active' : ''}`}
					onClick={() => { setActiveTool('grunge'); setShowColorCorrection(false); }}
					title="Grunge Brush (G)"
				>
					<Paintbrush size={ICON} />
				</button>
				<button
					className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
					onClick={() => { setActiveTool('eraser'); setShowColorCorrection(false); }}
					title="Eraser (E)"
				>
					<Eraser size={ICON} />
				</button>
			</div>

			<div className="separator" />

			{/* Clear */}
			<div className="tool-group">
				<div style={{ position: 'relative' }} ref={clearMenuRef}>
					<button
						className="tool-btn"
						onClick={onClear}
						onContextMenu={(e) => {
							e.preventDefault();
							if (onClearAll) setShowClearMenu(v => !v);
						}}
						title="Clear Frame (Right-click to clear all)"
					>
						<Trash2 size={ICON} />
					</button>
					{showClearMenu && onClearAll && (
						<div className="onion-skin-menu" style={{ left: 0, transform: 'none' }}>
							<div className="menu-title">Clear</div>
							<div
								className="menu-item"
								onClick={() => { onClear(); setShowClearMenu(false); }}
							>
								This Frame
							</div>
							<div
								className="menu-item"
								onClick={() => { onClearAll(); setShowClearMenu(false); }}
							>
								All Frames
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="separator" />

			{/* Brush options: color / size / opacity */}
			{(activeTool === 'brush' || activeTool === 'grunge' || activeTool === 'eraser') && (
				<>
					{(activeTool === 'brush' || activeTool === 'grunge') && (
					<div className="tool-group column">
						<div className="swatches-row">
							{PRESET_COLORS.map(color => (
								<button
									key={color}
									className={`swatch-btn ${brushColor === color ? 'selected' : ''}`}
									style={{ backgroundColor: color }}
									onClick={() => setBrushColor(color)}
									title={color}
								/>
							))}
							<input
								type="color"
								className="color-picker-small"
								value={brushColor}
								onChange={(e) => setBrushColor(e.target.value)}
								title="Custom Color"
							/>
						</div>
					</div>
					)}

					<div className="tool-group column">
						<LabelSlider
							label="Size"
							min={1}
							max={50}
							value={currentSize}
							onChange={(v) => setCurrentSize(Math.round(v))}
							width={90}
						/>
					</div>

					<div className="tool-group column">
						<LabelSlider
							label="Opacity"
							min={0}
							max={100}
							value={Math.round(currentOpacity * 100)}
							onChange={(v) => setCurrentOpacity(v / 100)}
							formatValue={(v) => `${Math.round(v)}%`}
							width={90}
						/>
					</div>

					<div className="separator" />
				</>
			)}

			{/* Center-left: onion skin, flip, reset view, CC */}
			<div className="tool-group">
				{!isImage && (
					<div className="onion-skin-container" style={{ position: 'relative' }}>
						<button
							className={`tool-btn ${ghostingEnabled ? 'active' : ''}`}
							onClick={() => setGhostingEnabled(!ghostingEnabled)}
							onContextMenu={(e) => {
								e.preventDefault();
								setShowOnionMenu(!showOnionMenu);
							}}
							title={`Onion Skin (${onionSkinFrames} frames) - Right click for options`}
						>
							<Layers size={ICON} />
						</button>

						{showOnionMenu && (
							<div
								className="onion-skin-menu"
								onMouseLeave={() => setShowOnionMenu(false)}
							>
								<div className="menu-title">Onion Skin Frames</div>
								{[1, 2, 3, 4, 5].map(num => (
									<div
										key={num}
										className={`menu-item ${onionSkinFrames === num ? 'selected' : ''}`}
										onClick={() => {
											setOnionSkinFrames(num);
											setShowOnionMenu(false);
										}}
									>
										{num} Frames
									</div>
								))}
							</div>
						)}
					</div>
				)}

				<button
					className={`tool-btn ${isFlipped ? 'active' : ''}`}
					onClick={onFlip}
					title="Flip Horizontal"
				>
					<FlipHorizontal size={ICON} />
				</button>

				<button
					className="tool-btn"
					onClick={onResetView}
					title="Reset View"
				>
					<Move size={ICON} />
				</button>

				{isImage && onBgToggle && (
					<button
						className={`tool-btn ${bgMode === 'checker' ? 'active' : ''}`}
						onClick={onBgToggle}
						title={bgMode === 'checker' ? 'Switch to Black Background' : 'Switch to Checker Background'}
					>
						<Grid3x3 size={ICON} />
					</button>
				)}

				{colorCorrection && (
					<div className="cc-container" style={{ position: 'relative' }} ref={ccMenuRef}>
						<button
							className={`tool-btn ${showColorCorrection || ccIsActive ? 'active' : ''}`}
							onClick={() => setShowColorCorrection(v => !v)}
							title="Color Correction"
						>
							<SunMedium size={ICON} />
						</button>

						{showColorCorrection && (
							<div className="cc-popup">
								<div className="cc-popup-title">Color Correction</div>
								<LabelSlider
									label="Saturation"
									min={0}
									max={3}
									step={0.05}
									value={colorCorrection.saturation}
									onChange={colorCorrection.setSaturation}
									formatValue={(v) => v.toFixed(2)}
									width="100%"
								/>
								<LabelSlider
									label="Contrast"
									min={0}
									max={3}
									step={0.05}
									value={colorCorrection.contrast}
									onChange={colorCorrection.setContrast}
									formatValue={(v) => v.toFixed(2)}
									width="100%"
								/>
								<LabelSlider
									label="Brightness"
									min={0}
									max={3}
									step={0.05}
									value={colorCorrection.brightness}
									onChange={colorCorrection.setBrightness}
									formatValue={(v) => v.toFixed(2)}
									width="100%"
								/>
								<button
									className="export-action-btn secondary cc-popup-reset"
									onClick={() => { colorCorrection.setSaturation(1); colorCorrection.setContrast(1); colorCorrection.setBrightness(1); }}
								>
									Reset
								</button>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Right: comments + export */}
			<div className="tool-group" style={{ marginLeft: 'auto' }}>
				{commentsProps && (
					<>
						<div className="comments-container" style={{ position: 'relative' }} ref={commentsMenuRef}>
							<button
								className={`tool-btn ${showComments ? 'active' : ''}`}
								onClick={() => setShowComments(v => !v)}
								title="Comments"
							>
								<MessageSquare size={ICON} />
								{sortedComments.length > 0 && (
									<span className="comments-badge">{sortedComments.length}</span>
								)}
							</button>

							{showComments && (
								<div className="comments-popup">
									<div className="comments-popup-list">
										{sortedComments.length === 0 ? (
											<div className="comments-empty">No comments yet</div>
										) : (
											sortedComments.map((c) => (
												<div key={c.id} className="comments-popup-item">
													<div className="comments-popup-meta">
														<span className="comments-popup-time">{formatTimestamp(c.timestamp)}</span>
														{!commentsProps.isImage && c.frame >= 0 && (
															<span
																className="comments-popup-frame"
																onClick={() => { commentsProps.onSeek(c.frame); setShowComments(false); }}
																title={`Jump to frame ${c.frame}`}
															>
																F{c.frame}
															</span>
														)}
													</div>
													<div className="comments-popup-text">{c.text}</div>
												</div>
											))
										)}
										<div ref={commentsBottomRef} />
									</div>
									<div className="comments-popup-input">
										{!commentsProps.isImage && (
											<label className="comments-frame-label">
												<input
													type="checkbox"
													checked={tagFrame}
													onChange={(e) => setTagFrame(e.target.checked)}
												/>
												<span>F{commentsProps.currentFrame}</span>
											</label>
										)}
										<textarea
											className="comments-textarea"
											placeholder="Add a comment..."
											value={commentText}
											onChange={(e) => setCommentText(e.target.value)}
											onKeyDown={handleCommentKeyDown}
											rows={2}
										/>
										<button
											className="export-action-btn"
											onClick={handleCommentSubmit}
											disabled={!commentText.trim()}
										>
											Submit
										</button>
									</div>
								</div>
							)}
						</div>
						<div className="separator" />
					</>
				)}

				{onExport && (
					<button
						className="tool-btn"
						onClick={onExport}
						title="Export Snapshot (with CC, add to Whiteboard)"
					>
						<Download size={ICON} />
					</button>
				)}

				{onExportPDF && (
					<button
						className="tool-btn"
						onClick={onExportPDF}
						title="Export PDF"
					>
						<FileText size={ICON} />
					</button>
				)}

				{onToggleFullscreen && (
					<button
						className="tool-btn"
						onClick={onToggleFullscreen}
						title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
					>
						{isFullscreen ? <Minimize size={ICON} /> : <Maximize size={ICON} />}
					</button>
				)}
				{onShowShortcuts && (
					<button
						className="tool-btn"
						onClick={onShowShortcuts}
						title="Shortcuts (?)"
					>
						<CircleHelp size={ICON} />
					</button>
				)}
			</div>
		</div>
	);
};
