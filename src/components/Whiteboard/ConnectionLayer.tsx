import React from 'react';
import { useStore } from '../../store/useStore';
import type { ConnectionData } from '../../store/useStore';
import { Trash2, Minus } from 'lucide-react';
import './ContextMenu.css';

interface ConnectionLayerProps {
	tempConnection?: {
		fromNodeId: string;
		toPoint: { x: number; y: number };
	};
	selectedConnectionIds: string[];
	onSelectConnection: (id: string | null, multi: boolean) => void;
	onUpdateConnection: (id: string, data: Partial<ConnectionData>) => void;
	onDeleteConnection: () => void;
	onContextMenu: (e: React.MouseEvent, connectionId: string) => void;
	zoom: number;
}

export const ConnectionLayer: React.FC<ConnectionLayerProps> = ({
	tempConnection,
	selectedConnectionIds,
	onSelectConnection,
	onUpdateConnection,
	onDeleteConnection,
	zoom,
}) => {
	const nodes = useStore((state) => state.nodes);
	const connections = useStore((state) => state.connections);

	const nodeMap = React.useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
	const connectionMap = React.useMemo(() => new Map(connections.map(c => [c.id, c])), [connections]);
	const selectedConnectionSet = React.useMemo(() => new Set(selectedConnectionIds), [selectedConnectionIds]);

	const getCenter = React.useCallback((nodeId: string) => {
		const node = nodeMap.get(nodeId);
		if (!node) return null;
		return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
	}, [nodeMap]);

	// For toolbar: use the last selected connection as reference
	const lastSelectedConn = selectedConnectionIds.length > 0
		? (connectionMap.get(selectedConnectionIds[selectedConnectionIds.length - 1]) ?? null)
		: null;

	// Toolbar position: centroid of all selected connections' midpoints
	const toolbarPos = React.useMemo(() => {
		if (selectedConnectionIds.length === 0) return null;
		let sumX = 0, sumY = 0, count = 0;
		for (const id of selectedConnectionIds) {
			const conn = connectionMap.get(id);
			if (!conn) continue;
			const s = getCenter(conn.fromNodeId);
			const e = getCenter(conn.toNodeId);
			if (!s || !e) continue;
			sumX += (s.x + e.x) / 2;
			sumY += (s.y + e.y) / 2;
			count++;
		}
		if (count === 0) return null;
		return { x: sumX / count, y: sumY / count };
	}, [selectedConnectionIds, connectionMap, getCenter]);

	return (
		<>
			<svg
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					pointerEvents: 'none',
					overflow: 'visible',
					zIndex: 0,
				}}
			>
				<defs>
					<marker id="arrowhead-end" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#999" />
					</marker>
					<marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
						<polygon points="10 0, 0 3.5, 10 7" fill="#999" />
					</marker>
					<marker id="arrowhead-end-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#646cff" />
					</marker>
					<marker id="arrowhead-start-selected" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
						<polygon points="10 0, 0 3.5, 10 7" fill="#646cff" />
					</marker>
				</defs>
				{connections.map((conn) => {
					const start = getCenter(conn.fromNodeId);
					const end = getCenter(conn.toNodeId);
					if (!start || !end) return null;

					const isSelected = selectedConnectionSet.has(conn.id);

					return (
						<React.Fragment key={conn.id}>
							{/* Hit area */}
							<line
								x1={start.x}
								y1={start.y}
								x2={end.x}
								y2={end.y}
								stroke="transparent"
								strokeWidth="20"
								style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
								onClick={(e) => {
									e.stopPropagation();
									onSelectConnection(conn.id, e.shiftKey || e.ctrlKey || e.metaKey);
								}}
							/>
							{/* Selection glow */}
							{isSelected && (
								<line
									x1={start.x}
									y1={start.y}
									x2={end.x}
									y2={end.y}
									stroke="#646cff"
									strokeWidth={(conn.strokeWidth || 2) + 4}
									strokeOpacity={0.3}
									style={{ pointerEvents: 'none' }}
								/>
							)}
							{/* Visible line */}
							<line
								x1={start.x}
								y1={start.y}
								x2={end.x}
								y2={end.y}
								stroke={isSelected ? '#646cff' : (conn.color || "#999")}
								strokeWidth={conn.strokeWidth || 2}
								strokeDasharray={conn.strokeStyle === 'dashed' ? '8,5' : conn.strokeStyle === 'dotted' ? '2,4' : undefined}
								markerEnd={conn.arrowEnd ? `url(#arrowhead-end${isSelected ? '-selected' : ''})` : undefined}
								markerStart={conn.arrowStart ? `url(#arrowhead-start${isSelected ? '-selected' : ''})` : undefined}
								style={{ pointerEvents: 'none' }}
							/>
						</React.Fragment>
					);
				})}
				{tempConnection && (() => {
					const start = getCenter(tempConnection.fromNodeId);
					if (!start) return null;
					return (
						<line
							x1={start.x}
							y1={start.y}
							x2={tempConnection.toPoint.x}
							y2={tempConnection.toPoint.y}
							stroke="#646cff"
							strokeWidth="2"
							strokeDasharray="5,5"
						/>
					);
				})()}
			</svg>

			{/* Floating toolbar for selected connections */}
			{lastSelectedConn && toolbarPos && (
				<div
					style={{
						position: 'absolute',
						left: toolbarPos.x,
						top: toolbarPos.y,
						transform: `translate(-50%, calc(-100% - 10px)) scale(${1 / zoom})`,
						transformOrigin: 'bottom center',
						zIndex: 500,
						pointerEvents: 'auto',
					}}
					onMouseDown={(e) => e.stopPropagation()}
					onClick={(e) => e.stopPropagation()}
				>
					<ConnectionToolbar
						connection={lastSelectedConn}
						onUpdate={(data) => onUpdateConnection(lastSelectedConn.id, data)}
						onDelete={onDeleteConnection}
					/>
				</div>
			)}
		</>
	);
};

interface ConnectionToolbarProps {
	connection: ConnectionData;
	onUpdate: (data: Partial<ConnectionData>) => void;
	onDelete: () => void;
}

const COLORS = [
	{ value: '#999', label: 'Gray' },
	{ value: '#1a1a1a', label: 'Black' },
	{ value: '#ef4444', label: 'Red' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#22c55e', label: 'Green' },
	{ value: '#f59e0b', label: 'Yellow' },
];

const ConnectionToolbar: React.FC<ConnectionToolbarProps> = ({ connection, onUpdate, onDelete }) => {
	return (
		<div className="conn-toolbar">
			{/* Stroke width */}
			<button
				className={`conn-tb-btn ${(connection.strokeWidth || 2) === 2 ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeWidth: 2 })}
				title="Thin"
			>
				<Minus size={14} strokeWidth={1.5} />
			</button>
			<button
				className={`conn-tb-btn ${connection.strokeWidth === 4 ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeWidth: 4 })}
				title="Medium"
			>
				<Minus size={14} strokeWidth={3} />
			</button>
			<button
				className={`conn-tb-btn ${connection.strokeWidth === 6 ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeWidth: 6 })}
				title="Thick"
			>
				<Minus size={14} strokeWidth={5} />
			</button>

			<div className="conn-tb-sep" />

			{/* Stroke style */}
			<button
				className={`conn-tb-btn ${(!connection.strokeStyle || connection.strokeStyle === 'solid') ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeStyle: 'solid' })}
				title="Solid"
			>
				<svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" /></svg>
			</button>
			<button
				className={`conn-tb-btn ${connection.strokeStyle === 'dashed' ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeStyle: 'dashed' })}
				title="Dashed"
			>
				<svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="5,3" /></svg>
			</button>
			<button
				className={`conn-tb-btn ${connection.strokeStyle === 'dotted' ? 'active' : ''}`}
				onClick={() => onUpdate({ strokeStyle: 'dotted' })}
				title="Dotted"
			>
				<svg width="18" height="2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray="2,3" /></svg>
			</button>

			<div className="conn-tb-sep" />

			{/* Colors */}
			{COLORS.map(c => (
				<button
					key={c.value}
					className={`conn-tb-btn ${(connection.color || '#999') === c.value ? 'active' : ''}`}
					onClick={() => onUpdate({ color: c.value })}
					title={c.label}
				>
					<div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: c.value, border: '1px solid rgba(0,0,0,0.2)' }} />
				</button>
			))}

			<div className="conn-tb-sep" />

			{/* Delete */}
			<button
				className="conn-tb-btn conn-tb-delete"
				onClick={onDelete}
				title="Delete"
			>
				<Trash2 size={14} />
			</button>
		</div>
	);
};
