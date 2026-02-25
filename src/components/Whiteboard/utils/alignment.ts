import type { NodeData } from '../../../store/useStore';
import { normalizeSize } from './mediaUtils';
import { ALIGNMENT_SEARCH_STEPS } from '../../../constants';

// Axis-aligned bounding box dimensions for a rotated rectangle
const getAABB = (node: NodeData): { w: number; h: number } => {
	const rot = (node.rotation ?? 0) * (Math.PI / 180);
	const cosA = Math.abs(Math.cos(rot));
	const sinA = Math.abs(Math.sin(rot));
	return {
		w: node.width * cosA + node.height * sinA,
		h: node.height * cosA + node.width * sinA,
	};
};

// Skyline Bottom-Left bin packing.
// Returns placed rect positions, or null if any rect doesn't fit.
interface Rect { w: number; h: number }
interface Placed { idx: number; x: number; y: number; w: number; h: number }

function skylinePack(rects: Rect[], binWidth: number): Placed[] | null {
	interface Seg { x: number; y: number; w: number }
	let skyline: Seg[] = [{ x: 0, y: 0, w: binWidth }];
	const placed: Placed[] = [];

	// Process largest-area rects first
	const order = rects.map((_, i) => i).sort((a, b) => rects[b].w * rects[b].h - rects[a].w * rects[a].h);

	for (const idx of order) {
		const { w, h } = rects[idx];
		let bestY = Infinity, bestX = 0, bestSeg = -1;

		for (let si = 0; si < skyline.length; si++) {
			const x = skyline[si].x;
			if (x + w > binWidth) continue;

			// Max skyline height across the span [x, x+w)
			let maxY = 0, cx = x;
			for (let sj = si; sj < skyline.length && cx < x + w; sj++) {
				maxY = Math.max(maxY, skyline[sj].y);
				cx += skyline[sj].w;
			}
			if (maxY < bestY || (maxY === bestY && x < bestX)) {
				bestY = maxY; bestX = x; bestSeg = si;
			}
		}

		if (bestSeg === -1) return null; // doesn't fit

		placed.push({ idx, x: bestX, y: bestY, w, h });

		// Update skyline: replace segments under placed rect with new raised segment
		const rectEnd = bestX + w;
		const newSkyline: Seg[] = [];
		for (const seg of skyline) {
			const segEnd = seg.x + seg.w;
			if (segEnd <= bestX || seg.x >= rectEnd) {
				newSkyline.push(seg);
			} else {
				if (seg.x < bestX) newSkyline.push({ x: seg.x, y: seg.y, w: bestX - seg.x });
				if (segEnd > rectEnd) newSkyline.push({ x: rectEnd, y: seg.y, w: segEnd - rectEnd });
			}
		}
		newSkyline.push({ x: bestX, y: bestY + h, w });
		newSkyline.sort((a, b) => a.x - b.x);
		skyline = newSkyline;
	}

	return placed;
}

// Find the bin width that produces the most square overall bounding box.
// Searches from maxNodeWidth to totalWidth in 60 steps.
function findBestBinWidth(aabbs: Rect[]): number {
	const maxW = Math.max(...aabbs.map(a => a.w));
	const totalW = aabbs.reduce((s, a) => s + a.w, 0);
	const n = aabbs.length;
	const steps = ALIGNMENT_SEARCH_STEPS;

	let bestBW = totalW;
	let bestDiff = Infinity;

	for (let i = 0; i <= steps; i++) {
		const bw = maxW + (totalW - maxW) * i / steps;
		const result = skylinePack(aabbs, bw);
		if (!result || result.length < n) continue;

		const bboxW = Math.max(...result.map(p => p.x + p.w));
		const bboxH = Math.max(...result.map(p => p.y + p.h));
		// Minimise |log(aspect ratio)| → 0 when perfectly square
		const diff = Math.abs(Math.log(bboxW / bboxH));
		if (diff < bestDiff) { bestDiff = diff; bestBW = bw; }
	}

	return bestBW;
}

export const alignNodes = (nodes: NodeData[], type: 'grid' | 'horizontal' | 'vertical') => {
	if (nodes.length === 0) return [];

	const sortedNodes = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
	const updates: { id: string; data: Partial<NodeData> }[] = [];

	if (type === 'horizontal') {
		const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
		const horizontallySorted = [...nodes].sort((a, b) => a.x - b.x);
		let currentX = horizontallySorted[0].x;

		horizontallySorted.forEach((node) => {
			const { w } = getAABB(node);
			const offsetX = (w - node.width) / 2;
			updates.push({ id: node.id, data: { y: avgY, x: currentX + offsetX } });
			currentX += w;
		});

	} else if (type === 'vertical') {
		const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
		let currentY = sortedNodes[0].y;

		sortedNodes.forEach((node) => {
			const { h } = getAABB(node);
			const offsetY = (h - node.height) / 2;
			updates.push({ id: node.id, data: { x: avgX, y: currentY + offsetY } });
			currentY += h;
		});

	} else if (type === 'grid') {
		const startX = sortedNodes[0].x;
		const startY = sortedNodes[0].y;

		const aabbs = sortedNodes.map(n => getAABB(n));
		const binWidth = findBestBinWidth(aabbs);
		const placed = skylinePack(aabbs, binWidth);

		if (placed) {
			placed.forEach(({ idx, x, y, w, h }) => {
				const node = sortedNodes[idx];
				updates.push({
					id: node.id,
					data: {
						// Offset so AABB top-left = (startX+x, startY+y),
						// then center the node rect within its AABB
						x: startX + x + (w - node.width) / 2,
						y: startY + y + (h - node.height) / 2,
					}
				});
			});
		}
	}

	return updates;
};

export const normalizeSizes = (nodes: NodeData[]) => {
	return nodes.map(node => {
		const { width, height } = normalizeSize(node.width, node.height);
		return {
			id: node.id,
			data: { width, height }
		};
	});
};
