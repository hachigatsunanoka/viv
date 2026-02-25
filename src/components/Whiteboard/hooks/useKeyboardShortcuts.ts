import React, { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useStore } from '../../../store/useStore';
import { saveBoard, saveBoardAs, loadBoard } from '../../../utils/persistence';
import type { NotificationType } from '../../Notification/NotificationContext';
import { BACKDROP_INIT_PADDING } from '../../../constants';

interface UseKeyboardShortcutsProps {
	containerRef: React.RefObject<HTMLDivElement | null>;
	activeNodeId: string | null;
	toggleShortcuts: () => void;
	setIsPanning: (isPanning: boolean) => void;
	isSpacePressed: React.MutableRefObject<boolean>;
	isAlwaysOnTop: React.MutableRefObject<boolean>;
	onAlwaysOnTopChanged: (value: boolean) => void;
	onQuit: () => void;
	addNotification: (message: string, type?: NotificationType) => void;
	onCreateBackdrop: () => void;
}

export const useKeyboardShortcuts = ({
	containerRef,
	activeNodeId,
	toggleShortcuts,
	setIsPanning,
	isSpacePressed,
	isAlwaysOnTop,
	onAlwaysOnTopChanged,
	onQuit,
	addNotification,
	onCreateBackdrop,
}: UseKeyboardShortcutsProps) => {
	const {
		removeSelectedNodes,
		alignNodes,
		focusOnNodes,
		setActiveNodeId,
		setSelectedNodes,
		setActiveTool,
		undo,
		redo,
	} = useStore();



	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+Q: Close application
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyQ') {
				e.preventDefault();
				onQuit();
				return;
			}

			// Ctrl+T: Toggle Always On Top
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyT') {
				e.preventDefault();
				const newValue = !isAlwaysOnTop.current;
				isAlwaysOnTop.current = newValue;
				getCurrentWindow().setAlwaysOnTop(newValue);
				onAlwaysOnTopChanged(newValue);
				return;
			}

			// Ctrl+Shift+S: Save As
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyS') {
				e.preventDefault();
				saveBoardAs().then(() => {
					addNotification('Board saved', 'success');
				}).catch(() => {
					addNotification('Failed to save board', 'error');
				});
				return;
			}

			// Ctrl+S: Save (always available)
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
				e.preventDefault();
				saveBoard().then((saved) => {
					if (saved) addNotification('Board saved', 'success');
				}).catch(() => {
					addNotification('Failed to save board', 'error');
				});
				return;
			}

			// Ctrl+O: Open (always available)
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyO') {
				e.preventDefault();
				loadBoard();
				return;
			}

			// Ctrl+Z: Undo
			if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
				const activeElement = document.activeElement;
				if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;
				if (!activeNodeId) {
					e.preventDefault();
					undo();
					addNotification('Undo', 'info');
				}
				return;
			}

			// Ctrl+Shift+Z or Ctrl+Y: Redo
			if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') || ((e.ctrlKey || e.metaKey) && e.code === 'KeyY')) {
				const activeElement = document.activeElement;
				if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;
				if (!activeNodeId) {
					e.preventDefault();
					redo();
					addNotification('Redo', 'info');
				}
				return;
			}

			const activeElement = document.activeElement;
			const isInputActive = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

			if (activeNodeId) return; // Don't trigger if editing a node

			const isAlt = e.altKey;

			// F: Focus
			if (e.code === 'KeyF' && !isInputActive) {
				e.preventDefault();
				if (containerRef.current) {
					const { width, height } = containerRef.current.getBoundingClientRect();
					focusOnNodes({ width, height });
				}
			}

			// Enter: Open Annotation View (if single node selected, but NOT for text/markdown)
			if (e.code === 'Enter' && !isInputActive) {
				const state = useStore.getState();
				const currentSelected = state.selectedNodeIds;
				if (currentSelected.length === 1) {
					const selectedNode = state.nodes.find(n => n.id === currentSelected[0]);
					if (selectedNode && selectedNode.type !== 'text' && selectedNode.type !== 'markdown') {
						e.preventDefault();
						setActiveNodeId(currentSelected[0]);
					}
				}
			}

			// B: Create backdrop around selected nodes
			if (e.key.toLowerCase() === 'b' && !isAlt && !isInputActive) {
				const state = useStore.getState();
				const selectedNodes = state.nodes.filter(n => state.selectedNodeIds.includes(n.id));
				if (selectedNodes.length > 0) {
					const minX = Math.min(...selectedNodes.map(n => n.x));
					const minY = Math.min(...selectedNodes.map(n => n.y));
					const maxX = Math.max(...selectedNodes.map(n => n.x + n.width));
					const maxY = Math.max(...selectedNodes.map(n => n.y + n.height));
					const padding = BACKDROP_INIT_PADDING;
					const backdropNode = {
						id: crypto.randomUUID(),
						type: 'backdrop' as const,
						x: minX - padding,
						y: minY - padding * 1.5,
						width: maxX - minX + padding * 2,
						height: maxY - minY + padding * 2.5,
						content: 'New Backdrop',
						color: 'rgba(200, 200, 200, 0.2)',
					};
					state.setNodes([backdropNode, ...state.nodes]);
					setSelectedNodes([backdropNode.id]);
					onCreateBackdrop();
				}
			}

			// Shortcuts for Alignment (Alt + Key)
			if (isAlt && e.code === 'KeyH' && !isInputActive) { e.preventDefault(); alignNodes('horizontal'); }
			if (isAlt && e.code === 'KeyV' && !isInputActive) { e.preventDefault(); alignNodes('vertical'); }
			if (isAlt && e.code === 'KeyG' && !isInputActive) { e.preventDefault(); alignNodes('grid'); }

			// Global shortcuts
			if (e.key === '?' && !isInputActive) {
				toggleShortcuts();
			}
			if (e.code === 'Space' && !e.repeat && !isInputActive) {
				isSpacePressed.current = true;
				if (containerRef.current) containerRef.current.style.cursor = 'grab';
			}

			// V: Select Tool
			if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !isAlt && !isInputActive) {
				setActiveTool('select');
				addNotification('Select tool', 'info');
			}

			// P: Pen Tool
			if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !isAlt && !isInputActive) {
				setActiveTool('draw');
				addNotification('Pen tool', 'info');
			}

			if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
				removeSelectedNodes();
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === 'Space') {
				isSpacePressed.current = false;
				if (containerRef.current) containerRef.current.style.cursor = 'default';
				setIsPanning(false);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [activeNodeId, containerRef, toggleShortcuts, setIsPanning, isSpacePressed, isAlwaysOnTop, onAlwaysOnTopChanged, onQuit, addNotification, removeSelectedNodes, alignNodes, focusOnNodes, setActiveNodeId, setSelectedNodes, onCreateBackdrop, setActiveTool, undo, redo]);
};
