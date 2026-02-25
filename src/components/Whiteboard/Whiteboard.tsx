import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/shallow';
import type { NodeData } from '../../store/useStore';
import { invoke } from '@tauri-apps/api/core';
import { ZOOM_SENSITIVITY_WHEEL, ZOOM_SENSITIVITY_DRAG } from '../../constants';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readFile } from '@tauri-apps/plugin-fs';
import { useConfig } from '../../hooks/useConfig';
import { Node } from './Node';
import { ConnectionLayer } from './ConnectionLayer';
import { useTauriDragDrop } from './hooks/useTauriDragDrop';
import { useBrowserInteractions } from './hooks/useBrowserInteractions';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ShortcutView } from './ShortcutView';
import { ContextMenu } from './ContextMenu';
import { NanoBananaDialog } from './NanoBananaDialog';
import { SettingsDialog } from './SettingsDialog';
import { ConfirmQuitDialog } from './ConfirmQuitDialog';
import { findClosestNode } from './utils/connection';
import { Settings, MousePointer2, Pencil, Eraser } from 'lucide-react';
import { useNotification } from '../Notification/NotificationContext';
import './Whiteboard.css';

// Returns true if line segment (ax,ay)-(bx,by) intersects or is inside rect (rx1,ry1)-(rx2,ry2)
function lineIntersectsRect(ax: number, ay: number, bx: number, by: number, rx1: number, ry1: number, rx2: number, ry2: number): boolean {
	// Liang-Barsky algorithm
	const dx = bx - ax, dy = by - ay;
	const p = [-dx, dx, -dy, dy];
	const q = [ax - rx1, rx2 - ax, ay - ry1, ry2 - ay];
	let t0 = 0, t1 = 1;
	for (let i = 0; i < 4; i++) {
		if (p[i] === 0) {
			if (q[i] < 0) return false;
		} else {
			const t = q[i] / p[i];
			if (p[i] < 0) t0 = Math.max(t0, t);
			else t1 = Math.min(t1, t);
		}
	}
	return t0 <= t1;
}

export const Whiteboard: React.FC = () => {
	const {
		nodes, view, panView, zoomView, addNode, addConnection,
		activeNodeId, clearSelection, setActiveNodeId, setSelectedNodes,
		updateConnection, connections,
		dotGridEnabled, dotGridPitch,
		activeTool, setActiveTool, pushHistory,
		penColor, setPenColor, penThickness, setPenThickness, clearDrawings
	} = useStore(
		useShallow((s) => ({
			nodes: s.nodes,
			view: s.view,
			panView: s.panView,
			zoomView: s.zoomView,
			addNode: s.addNode,
			addConnection: s.addConnection,
			activeNodeId: s.activeNodeId,
			clearSelection: s.clearSelection,
			setActiveNodeId: s.setActiveNodeId,
			setSelectedNodes: s.setSelectedNodes,
			updateConnection: s.updateConnection,
			connections: s.connections,
			dotGridEnabled: s.dotGridEnabled,
			dotGridPitch: s.dotGridPitch,
			activeTool: s.activeTool,
			setActiveTool: s.setActiveTool,
			pushHistory: s.pushHistory,
			penColor: s.penColor,
			setPenColor: s.setPenColor,
			penThickness: s.penThickness,
			setPenThickness: s.setPenThickness,
			clearDrawings: s.clearDrawings,
		}))
	);
	const [isPanning, setIsPanning] = useState(false);
	const [isZooming, setIsZooming] = useState(false);
	const zoomStartY = useRef(0);
	const zoomStartZoom = useRef(1);
	const zoomStartCenter = useRef<{ x: number; y: number } | undefined>(undefined);
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
	const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);
	const [tempConnectionEnd, setTempConnectionEnd] = useState<{ x: number; y: number } | null>(null);
	const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
	const [isDrawing, setIsDrawing] = useState(false);
	const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		targetType?: 'node' | 'connection' | 'canvas';
		targetId?: string;
	} | null>(null);
	const [activeNanoBananaNodeId, setActiveNanoBananaNodeId] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const isSpacePressed = useRef(false);
	const rightMouseDragged = useRef(false);
	const isAlwaysOnTopRef = useRef(false);
	const [alwaysOnTop, setAlwaysOnTop] = useState(false);

	const [showShortcuts, setShowShortcuts] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showConfirmQuit, setShowConfirmQuit] = useState(false);
	const { ytDlpPath, videoSize, reloadConfig } = useConfig();
	const { addNotification } = useNotification();

	const toggleAlwaysOnTop = useCallback(() => {
		const newValue = !isAlwaysOnTopRef.current;
		isAlwaysOnTopRef.current = newValue;
		getCurrentWindow().setAlwaysOnTop(newValue);
		setAlwaysOnTop(newValue);
		addNotification(newValue ? 'Always on top: on' : 'Always on top: off', 'info');
	}, [addNotification]);

	// Keyboard Shortcuts Hook
	useKeyboardShortcuts({
		containerRef,
		activeNodeId,
		toggleShortcuts: () => setShowShortcuts(prev => !prev),
		setIsPanning,
		isSpacePressed,
		isAlwaysOnTop: isAlwaysOnTopRef,
		onAlwaysOnTopChanged: (value: boolean) => {
			setAlwaysOnTop(value);
			addNotification(value ? 'Always on top: on' : 'Always on top: off', 'info');
		},
		onQuit: () => setShowConfirmQuit(true),
		addNotification,
		onCreateBackdrop: () => { },
	});

	// Alt+Middle click: drag window — must use native capture listener to beat WebView2 autoscroll
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const onMiddleDown = (e: MouseEvent) => {
			if (e.button === 1 && e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				getCurrentWindow().startDragging();
			}
		};
		el.addEventListener('mousedown', onMiddleDown, { capture: true });
		return () => el.removeEventListener('mousedown', onMiddleDown, { capture: true });
	}, []);

	// Custom hook for handling Tauri file drops
	useTauriDragDrop(view, addNode, containerRef);

	// Custom hook for handling Browser interactions (Paste URL, Drag & Drop from Browser)
	const handleDownloadUrl = React.useCallback(async (url: string, x: number, y: number) => {
		const nodeId = crypto.randomUUID();
		const placeholderNode: NodeData = {
			id: nodeId,
			type: 'video',
			x,
			y,
			width: 480,
			height: 270,
			content: url,
			status: 'downloading',
		};
		addNode(placeholderNode);
		setSelectedNodes([nodeId]);
		addNotification('Downloading video...', 'info');

		try {
			const downloadedPath = await invoke<string>('download_video', { url, ytDlpPath: ytDlpPath || null, videoSize: videoSize || null });

			// Read downloaded file and create blob URL
			const contents = await readFile(downloadedPath);
			const blob = new Blob([contents], { type: 'video/mp4' });
			const blobUrl = URL.createObjectURL(blob);

			useStore.getState().updateNode(nodeId, {
				content: blobUrl,
				originalPath: downloadedPath,
				status: undefined,
			});
			addNotification('Download complete', 'success');
		} catch (err) {
			console.error('Failed to download video:', err);
			useStore.getState().updateNode(nodeId, {
				status: 'error',
			});
			addNotification('Download failed', 'error');
		}
	}, [addNode, setSelectedNodes, ytDlpPath, videoSize, addNotification]);

	useBrowserInteractions(view, addNode, containerRef, setSelectedNodes, handleDownloadUrl);

	const handleWheel = (e: React.WheelEvent) => {
		// Zoom with wheel (no modifier needed)
		e.preventDefault();
		// Adjust sensitivity as needed. Default deltaY is usually around 100.
		// Use cursor position as center
		const rect = containerRef.current?.getBoundingClientRect();
		if (rect) {
			const centerX = e.clientX - rect.left;
			const centerY = e.clientY - rect.top;
			zoomView(e.deltaY, { x: centerX, y: centerY }, ZOOM_SENSITIVITY_WHEEL);
		} else {
			zoomView(e.deltaY, undefined, ZOOM_SENSITIVITY_WHEEL);
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		// Right click drag -> zoom
		if (e.button === 2) {
			rightMouseDragged.current = false;
			e.preventDefault();
			setIsZooming(true);
			zoomStartY.current = e.clientY;
			zoomStartZoom.current = useStore.getState().view.zoom;
			const rect0 = containerRef.current?.getBoundingClientRect();
			zoomStartCenter.current = rect0 ? { x: e.clientX - rect0.left, y: e.clientY - rect0.top } : undefined;
			return;
		}

		// Alt + Middle click -> drag window
		if (e.button === 1 && e.altKey) {
			e.preventDefault();
			getCurrentWindow().startDragging();
			return;
		}

		if (e.button === 1 || (e.button === 0 && isSpacePressed.current)) { // Middle click OR Left+Space
			setIsPanning(true);
			e.preventDefault(); // Prevent default middle click scroll
			return;
		}

		if (e.button === 0) {
			// Alt + Left Click on background -> Drag Window
			if (e.altKey) {
				const target = e.target as HTMLElement;
				if (
					target.classList.contains('whiteboard-container') ||
					target.classList.contains('whiteboard-content')
				) {
					getCurrentWindow().startDragging();
				}
				return;
			}

			e.preventDefault();
			(document.activeElement as HTMLElement)?.blur();

			if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
				clearSelection();
				setSelectedConnectionIds([]);
			}
			setActiveNodeId(null);

			const worldX = (e.clientX - view.x) / view.zoom;
			const worldY = (e.clientY - view.y) / view.zoom;

			if (activeTool === 'draw') {
				setIsDrawing(true);
				setCurrentStroke([{ x: worldX, y: worldY }]);
				return;
			}

			setIsSelecting(true);
			setSelectionBox({ startX: worldX, startY: worldY, currentX: worldX, currentY: worldY });
		}
	};

	const [snapTarget, setSnapTarget] = useState<{ nodeId: string; x: number; y: number } | null>(null);

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isZooming) {
			rightMouseDragged.current = true;
			// Drag up/right = zoom in, drag down/left = zoom out
			const delta = e.movementX - e.movementY;
			if (delta !== 0) {
				zoomView(-delta, zoomStartCenter.current, ZOOM_SENSITIVITY_DRAG);
			}
		} else if (isPanning) {
			panView(e.movementX, e.movementY);
		} else if (isDrawing) {
			const worldX = (e.clientX - view.x) / view.zoom;
			const worldY = (e.clientY - view.y) / view.zoom;
			setCurrentStroke(prev => [...prev, { x: worldX, y: worldY }]);
		} else if (isSelecting && selectionBox) {
			const worldX = (e.clientX - view.x) / view.zoom;
			const worldY = (e.clientY - view.y) / view.zoom;
			setSelectionBox({ ...selectionBox, currentX: worldX, currentY: worldY });
		}

		if (connectingNodeId) {
			const worldX = (e.clientX - view.x) / view.zoom;
			const worldY = (e.clientY - view.y) / view.zoom;

			const snap = findClosestNode(worldX, worldY, nodes, connectingNodeId);
			setSnapTarget(snap);

			if (snap) {
				setTempConnectionEnd({ x: snap.x, y: snap.y });
			} else {
				setTempConnectionEnd({ x: worldX, y: worldY });
			}
		}
	};

	const handleMouseUp = () => {
		if (isSelecting && selectionBox) {
			// Calculate intersection
			const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
			const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
			const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
			const y2 = Math.max(selectionBox.startY, selectionBox.currentY);

			const selectedIds = nodes.filter(node => {
				return (
					node.x < x2 &&
					node.x + node.width > x1 &&
					node.y < y2 &&
					node.y + node.height > y1
				);
			}).map(n => n.id);

			if (selectedIds.length > 0) {
				setSelectedNodes(selectedIds);
			}

			// Select connections only if no nodes were selected (nodes take priority)
			const nodeMap = new Map(nodes.map(n => [n.id, n]));
			const connIds = selectedIds.length > 0 ? [] : useStore.getState().connections.filter(conn => {
				const a = nodeMap.get(conn.fromNodeId);
				const b = nodeMap.get(conn.toNodeId);
				if (!a || !b) return false;
				const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
				const bx = b.x + b.width / 2, by = b.y + b.height / 2;
				return lineIntersectsRect(ax, ay, bx, by, x1, y1, x2, y2);
			}).map(c => c.id);
			setSelectedConnectionIds(connIds);
		}

		setIsPanning(false);
		setIsZooming(false);
		setIsSelecting(false);
		setSelectionBox(null);

		if (isDrawing) {
			setIsDrawing(false);
			if (currentStroke.length > 1) {
				// Calculate bounds
				let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
				for (const p of currentStroke) {
					minX = Math.min(minX, p.x);
					minY = Math.min(minY, p.y);
					maxX = Math.max(maxX, p.x);
					maxY = Math.max(maxY, p.y);
				}

				// Normalize points relative to top-left
				const width = Math.max(2, maxX - minX);
				const height = Math.max(2, maxY - minY);
				const normalizedPoints = currentStroke.map(p => ({
					x: p.x - minX,
					y: p.y - minY
				}));

				addNode({
					id: crypto.randomUUID(),
					type: 'draw',
					x: minX,
					y: minY,
					width,
					height,
					content: '',
					points: normalizedPoints,
					strokeWidth: penThickness,
					fontColor: penColor,
				});
			}
			setCurrentStroke([]);
		}

		if (connectingNodeId) {
			if (snapTarget) {
				addConnection({
					id: crypto.randomUUID(),
					fromNodeId: connectingNodeId,
					toNodeId: snapTarget.nodeId,
					strokeWidth: 2,
					color: '#999',
					strokeStyle: 'solid',
					arrowEnd: true,
				});
			}

			setConnectingNodeId(null);
			setTempConnectionEnd(null);
			setSnapTarget(null);
		}
	};

	const handleStartConnection = React.useCallback((nodeId: string, e: React.MouseEvent) => {
		const currentView = useStore.getState().view;
		setConnectingNodeId(nodeId);
		const worldX = (e.clientX - currentView.x) / currentView.zoom;
		const worldY = (e.clientY - currentView.y) / currentView.zoom;
		setTempConnectionEnd({ x: worldX, y: worldY });
	}, []);

	const handleEndConnection = React.useCallback((targetNodeId: string) => {
		if (connectingNodeId && connectingNodeId !== targetNodeId) {
			addConnection({
				id: crypto.randomUUID(),
				fromNodeId: connectingNodeId,
				toNodeId: targetNodeId,
				strokeWidth: 2,
				color: '#999',
				strokeStyle: 'solid',
				arrowEnd: true,
			});
		}

		setConnectingNodeId(null);
		setTempConnectionEnd(null);
		setSnapTarget(null);
	}, [addConnection, connectingNodeId]);

	const handleContextMenuCallback = React.useCallback((e: React.MouseEvent, targetId?: string, targetType: 'node' | 'connection' | 'canvas' = 'canvas') => {
		e.preventDefault();
		e.stopPropagation();
		if (rightMouseDragged.current) {
			rightMouseDragged.current = false;
			return;
		}
		const { pageX, pageY } = e;
		setContextMenu({ x: pageX, y: pageY, targetType, targetId });
	}, []);

	const handleCloseContextMenu = () => {
		setContextMenu(null);
	};




	const handleNanoBanana = (nodeId: string) => {
		setActiveNanoBananaNodeId(nodeId);
	};

	const handleNanoBananaGenerate = (dataUrl: string) => {
		if (!activeNanoBananaNodeId) return;
		const sourceNode = nodes.find(n => n.id === activeNanoBananaNodeId);
		if (!sourceNode) return;

		const newNode = {
			id: crypto.randomUUID(),
			type: 'image' as const,
			x: sourceNode.x + sourceNode.width + 20,
			y: sourceNode.y,
			width: sourceNode.width,
			height: sourceNode.height,
			content: dataUrl,
		};

		addNode(newNode);
		setActiveNanoBananaNodeId(null);
	};


	const handleAddText = () => {
		if (!contextMenu) return;

		const worldX = (contextMenu.x - view.x) / view.zoom;
		const worldY = (contextMenu.y - view.y) / view.zoom;

		const newNode = {
			id: crypto.randomUUID(),
			type: 'text' as const,
			x: worldX,
			y: worldY,
			width: 200,
			height: 50,
			content: '',
			textSize: 'medium' as const,
			fontSize: 24,
		};

		addNode(newNode);
		setSelectedNodes([newNode.id]);
	};

	const handleAddMarkdown = () => {
		if (!contextMenu) return;

		const worldX = (contextMenu.x - view.x) / view.zoom;
		const worldY = (contextMenu.y - view.y) / view.zoom;

		const newNode = {
			id: crypto.randomUUID(),
			type: 'markdown' as const,
			x: worldX,
			y: worldY,
			width: 280,
			height: 320,
			content: '# Title\n\nWrite your markdown here...',
		};

		addNode(newNode);
		setSelectedNodes([newNode.id]);
	};

	const handleToggleLayoutMode = () => {
		if (!contextMenu?.targetId) return;

		const targetNode = nodes.find(n => n.id === contextMenu.targetId);
		if (!targetNode || targetNode.type !== 'backdrop') return;

		pushHistory();
		useStore.getState().updateNode(targetNode.id, {
			layoutMode: targetNode.layoutMode === 'column' ? 'freeform' : 'column'
		});
	};

	return (
		<div
			ref={containerRef}
			className={`whiteboard-container ${isPanning ? 'dragging' : ''}`}
			style={{ cursor: isPanning ? 'grabbing' : 'default', backgroundSize: `${dotGridPitch * view.zoom}px ${dotGridPitch * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px`, backgroundImage: dotGridEnabled ? undefined : 'none' }}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onContextMenu={handleContextMenuCallback}
		>

			<div
				className="whiteboard-content"
				style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
			>
				{/* Selection Box */}
				{isSelecting && selectionBox && (
					<div
						style={{
							position: 'absolute',
							left: Math.min(selectionBox.startX, selectionBox.currentX),
							top: Math.min(selectionBox.startY, selectionBox.currentY),
							width: Math.abs(selectionBox.currentX - selectionBox.startX),
							height: Math.abs(selectionBox.currentY - selectionBox.startY),
							border: '1px solid #007bff',
							backgroundColor: 'rgba(0, 123, 255, 0.1)',
							pointerEvents: 'none',
							zIndex: 1000
						}}
					/>
				)}
				<ConnectionLayer
					tempConnection={
						connectingNodeId && tempConnectionEnd
							? { fromNodeId: connectingNodeId, toPoint: tempConnectionEnd }
							: undefined
					}
					selectedConnectionIds={selectedConnectionIds}
					onSelectConnection={(id, multi) => {
						if (id === null) {
							setSelectedConnectionIds([]);
						} else if (multi) {
							setSelectedConnectionIds(prev =>
								prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
							);
						} else {
							setSelectedConnectionIds([id]);
						}
					}}
					onUpdateConnection={(_id, data) => {
						selectedConnectionIds.forEach(cid => updateConnection(cid, data));
					}}
					onDeleteConnection={() => {
						selectedConnectionIds.forEach(id => useStore.getState().removeConnection(id));
						setSelectedConnectionIds([]);
					}}
					onContextMenu={(e, id) => handleContextMenuCallback(e, id, 'connection')}
					zoom={view.zoom}
				/>
				{nodes.map((node) => (
					<Node
						key={node.id}
						node={node}
						onStartConnection={handleStartConnection}
						onEndConnection={handleEndConnection}
						onContextMenu={(e) => handleContextMenuCallback(e, node.id, 'node')}
						isConnecting={!!connectingNodeId}
					/>
				))}

				{/* Real-time Current Stroke Overlay */}
				{isDrawing && currentStroke.length > 1 && (
					<svg
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							width: '100%',
							height: '100%',
							overflow: 'visible',
							pointerEvents: 'none',
							zIndex: 1001,
						}}
					>
						<polyline
							points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')}
							fill="none"
							stroke={penColor}
							strokeWidth={penThickness / view.zoom}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</div>
			{showShortcuts && <ShortcutView onClose={() => setShowShortcuts(false)} />}
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					onClose={handleCloseContextMenu}
					targetType={contextMenu.targetType}
					targetId={contextMenu.targetId}
					connection={contextMenu.targetId && contextMenu.targetType === 'connection' ? connections.find(c => c.id === contextMenu.targetId) : undefined}
					onUpdateConnection={updateConnection}

					onNanoBanana={handleNanoBanana}
					onAddText={!contextMenu.targetType || contextMenu.targetType === 'canvas' ? handleAddText : undefined}
					onAddMarkdown={!contextMenu.targetType || contextMenu.targetType === 'canvas' ? handleAddMarkdown : undefined}
					alwaysOnTop={alwaysOnTop}
					onToggleAlwaysOnTop={toggleAlwaysOnTop}
					onToggleLayoutMode={handleToggleLayoutMode}
				/>
			)}
			{activeNanoBananaNodeId && (
				<NanoBananaDialog
					nodeId={activeNanoBananaNodeId}
					onClose={() => setActiveNanoBananaNodeId(null)}
					onGenerate={handleNanoBananaGenerate}
				/>
			)}
			{showSettings && (
				<SettingsDialog
					onClose={() => {
						setShowSettings(false);
						reloadConfig();
					}}
				/>
			)}
			{showConfirmQuit && (
				<ConfirmQuitDialog onCancel={() => setShowConfirmQuit(false)} />
			)}
			<div className="bottom-controls">
				{activeTool === 'draw' && (
					<div className="draw-tools">
						<div className="thickness-picker">
							{[2, 4, 8].map(t => (
								<button
									key={t}
									className={`draw-tool-btn ${penThickness === t ? 'active' : ''}`}
									onClick={() => setPenThickness(t)}
									title={`Thickness: ${t}px`}
								>
									<div className="thickness-dot" style={{ width: t * 1.5, height: t * 1.5, minWidth: 4, minHeight: 4, borderRadius: '50%', backgroundColor: penThickness === t ? '#fff' : '#aaa' }} />
								</button>
							))}
						</div>
						<div className="divider" />
						<div className="color-picker">
							{['var(--color-text-primary)', '#ff4444', '#ffb703', '#44ff44', '#00b4d8'].map(c => (
								<button
									key={c}
									className={`draw-tool-btn ${penColor === c ? 'active' : ''}`}
									onClick={() => setPenColor(c)}
									title="Color"
								>
									<div className="color-dot" style={{ backgroundColor: c === 'var(--color-text-primary)' ? 'currenColor' : c, ...(c === 'var(--color-text-primary)' ? { background: 'var(--color-text-primary)' } : {}) }} />
								</button>
							))}
						</div>
						<div className="divider" />
						<button className="draw-tool-btn clear-btn" onClick={clearDrawings} title="Clear All Drawings">
							<Eraser size={16} />
						</button>
					</div>
				)}
				<div className="tool-switcher">
					<button
						className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
						onClick={() => setActiveTool('select')}
						onMouseDown={(e) => e.stopPropagation()}
						title="Select Tool (V)"
					>
						<MousePointer2 size={18} />
					</button>
					<button
						className={`tool-button ${activeTool === 'draw' ? 'active' : ''}`}
						onClick={() => setActiveTool('draw')}
						onMouseDown={(e) => e.stopPropagation()}
						title="Pen Tool (P)"
					>
						<Pencil size={18} />
					</button>
				</div>
				<button
					className="settings-button"
					onClick={() => setShowSettings(true)}
					onMouseDown={(e) => e.stopPropagation()}
					title="Settings"
				>
					<Settings size={18} />
				</button>
			</div>
		</div>
	);
};
