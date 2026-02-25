import { create } from 'zustand';
import { alignNodes as calculateAlignment } from '../components/Whiteboard/utils/alignment';
import { SANS_FONTS, MONO_FONTS } from '../lib/fontOptions';
import { ZOOM_SENSITIVITY, ZOOM_MIN, ZOOM_MAX, FOCUS_PADDING, FOCUS_ZOOM_MAX } from '../constants';

export type NodeType = 'image' | 'video' | 'text' | 'markdown' | 'backdrop' | 'draw';

export interface NodeData {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	content: string; // URL or text content
	originalPath?: string; // Original file path for optimization
	mediaId?: string; // Unique ID for embedded media in archive
	type: NodeType;
	parentId?: string;
	fontSize?: number;
	fontColor?: string;
	fontWeight?: 'normal' | 'bold';
	fontStyle?: 'normal' | 'italic';
	textSize?: 'small' | 'medium' | 'large'; // Size preset for text nodes
	color?: string; // Background color for backdrops
	status?: 'downloading' | 'error'; // Download status for yt-dlp
	annotations?: Record<number, string>; // Frame number -> DataURL
	comments?: Comment[];
	inPoint?: number;
	outPoint?: number;
	rotation?: number;
	points?: { x: number; y: number }[];
	strokeWidth?: number;
	layoutMode?: 'freeform' | 'column'; // Used for backdrops to switch to column layout
}

export interface Comment {
	id: string;
	text: string;
	frame: number;
	timestamp: number;
}

export interface ConnectionData {
	id: string;
	fromNodeId: string;
	toNodeId: string;
	strokeStyle?: 'solid' | 'dashed' | 'dotted';
	strokeWidth?: number; // 2 | 4 | 6
	color?: string;
	arrowStart?: boolean;
	arrowEnd?: boolean;
}

export interface HistoryState {
	nodes: NodeData[];
	connections: ConnectionData[];
}

export interface AppState {
	nodes: NodeData[];
	connections: ConnectionData[];
	view: { x: number; y: number; zoom: number };
	activeNodeId: string | null;
	selectedNodeIds: string[];
	setNodes: (nodes: NodeData[]) => void;
	addNode: (node: NodeData) => void;
	updateNode: (id: string, data: Partial<NodeData>) => void;
	removeNode: (id: string) => void;
	removeSelectedNodes: () => void;
	addConnection: (connection: ConnectionData) => void;
	removeConnection: (id: string) => void;
	setView: (view: { x: number; y: number; zoom: number }) => void;
	setActiveNodeId: (id: string | null) => void;
	selectNode: (id: string, multi: boolean) => void;
	setSelectedNodes: (ids: string[]) => void;
	clearSelection: () => void;
	panView: (dx: number, dy: number) => void;
	zoomView: (delta: number, center?: { x: number; y: number }, sensitivity?: number) => void;
	moveNodes: (ids: string[], dx: number, dy: number) => void;
	updateConnection: (id: string, data: Partial<ConnectionData>) => void;
	focusOnNodes: (viewport: { width: number; height: number }) => void;
	alignNodes: (type: 'horizontal' | 'vertical' | 'grid') => void;
	attachToColumn: (nodeIds: string[]) => void;
	layoutColumn: (columnId: string, providedNodes?: NodeData[]) => NodeData[];
	theme: 'light' | 'dark';
	setTheme: (theme: 'light' | 'dark') => void;
	toggleTheme: () => void;
	fontSans: string;
	fontMono: string;
	setFontSans: (id: string) => void;
	setFontMono: (id: string) => void;
	dotGridEnabled: boolean;
	dotGridPitch: number;
	setDotGridEnabled: (v: boolean) => void;
	setDotGridPitch: (v: number) => void;
	activeTool: 'select' | 'draw';
	setActiveTool: (tool: 'select' | 'draw') => void;
	penColor: string;
	setPenColor: (color: string) => void;
	penThickness: number;
	setPenThickness: (thickness: number) => void;
	clearDrawings: () => void;
	undoStack: HistoryState[];
	redoStack: HistoryState[];
	pushHistory: () => void;
	undo: () => void;
	redo: () => void;
	activeDropTargetId: string | null;
	setDropTarget: (id: string | null) => void;
}

export const useStore = create<AppState>()((set) => ({
	nodes: [],
	connections: [],
	view: { x: 0, y: 0, zoom: 1 },
	activeNodeId: null,
	selectedNodeIds: [],
	theme: (() => {
		const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
		if (saved) return saved;
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	})(),
	setTheme: (theme) => {
		localStorage.setItem('theme', theme);
		document.documentElement.setAttribute('data-theme', theme);
		set({ theme });
	},
	toggleTheme: () => {
		set((state) => {
			const next = state.theme === 'dark' ? 'light' : 'dark';
			localStorage.setItem('theme', next);
			document.documentElement.setAttribute('data-theme', next);
			return { theme: next };
		});
	},
	fontSans: localStorage.getItem('fontSans') ?? 'system',
	fontMono: localStorage.getItem('fontMono') ?? 'system-mono',
	setFontSans: (id) => {
		const opt = SANS_FONTS.find(f => f.id === id) ?? SANS_FONTS[0];
		localStorage.setItem('fontSans', opt.id);
		document.documentElement.style.setProperty('--font-node-sans', opt.stack);
		set({ fontSans: opt.id });
	},
	dotGridEnabled: localStorage.getItem('dotGridEnabled') !== 'false',
	dotGridPitch: Number(localStorage.getItem('dotGridPitch') ?? 80),
	setDotGridEnabled: (v) => {
		localStorage.setItem('dotGridEnabled', String(v));
		set({ dotGridEnabled: v });
	},
	setDotGridPitch: (v) => {
		localStorage.setItem('dotGridPitch', String(v));
		set({ dotGridPitch: v });
	},
	setFontMono: (id) => {
		const opt = MONO_FONTS.find(f => f.id === id) ?? MONO_FONTS[0];
		localStorage.setItem('fontMono', opt.id);
		document.documentElement.style.setProperty('--font-node-mono', opt.stack);
		set({ fontMono: opt.id });
	},
	activeTool: 'select',
	setActiveTool: (tool) => set({ activeTool: tool }),
	penColor: 'var(--color-text-primary)',
	setPenColor: (color) => set({ penColor: color }),
	penThickness: 2,
	setPenThickness: (thickness) => set({ penThickness: thickness }),
	clearDrawings: () => set((state) => ({
		undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
		redoStack: [],
		nodes: state.nodes.filter(n => n.type !== 'draw'),
		selectedNodeIds: state.selectedNodeIds.filter(id => {
			const node = state.nodes.find(n => n.id === id);
			return node?.type !== 'draw';
		})
	})),
	undoStack: [],
	redoStack: [],
	activeDropTargetId: null,
	setDropTarget: (id) => set({ activeDropTargetId: id }),

	pushHistory: () => set((state) => {
		const last = state.undoStack[state.undoStack.length - 1];
		if (last && last.nodes === state.nodes && last.connections === state.connections) return {};
		return {
			undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50), // Limit history to 50 steps
			redoStack: []
		};
	}),
	undo: () => set((state) => {
		if (state.undoStack.length === 0) return {};
		const prev = state.undoStack[state.undoStack.length - 1];
		const nextUndoStack = state.undoStack.slice(0, -1);
		return {
			nodes: prev.nodes,
			connections: prev.connections,
			undoStack: nextUndoStack,
			redoStack: [{ nodes: state.nodes, connections: state.connections }, ...state.redoStack].slice(0, 50),
			activeNodeId: null,
			selectedNodeIds: []
		};
	}),
	redo: () => set((state) => {
		if (state.redoStack.length === 0) return {};
		const next = state.redoStack[0];
		const nextRedoStack = state.redoStack.slice(1);
		return {
			nodes: next.nodes,
			connections: next.connections,
			undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
			redoStack: nextRedoStack,
			activeNodeId: null,
			selectedNodeIds: []
		};
	}),
	setNodes: (nodes) => set({ nodes }),

	addNode: (node) => set((state) => ({
		undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
		redoStack: [],
		nodes: [...state.nodes, node]
	})),
	updateNode: (id, data) =>
		set((state) => {
			const targetNode = state.nodes.find((n) => n.id === id);
			if (!targetNode) return {};

			// Calculate delta if position changes
			let dx = 0;
			let dy = 0;
			if (typeof data.x === 'number' && typeof data.y === 'number') {
				dx = data.x - targetNode.x;
				dy = data.y - targetNode.y;
			}

			// If moving a backdrop, check for children updates
			if (targetNode.type === 'backdrop' && (dx !== 0 || dy !== 0)) {
				return {
					nodes: state.nodes.map((n) => {
						if (n.id === id) {
							return { ...n, ...data };
						}

						// Visual containment check using PREVIOUS position of targetNode
						const isChild = n.parentId === id;
						const isInside = targetNode.layoutMode !== 'column' ? (
							n.x >= targetNode.x &&
							n.x + n.width <= targetNode.x + targetNode.width &&
							n.y >= targetNode.y &&
							n.y + n.height <= targetNode.y + targetNode.height
						) : false; // Columns ONLY move explicitly attached children (parentId)

						if (isChild || isInside) {
							return { ...n, x: n.x + dx, y: n.y + dy };
						}
						return n;
					})
				};
			}

			// Normal update for non-backdrop or non-movement
			const nextNodes = state.nodes.map((node) => (node.id === id ? { ...node, ...data } : node));

			// If the updated node is a child of a column and its dimensions/content changed, recalculate layout
			if (
				targetNode.parentId &&
				(data.width !== undefined || data.height !== undefined || data.content !== undefined) &&
				(data.width !== targetNode.width || data.height !== targetNode.height || data.content !== targetNode.content)
			) {
				const parent = nextNodes.find(n => n.id === targetNode.parentId);
				if (parent && parent.type === 'backdrop' && parent.layoutMode === 'column') {
					return { nodes: state.layoutColumn(targetNode.parentId, nextNodes) };
				}
			}

			// If the updated node IS a column and its width changed, recalculate its children layout so they match
			if (targetNode.type === 'backdrop' && targetNode.layoutMode === 'column' && data.width !== undefined && data.width !== targetNode.width) {
				return { nodes: state.layoutColumn(targetNode.id, nextNodes) };
			}

			return { nodes: nextNodes };
		}),
	removeNode: (id) =>
		set((state) => {
			const nodeToRemove = state.nodes.find(n => n.id === id);
			const parentId = nodeToRemove?.parentId;
			let nextNodes = state.nodes.filter((node) => node.id !== id);

			const parentNode = nextNodes.find(n => n.id === parentId);
			if (parentNode && parentNode.type === 'backdrop' && parentNode.layoutMode === 'column' && parentId !== undefined) {
				// Pure calculation, doesn't rely on `get` which is unavailable inside `set`
				nextNodes = state.layoutColumn(parentId, nextNodes);
			}

			return {
				undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
				redoStack: [],
				nodes: nextNodes,
				connections: state.connections.filter(
					(c) => c.fromNodeId !== id && c.toNodeId !== id
				),
				activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
			};
		}),
	addConnection: (connection) => set((state) => ({
		undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
		redoStack: [],
		connections: [...state.connections, connection]
	})),
	removeConnection: (id) => set((state) => ({
		undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
		redoStack: [],
		connections: state.connections.filter((c) => c.id !== id)
	})),
	setView: (view) => set({ view }),
	setActiveNodeId: (id) => set({ activeNodeId: id }),
	panView: (dx, dy) =>
		set((state) => ({
			view: { ...state.view, x: state.view.x + dx, y: state.view.y + dy },
		})),
	zoomView: (delta, center, sensitivity = ZOOM_SENSITIVITY) =>
		set((state) => {
			const newZoom = Math.min(Math.max(state.view.zoom - delta * sensitivity, ZOOM_MIN), ZOOM_MAX);

			const newView = { ...state.view, zoom: newZoom };

			if (center) {
				// Calculate world point under cursor using OLD zoom
				// View transform: screen = world * zoom + offset
				// world = (screen - offset) / zoom
				const worldX = (center.x - state.view.x) / state.view.zoom;
				const worldY = (center.y - state.view.y) / state.view.zoom;

				// Calculate new offset to keep world point under cursor
				// newOffset = screen - world * newZoom
				newView.x = center.x - worldX * newZoom;
				newView.y = center.y - worldY * newZoom;
			}

			return { view: newView };
		}),
	focusOnNodes: (viewport) =>
		set((state) => {
			if (state.selectedNodeIds.length === 0) return {};

			const selectedSet = new Set(state.selectedNodeIds);
			const nodesToFocus = state.nodes.filter(n => selectedSet.has(n.id));
			if (nodesToFocus.length === 0) return {};

			// Calculate bounds in a single pass (avoids 4 separate array iterations)
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const n of nodesToFocus) {
				if (n.x < minX) minX = n.x;
				if (n.y < minY) minY = n.y;
				if (n.x + n.width > maxX) maxX = n.x + n.width;
				if (n.y + n.height > maxY) maxY = n.y + n.height;
			}

			const contentWidth = maxX - minX;
			const contentHeight = maxY - minY;

			const padding = FOCUS_PADDING;
			const targetWidth = contentWidth + padding * 2;
			const targetHeight = contentHeight + padding * 2;

			// Calculate scale to fit
			const scaleX = viewport.width / targetWidth;
			const scaleY = viewport.height / targetHeight;
			const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), ZOOM_MIN), FOCUS_ZOOM_MAX);

			// Center view
			// Center of content in world coords
			const centerX = minX + contentWidth / 2;
			const centerY = minY + contentHeight / 2;

			// Screen center
			const screenCenterX = viewport.width / 2;
			const screenCenterY = viewport.height / 2;

			// New offset: screen = world * zoom + offset => offset = screen - world * zoom
			const newX = screenCenterX - centerX * newZoom;
			const newY = screenCenterY - centerY * newZoom;

			return {
				view: { x: newX, y: newY, zoom: newZoom }
			};
		}),
	selectNode: (id, multi) =>
		set((state) => {
			if (multi) {
				const alreadySelected = state.selectedNodeIds.includes(id);
				return {
					selectedNodeIds: alreadySelected
						? state.selectedNodeIds.filter((nid) => nid !== id)
						: [...state.selectedNodeIds, id],
				};
			} else {
				return { selectedNodeIds: [id] };
			}
		}),
	setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
	clearSelection: () => set({ selectedNodeIds: [] }),
	removeSelectedNodes: () =>
		set((state) => {
			const selectedIds = state.selectedNodeIds;
			if (selectedIds.length === 0) return {};

			// Build parent->children index in O(n), then BFS to collect all descendants in O(n)
			const childrenOf = new Map<string, string[]>();
			for (const node of state.nodes) {
				if (node.parentId) {
					const arr = childrenOf.get(node.parentId);
					if (arr) arr.push(node.id);
					else childrenOf.set(node.parentId, [node.id]);
				}
			}

			const idsToRemove = new Set<string>(selectedIds);
			const queue = [...selectedIds];
			while (queue.length > 0) {
				const parentId = queue.pop()!;
				for (const childId of (childrenOf.get(parentId) ?? [])) {
					if (!idsToRemove.has(childId)) {
						idsToRemove.add(childId);
						queue.push(childId);
					}
				}
			}

			return {
				undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
				redoStack: [],
				nodes: state.nodes.filter((node) => !idsToRemove.has(node.id)),
				connections: state.connections.filter(
					(c) => !idsToRemove.has(c.fromNodeId) && !idsToRemove.has(c.toNodeId)
				),
				selectedNodeIds: [],
				activeNodeId: (state.activeNodeId && idsToRemove.has(state.activeNodeId)) ? null : state.activeNodeId,
			};
		}),
	moveNodes: (ids, dx, dy) =>
		set((state) => {
			if (ids.length === 0) return {};
			const movingNodes = new Set<string>();

			// Build indexes once — O(n) total instead of O(n) per addChildren call
			const nodeById = new Map(state.nodes.map(n => [n.id, n]));
			const childrenOf = new Map<string, string[]>();
			for (const n of state.nodes) {
				if (n.parentId) {
					const arr = childrenOf.get(n.parentId);
					if (arr) arr.push(n.id);
					else childrenOf.set(n.parentId, [n.id]);
				}
			}

			// BFS to collect explicit children and visually contained nodes
			for (const id of ids) movingNodes.add(id);
			const queue = [...ids];

			while (queue.length > 0) {
				const parentId = queue.pop()!;
				const parentNode = nodeById.get(parentId);

				// Explicit parentId children
				for (const childId of (childrenOf.get(parentId) ?? [])) {
					if (!movingNodes.has(childId)) {
						movingNodes.add(childId);
						queue.push(childId);
					}
				}

				// Implicit visual containment for backdrops (freeform only)
				if (parentNode?.type === 'backdrop' && parentNode.layoutMode !== 'column') {
					for (const n of state.nodes) {
						if (movingNodes.has(n.id)) continue;
						const isInside =
							n.x >= parentNode.x &&
							n.x + n.width <= parentNode.x + parentNode.width &&
							n.y >= parentNode.y &&
							n.y + n.height <= parentNode.y + parentNode.height;
						if (isInside) {
							movingNodes.add(n.id);
							queue.push(n.id);
						}
					}
				}
				// Note: Columns explicitly use parentId so `childrenOf` already catches them.
			}

			return {
				nodes: state.nodes.map((node) => {
					if (movingNodes.has(node.id)) {
						return { ...node, x: node.x + dx, y: node.y + dy };
					}
					return node;
				}),
			};
		}),
	updateConnection: (id, data) =>
		set((state) => ({
			connections: state.connections.map((c) => (c.id === id ? { ...c, ...data } : c)),
		})),
	attachToColumn: (nodeIds) => {
		set((state) => {
			let nodesChanged = false;
			let nextNodes = [...state.nodes];
			const columnsToLayout = new Set<string>();

			for (const nodeId of nodeIds) {
				const targetNode = nextNodes.find(n => n.id === nodeId);
				if (!targetNode || targetNode.type === 'backdrop') continue;

				// Find if node intersects with any column backdrop
				const centerX = targetNode.x + targetNode.width / 2;
				const centerY = targetNode.y + targetNode.height / 2;

				const overlappingColumn = [...nextNodes].reverse().find(n =>
					n.type === 'backdrop' && n.layoutMode === 'column' &&
					centerX >= n.x && centerX <= n.x + n.width &&
					centerY >= n.y && centerY <= n.y + n.height
				);

				const oldParentId = targetNode.parentId;
				const newParentId = overlappingColumn?.id;

				if (oldParentId !== newParentId) {
					nodesChanged = true;
					const updatedNode = { ...targetNode, parentId: newParentId };
					nextNodes = nextNodes.map(n => n.id === nodeId ? updatedNode : n);

					if (oldParentId) {
						const oldParent = nextNodes.find(n => n.id === oldParentId);
						if (oldParent?.type === 'backdrop' && oldParent.layoutMode === 'column') columnsToLayout.add(oldParentId);
					}
					if (newParentId) {
						columnsToLayout.add(newParentId);
					}
				} else if (newParentId) {
					// Even if parentId didn't change, we moved the node inside the same column.
					// We must lay it out again to snap it back to a valid slot or reorder it.
					nodesChanged = true;
					columnsToLayout.add(newParentId);
				}
			}

			if (nodesChanged) {
				const colIds = Array.from(columnsToLayout);
				for (const colId of colIds) {
					nextNodes = state.layoutColumn(colId, nextNodes);
				}
				return { nodes: nextNodes };
			}
			return {};
		});
	},
	layoutColumn: (columnId: string, providedNodes?: NodeData[]): NodeData[] => {
		// Can be called normally or pass providedNodes to use during `set` cycles
		const nodes: NodeData[] = providedNodes || useStore.getState().nodes;
		const column = nodes.find((n: NodeData) => n.id === columnId);
		if (!column || column.type !== 'backdrop' || column.layoutMode !== 'column') return nodes;

		const PADDING_X = 20;
		const PADDING_Y = 20;
		const HEADER_HEIGHT = 60; // Space for column title
		const GAP = 20; // vertical gap between children

		const children = nodes.filter((n: NodeData) => n.parentId === columnId);
		if (children.length === 0) {
			const minHeight = Math.max(200, HEADER_HEIGHT + PADDING_Y); // Minimum height logic
			if (column.height !== minHeight) {
				return nodes.map((n: NodeData) => n.id === columnId ? { ...n, height: minHeight } : n);
			}
			return nodes;
		}

		// Sort by vertical position (y)
		children.sort((a: NodeData, b: NodeData) => a.y - b.y);

		let currentY = column.y + HEADER_HEIGHT + PADDING_Y;
		const innerWidth = Math.max(50, column.width - PADDING_X * 2);

		const childUpdates = new Map<string, Partial<NodeData>>();

		// 1. Calculate new Y positions
		children.forEach((child: NodeData) => {
			// Center children horizontally within the column
			const newX = column.x + PADDING_X;
			let newWidth = child.width;
			let newHeight = child.height;

			if (child.type === 'image' || child.type === 'video') {
				// Keep aspect ratio
				const aspectRatio = child.width / child.height;
				newWidth = innerWidth;
				newHeight = innerWidth / aspectRatio;
			} else {
				// Text, markdown etc just stretch width
				newWidth = innerWidth;
			}

			if (Math.abs(child.x - newX) > 1 || Math.abs(child.y - currentY) > 1 || Math.abs(child.width - newWidth) > 1) {
				childUpdates.set(child.id, { x: newX, y: currentY, width: newWidth, height: newHeight });
			}
			currentY += newHeight + GAP;
		});

		// 2. Compute column's new required height
		const requiredHeight = (currentY - column.y) - GAP + PADDING_Y;

		const colUpdates: Partial<NodeData> = {};
		if (Math.abs(column.height - requiredHeight) > 1) {
			colUpdates.height = requiredHeight;
		}

		if (childUpdates.size === 0 && Object.keys(colUpdates).length === 0) {
			return nodes;
		}

		return nodes.map((n: NodeData) => {
			if (n.id === columnId) return { ...n, ...colUpdates };
			if (childUpdates.has(n.id)) return { ...n, ...childUpdates.get(n.id) };
			return n;
		});
	},
	alignNodes: (type) =>
		set((state) => {
			const { selectedNodeIds, nodes } = state;
			if (selectedNodeIds.length < 2) return {};

			const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
			const updates = calculateAlignment(selectedNodes, type);

			if (updates.length === 0) return {};

			const updateMap = new Map(updates.map(u => [u.id, u.data]));

			return {
				undoStack: [...state.undoStack, { nodes: state.nodes, connections: state.connections }].slice(-50),
				redoStack: [],
				nodes: nodes.map(n => {
					if (updateMap.has(n.id)) {
						return { ...n, ...updateMap.get(n.id) };
					}
					return n;
				})
			};
		}),
}));
