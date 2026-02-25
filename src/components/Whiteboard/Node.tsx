import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { NodeData } from '../../store/useStore';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/shallow';
import './Node.css';
import { NodeContent } from './NodeContent';
import { TextToolbar } from './TextToolbar';
import { Video } from 'lucide-react';

// Module-scope canvas for text measurement — shared across all Node instances (JS is single-threaded)
const _measureCanvas = document.createElement('canvas');
const _measureCtx = _measureCanvas.getContext('2d')!;

interface NodeProps {
	node: NodeData;
	onStartConnection: (nodeId: string, e: React.MouseEvent) => void;
	onEndConnection: (nodeId: string) => void;
	onContextMenu: (e: React.MouseEvent) => void;
	isConnecting: boolean;
}

export const Node: React.FC<NodeProps> = React.memo(({ node, onStartConnection, onEndConnection, onContextMenu, isConnecting }) => {
	const { updateNode, setActiveNodeId, selectNode, isSelected, zoom, theme, pushHistory, parentNode } = useStore(
		useShallow((state) => ({
			updateNode: state.updateNode,
			setActiveNodeId: state.setActiveNodeId,
			selectNode: state.selectNode,
			isSelected: state.selectedNodeIds.includes(node.id),
			zoom: state.view.zoom,
			theme: state.theme,
			pushHistory: state.pushHistory,
			parentNode: node.parentId ? state.nodes.find(n => n.id === node.parentId) : null,
		}))
	);
	const defaultFontColor = theme === 'dark' ? '#ffffff' : '#1a1a1a';

	const [isDragging, setIsDragging] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const textRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isMountedRef = useRef(true);
	useEffect(() => {
		isMountedRef.current = true;
		return () => { isMountedRef.current = false; };
	}, []);

	// Auto-size text nodes to fit content
	useLayoutEffect(() => {
		if (node.type === 'text' && textRef.current) {
			const fontSize = node.fontSize || 24;
			const fontWeight = node.fontWeight || 'normal';
			const fontStyle = node.fontStyle || 'normal';
			// Measure text width using shared module-scope canvas
			const computedStyle = window.getComputedStyle(textRef.current);
			_measureCtx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${computedStyle.fontFamily}`;
			const text = node.content || 'Double click to edit';
			const metrics = _measureCtx.measureText(text);
			const padding = 8;
			const newWidth = Math.max(60, metrics.width + padding * 2);
			if (Math.abs(newWidth - node.width) > 2) {
				updateNode(node.id, { width: newWidth });
			}
			const newHeight = textRef.current.scrollHeight;
			if (Math.abs(newHeight - node.height) > 1) {
				updateNode(node.id, { height: newHeight });
			}
		}
	}, [node.content, node.width, node.fontSize, node.type, updateNode, node.height, node.id, node.textSize, node.fontWeight, node.fontStyle]);

	useLayoutEffect(() => {
		if (isEditing && textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
		}
	}, [isEditing]);

	// Exit editing when user clicks outside the node
	useEffect(() => {
		if (!isEditing) return;
		const handleOutsideClick = (e: MouseEvent) => {
			if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
				textareaRef.current.blur();
			}
		};
		window.addEventListener('mousedown', handleOutsideClick);
		return () => window.removeEventListener('mousedown', handleOutsideClick);
	}, [isEditing]);

	const handleInput = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		// Allow middle click (button 1) and right click (button 2) to bubble up for panning/zooming
		if (e.button === 1 || e.button === 2) return;

		e.stopPropagation();
		if (isEditing) return;

		if (e.button !== 0) return;

		// Alt + drag starts a connection
		if (e.altKey) {
			onStartConnection(node.id, e);
			return;
		}

		// If specific node is not selected, select it exclusively (unless shift/ctrl)
		const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
		if (!isSelected && !isMultiSelect) {
			selectNode(node.id, false);
		} else if (isMultiSelect) {
			selectNode(node.id, true);
		}

		pushHistory();
		setIsDragging(true);

		let lastX = e.clientX;
		let lastY = e.clientY;

		const handleWindowMouseMove = (moveEvent: MouseEvent) => {
			moveEvent.preventDefault();
			const currentZoom = useStore.getState().view.zoom;
			const dx = (moveEvent.clientX - lastX) / currentZoom;
			const dy = (moveEvent.clientY - lastY) / currentZoom;

			// If selected, move all selected nodes
			const selectedIds = useStore.getState().selectedNodeIds;
			const idsToMove = selectedIds.includes(node.id) ? selectedIds : [node.id];

			useStore.getState().moveNodes(idsToMove, dx, dy);

			// Calculate drop target highlight
			const store = useStore.getState();
			// We need the node's updated position from store
			const currentNode = store.nodes.find(n => n.id === node.id);
			if (currentNode) {
				const centerX = currentNode.x + currentNode.width / 2;
				const centerY = currentNode.y + currentNode.height / 2;
				const overlappingColumn = [...store.nodes].reverse().find(n =>
					n.type === 'backdrop' && n.layoutMode === 'column' &&
					centerX >= n.x && centerX <= n.x + n.width &&
					centerY >= n.y && centerY <= n.y + n.height
				);

				if (store.activeDropTargetId !== (overlappingColumn?.id || null)) {
					store.setDropTarget(overlappingColumn?.id || null);
				}
			}

			lastX = moveEvent.clientX;
			lastY = moveEvent.clientY;
		};

		const handleWindowMouseUp = () => {
			window.removeEventListener('mousemove', handleWindowMouseMove);
			window.removeEventListener('mouseup', handleWindowMouseUp);
			if (isMountedRef.current) setIsDragging(false);

			// Trigger attach to column if dropped
			const store = useStore.getState();
			store.setDropTarget(null);
			if (store.attachToColumn) {
				const selectedIds = store.selectedNodeIds;
				const idsToMove = selectedIds.includes(node.id) ? selectedIds : [node.id];
				store.attachToColumn(idsToMove);
			}
		};

		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (node.type === 'text' || node.type === 'markdown') {
			setIsEditing(true);
		} else if (node.type !== 'backdrop') {
			setActiveNodeId(node.id);
		}
	};

	const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
		setIsEditing(false);
		if (node.content !== e.target.value) {
			pushHistory();
			updateNode(node.id, { content: e.target.value });
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// Escape exits editing
		if (e.key === 'Escape') {
			e.preventDefault();
			e.currentTarget.blur();
			return;
		}
		if (node.type === 'text' && e.key === 'Enter') {
			// For text nodes, Enter submits (no multi-line)
			e.preventDefault();
			e.currentTarget.blur();
		}
		// For markdown nodes, Enter creates a new line normally (no prevention)
		// Stop propagation so global shortcuts don't fire while editing
		e.stopPropagation();
	};

	const handleResizeStart = (e: React.MouseEvent, corner: 'se' | 'sw' | 'ne' | 'nw') => {
		e.stopPropagation();
		pushHistory();
		const startMouseX = e.clientX;
		const startMouseY = e.clientY;
		const startWidth = node.width;
		const startHeight = node.height;
		const startNodeX = node.x;
		const startNodeY = node.y;
		const aspectRatio = startWidth / startHeight;

		const handleResizeMove = (moveEvent: MouseEvent) => {
			moveEvent.preventDefault();
			const currentZoom = useStore.getState().view.zoom;
			const dx = (moveEvent.clientX - startMouseX) / currentZoom;
			const dy = (moveEvent.clientY - startMouseY) / currentZoom;

			if (node.type === 'image' || node.type === 'video') {
				// Aspect-ratio locked: use dx for all corners, adjust sign
				const sign = (corner === 'se' || corner === 'ne') ? 1 : -1;
				const newWidth = Math.max(50, startWidth + sign * dx);
				const newHeight = newWidth / aspectRatio;
				const updates: Partial<typeof node> = { width: newWidth, height: newHeight };
				if (corner === 'sw' || corner === 'nw') updates.x = startNodeX + (startWidth - newWidth);
				if (corner === 'ne' || corner === 'nw') updates.y = startNodeY + (startHeight - newHeight);
				updateNode(node.id, updates);
			} else if (node.type === 'text') {
				const sign = (corner === 'se' || corner === 'ne') ? 1 : -1;
				const newWidth = Math.max(60, startWidth + sign * dx);
				const updates: Partial<typeof node> = { width: newWidth };
				if (corner === 'sw' || corner === 'nw') updates.x = startNodeX + (startWidth - newWidth);
				updateNode(node.id, updates);
			} else {
				const wSign = (corner === 'se' || corner === 'ne') ? 1 : -1;
				const hSign = (corner === 'se' || corner === 'sw') ? 1 : -1;
				const newWidth = Math.max(100, startWidth + wSign * dx);
				const newHeight = Math.max(100, startHeight + hSign * dy);
				const updates: Partial<typeof node> = { width: newWidth, height: newHeight };
				if (corner === 'sw' || corner === 'nw') updates.x = startNodeX + (startWidth - newWidth);
				if (corner === 'ne' || corner === 'nw') updates.y = startNodeY + (startHeight - newHeight);
				updateNode(node.id, updates);
			}
		};

		const handleResizeUp = () => {
			window.removeEventListener('mousemove', handleResizeMove);
			window.removeEventListener('mouseup', handleResizeUp);
		};

		window.addEventListener('mousemove', handleResizeMove);
		window.addEventListener('mouseup', handleResizeUp);
	};

	const handleRotateStart = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		pushHistory();
		const nodeCenterX = node.x + node.width / 2;
		const nodeCenterY = node.y + node.height / 2;

		const handleRotateMove = (moveEvent: MouseEvent) => {
			const currentZoom = useStore.getState().view.zoom;
			const viewX = useStore.getState().view.x;
			const viewY = useStore.getState().view.y;
			// Convert screen coords to canvas coords
			const canvasX = (moveEvent.clientX - viewX) / currentZoom;
			const canvasY = (moveEvent.clientY - viewY) / currentZoom;
			const angle = Math.atan2(canvasY - nodeCenterY, canvasX - nodeCenterX) * (180 / Math.PI) + 90;
			updateNode(node.id, { rotation: angle });
		};

		const handleRotateUp = () => {
			window.removeEventListener('mousemove', handleRotateMove);
			window.removeEventListener('mouseup', handleRotateUp);
		};

		window.addEventListener('mousemove', handleRotateMove);
		window.addEventListener('mouseup', handleRotateUp);
	};

	const handleMouseUp = (e: React.MouseEvent) => {
		if (isConnecting) {
			e.stopPropagation();
			onEndConnection(node.id);
		}
	};

	const isAutoHeight = node.type === 'text';

	const rotation = node.rotation ?? 0;

	const isColumnChild = parentNode?.type === 'backdrop' && parentNode.layoutMode === 'column';

	const inlineStyle: React.CSSProperties = {
		left: node.x,
		top: node.y,
		width: isAutoHeight ? 'auto' : node.width,
		height: isAutoHeight ? 'auto' : node.height,
		minWidth: isAutoHeight ? '60px' : undefined,
		minHeight: isAutoHeight ? '30px' : undefined,
		cursor: isConnecting ? 'crosshair' : undefined,
		transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
	};

	const showResizeHandle = !isColumnChild && (node.type === 'backdrop' || node.type === 'image' || node.type === 'video' || node.type === 'markdown');

	return (
		<div
			className={`node ${node.type} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
			style={inlineStyle}
			onMouseDown={handleMouseDown}
			onMouseUp={handleMouseUp}
			onDoubleClick={handleDoubleClick}
			onContextMenu={onContextMenu}
		>
			{/* Text Toolbar - shown when text node is selected */}
			{node.type === 'text' && isSelected && !isEditing && (
				<TextToolbar
					nodeId={node.id}
					currentSize={node.textSize || 'medium'}
					currentColor={node.fontColor || defaultFontColor}
					currentWeight={node.fontWeight || 'normal'}
					currentStyle={node.fontStyle || 'normal'}
					zoom={zoom}
				/>
			)}

			<NodeContent
				node={node}
				isEditing={isEditing}
				textareaRef={textareaRef}
				textRef={textRef}
				onInput={handleInput}
				onBlur={handleTextBlur}
				onKeyDown={handleKeyDown}
			/>

			{node.type === 'video' && node.status !== 'downloading' && node.status !== 'error' && (
				<div className="video-badge">
					<Video size={10} />
				</div>
			)}

			{showResizeHandle && (
				<>
					<div className="resize-handle resize-nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
					<div className="resize-handle resize-ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
					<div className="resize-handle resize-sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
					<div className="resize-handle resize-se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
				</>
			)}

			{node.type === 'image' && (isSelected || isDragging) && (
				<div className="rotate-handle" onMouseDown={handleRotateStart} title="Rotate" />
			)}
		</div>
	);
});
