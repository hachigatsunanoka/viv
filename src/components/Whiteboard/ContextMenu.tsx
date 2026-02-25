import React, { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';
import { useStore } from '../../store/useStore';
import { normalizeSizes } from './utils/alignment';
import {
	Minus,
	Undo2,
	Redo2,
	Trash2,
	Grid3X3,
	AlignHorizontalSpaceAround,
	AlignVerticalSpaceAround,
	Scaling,
	Sparkles,
	Type,
	FileText,
	Pin,
	RotateCcw,
	Columns
} from 'lucide-react';

import type { ConnectionData } from '../../store/useStore';

interface ContextMenuProps {
	x: number;
	y: number;
	onClose: () => void;
	targetType?: 'node' | 'connection' | 'canvas';
	targetId?: string;
	connection?: ConnectionData;
	onUpdateConnection?: (id: string, data: Partial<ConnectionData>) => void;
	onNanoBanana?: (id: string) => void;
	onAddText?: () => void;
	onAddMarkdown?: () => void;
	alwaysOnTop?: boolean;
	onToggleAlwaysOnTop?: () => void;
	onToggleLayoutMode?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = (props) => {
	const { x, y, onClose, targetType, targetId, connection, onUpdateConnection, onNanoBanana, onAddText, onAddMarkdown, alwaysOnTop, onToggleAlwaysOnTop, onToggleLayoutMode } = props;
	const { nodes, selectedNodeIds, updateNode, removeNode, removeConnection, alignNodes: storeAlignNodes, pushHistory } = useStore();
	const menuRef = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ x, y });

	const targetNode = nodes.find(n => n.id === targetId);

	const handleAction = (action: () => void) => {
		action();
		onClose();
	};

	const handleAlign = (type: 'grid' | 'horizontal' | 'vertical') => {
		storeAlignNodes(type);
	};

	const handleNormalize = () => {
		const selected = nodes.filter(n => selectedNodeIds.includes(n.id));
		const updates = normalizeSizes(selected);
		if (updates.length > 0) {
			pushHistory();
			updates.forEach(u => updateNode(u.id, u.data));
		}
	};

	const handleDelete = () => {
		if (targetType === 'node' && targetId) {
			removeNode(targetId);
		} else if (targetType === 'connection' && targetId) {
			removeConnection(targetId);
		}
	};

	// Close on click outside
	useEffect(() => {
		window.addEventListener('click', onClose);
		return () => window.removeEventListener('click', onClose);
	}, [onClose]);

	// Clamp position to viewport
	useEffect(() => {
		if (!menuRef.current) return;
		const rect = menuRef.current.getBoundingClientRect();
		const margin = 8;
		const clampedX = Math.min(x, window.innerWidth - rect.width - margin);
		const clampedY = Math.min(y, window.innerHeight - rect.height - margin);
		setPos({ x: Math.max(margin, clampedX), y: Math.max(margin, clampedY) });
	}, [x, y]);

	if (selectedNodeIds.length === 0 && !targetId && !onAddText && !onAddMarkdown && !onToggleAlwaysOnTop) return null;

	const isBackdropTarget = targetNode?.type === 'backdrop' && nodes.some(n => selectedNodeIds.includes(n.id) && n.type === 'backdrop');
	const isImageTarget = targetNode?.type === 'image' && !!onNanoBanana;

	return (
		<div
			ref={menuRef}
			className="context-menu"
			style={{ top: pos.y, left: pos.x }}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		>
			{targetType === 'connection' ? (
				<div className="menu-toolbar-row">
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeWidth: 2 }))} title="Thin">
						<Minus size={16} strokeWidth={1} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeWidth: 4 }))} title="Medium">
						<Minus size={16} strokeWidth={2} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeWidth: 6 }))} title="Thick">
						<Minus size={16} strokeWidth={3} />
					</div>

					<div className="menu-separator-vertical" />

					<div
						className={`icon-btn ${connection?.arrowStart ? 'active' : ''}`}
						onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { arrowStart: !connection?.arrowStart }))}
						title="Toggle Start Arrow"
					>
						<Undo2 size={16} />
					</div>
					<div
						className={`icon-btn ${connection?.arrowEnd ? 'active' : ''}`}
						onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { arrowEnd: !connection?.arrowEnd }))}
						title="Toggle End Arrow"
					>
						<Redo2 size={16} />
					</div>

					<div className="menu-separator-vertical" />

					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeStyle: 'solid' }))} title="Solid">
						<Minus size={16} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeStyle: 'dashed' }))} title="Dashed">
						<Minus size={16} strokeDasharray="4 2" />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { strokeStyle: 'dotted' }))} title="Dotted">
						<Minus size={16} strokeDasharray="2 2" />
					</div>

					<div className="menu-separator-vertical" />

					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { color: '#000' }))} title="Black">
						<div className="color-swatch" style={{ backgroundColor: '#000' }} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { color: '#999' }))} title="Gray">
						<div className="color-swatch" style={{ backgroundColor: '#999' }} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { color: '#ff4444' }))} title="Red">
						<div className="color-swatch" style={{ backgroundColor: '#ff4444' }} />
					</div>
					<div className="icon-btn" onClick={() => handleAction(() => onUpdateConnection?.(targetId!, { color: '#4444ff' }))} title="Blue">
						<div className="color-swatch" style={{ backgroundColor: '#4444ff' }} />
					</div>

					<div className="menu-separator-vertical" />

					<div className="icon-btn" onClick={() => handleAction(handleDelete)} title="Delete Connection" style={{ color: '#ff4444' }}>
						<Trash2 size={16} />
					</div>
				</div>
			) : (
				<>
					{isBackdropTarget && (
						<>
							<div className="conn-toolbar" style={{ marginBottom: 0 }}>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(200, 200, 200, 0.15)' }); })} title="Gray">
									<div className="color-swatch" style={{ backgroundColor: '#999', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(239, 68, 68, 0.15)' }); })} title="Red">
									<div className="color-swatch" style={{ backgroundColor: '#ef4444', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(59, 130, 246, 0.15)' }); })} title="Blue">
									<div className="color-swatch" style={{ backgroundColor: '#3b82f6', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(34, 197, 94, 0.15)' }); })} title="Green">
									<div className="color-swatch" style={{ backgroundColor: '#22c55e', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(245, 158, 11, 0.15)' }); })} title="Yellow">
									<div className="color-swatch" style={{ backgroundColor: '#f59e0b', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
								<div className="conn-tb-btn" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { color: 'rgba(100, 108, 255, 0.15)' }); })} title="Purple">
									<div className="color-swatch" style={{ backgroundColor: '#646cff', border: '1px solid rgba(0,0,0,0.15)' }} />
								</div>
							</div>
							<div className="menu-separator" />
						</>
					)}

					{selectedNodeIds.length >= 2 && (<>
						<div className="menu-item" onClick={() => handleAction(() => handleAlign('grid'))}>
							<Grid3X3 size={16} /> Auto Align (Grid)
						</div>
						<div className="menu-item" onClick={() => handleAction(() => handleAlign('horizontal'))}>
							<AlignHorizontalSpaceAround size={16} /> Align Horizontal
						</div>
						<div className="menu-item" onClick={() => handleAction(() => handleAlign('vertical'))}>
							<AlignVerticalSpaceAround size={16} /> Align Vertical
						</div>
						<div className="menu-separator" />
						<div className="menu-item" onClick={() => handleAction(handleNormalize)}>
							<Scaling size={16} /> Normalize Size
						</div>
					</>)}

					{selectedNodeIds.length === 1 && targetNode?.type === 'backdrop' && onToggleLayoutMode && (
						<>
							<div className="menu-item" onClick={() => handleAction(onToggleLayoutMode)}>
								<Columns size={16} /> {targetNode.layoutMode === 'column' ? 'Switch to Freeform' : 'Switch to Column Mode'}
							</div>
							<div className="menu-separator" />
						</>
					)}

					{isImageTarget && (
						<>
							{(isBackdropTarget || selectedNodeIds.length >= 2) && <div className="menu-separator" />}
							<div className="menu-item" onClick={() => handleAction(() => onNanoBanana!(targetId!))}>
								<Sparkles size={16} /> Generate with Nano Banana
							</div>
						</>
					)}

					{(onAddText || onAddMarkdown) && (
						<>
							{(isBackdropTarget || selectedNodeIds.length >= 2 || isImageTarget) && (
								<div className="menu-separator" />
							)}
							{onAddText && (
								<div className="menu-item" onClick={() => handleAction(onAddText)}>
									<Type size={16} /> Add Text
								</div>
							)}
							{onAddMarkdown && (
								<div className="menu-item" onClick={() => handleAction(onAddMarkdown)}>
									<FileText size={16} /> Add Markdown
								</div>
							)}
							{onAddMarkdown && <div className="menu-separator" />}
						</>
					)}

					{targetId && (
						<>
							{(isBackdropTarget || selectedNodeIds.length >= 2 || isImageTarget || onAddText || onAddMarkdown) && (
								<div className="menu-separator" />
							)}
							{targetNode?.type === 'image' && (targetNode.rotation ?? 0) !== 0 && (
								<div className="menu-item" onClick={() => handleAction(() => { pushHistory(); updateNode(targetId!, { rotation: 0 }); })}>
									<RotateCcw size={16} /> Reset Rotation
								</div>
							)}
							<div className="menu-item" onClick={() => handleAction(handleDelete)} style={{ color: '#ff4444' }}>
								<Trash2 size={16} /> Delete
							</div>
						</>
					)}

					{onToggleAlwaysOnTop && !targetId && (
						<>
							<div className="menu-separator" />
							<div className={`menu-item ${alwaysOnTop ? 'active' : ''}`} onClick={() => handleAction(onToggleAlwaysOnTop)}>
								<Pin size={16} /> Always On Top {alwaysOnTop ? '✓' : ''}
							</div>
						</>
					)}
				</>
			)}
		</div>
	);
};
