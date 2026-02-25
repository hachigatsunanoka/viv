import type { NodeData } from '../../../store/useStore';
import { SNAP_THRESHOLD_WORLD } from '../../../constants';

export const findClosestNode = (
	worldX: number,
	worldY: number,
	nodes: NodeData[],
	connectingNodeId: string | null
): { nodeId: string; x: number; y: number } | null => {
	let closestDistance = Infinity;
	let closestNode: { nodeId: string; x: number; y: number } | null = null;

	const snapThreshold = SNAP_THRESHOLD_WORLD;

	nodes.forEach(node => {
		if (connectingNodeId && node.id === connectingNodeId) return; // Don't snap to self

		const cx = node.x + node.width / 2;
		const cy = node.y + node.height / 2;
		const dist = Math.sqrt(Math.pow(worldX - cx, 2) + Math.pow(worldY - cy, 2));

		if (dist < closestDistance && dist < snapThreshold) {
			closestDistance = dist;
			closestNode = { nodeId: node.id, x: cx, y: cy };
		}
	});

	return closestNode;
};
