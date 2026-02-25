
import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { readFile } from '@tauri-apps/plugin-fs';
import { getMimeType } from '../../../utils/fileUtils';
import type { NodeData } from '../../../store/useStore';
import { getDimensions, normalizeSize } from '../utils/mediaUtils';

interface DragDropPayload {
	paths: string[];
	position: { x: number; y: number };
}

export const useTauriDragDrop = (
	view: { x: number; y: number; zoom: number },
	addNode: (node: NodeData) => void,
	containerRef: React.RefObject<HTMLDivElement | null>
) => {
	const [isFileOver, setIsFileOver] = useState(false);
	const viewRef = useRef(view);

	useEffect(() => {
		viewRef.current = view;
	}, [view]);

	useEffect(() => {
		let unlistenDrop: (() => void) | undefined;
		let unlistenEnter: (() => void) | undefined;
		let unlistenLeave: (() => void) | undefined;
		let isActive = true;

		const setupListeners = async () => {
			const dropUnlisten = await listen<DragDropPayload>('tauri://drag-drop', async (event) => {
				const { paths, position } = event.payload;
				const currentView = viewRef.current;
				const container = containerRef.current;

				// Reset file over state immediately
				if (isActive) setIsFileOver(false);

				let offsetX = 0;
				let offsetY = 0;

				if (container) {
					const rect = container.getBoundingClientRect();
					offsetX = rect.left;
					offsetY = rect.top;
				}

				// Calculate world position
				// Mouse position is relative to window (client area).
				// Container might be offset.
				// We subtract container offset from window position to get position relative to container.
				// NOTE: Tauri drag-drop position is in PHYSICAL pixels, but rect/view are in LOGICAL pixels.
				// We must scale the position by devicePixelRatio.
				const scaleFactor = window.devicePixelRatio || 1;
				const logicalX = position.x / scaleFactor;
				const logicalY = position.y / scaleFactor;

				const containerX = logicalX - offsetX;
				const containerY = logicalY - offsetY;

				const worldX = (containerX - currentView.x) / currentView.zoom;
				const worldY = (containerY - currentView.y) / currentView.zoom;

				const validFiles: { url: string; width: number; height: number; type: 'image' | 'video'; originalPath?: string }[] = [];

				for (const path of paths) {
					const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(path);
					const isVideo = /\.(mp4|webm|mov)$/i.test(path);

					if (isImage) {
						try {
							const contents = await readFile(path);
							const mimeType = getMimeType(path);
							const blob = new Blob([contents], { type: mimeType });
							const url = URL.createObjectURL(blob);

							const dimensions = await getDimensions(url, 'image');
							const { width, height } = normalizeSize(dimensions.width, dimensions.height);
							validFiles.push({ url, width, height, type: 'image' });
						} catch (err) {
							console.error('Error reading image:', path, err);
						}
					} else if (isVideo) {
						try {
							// Read as ALL-INTRA or similar optimized format in future?
							// For now, load as Blob to avoid "unsupported URL" with asset protocol
							const contents = await readFile(path);
							const mimeType = getMimeType(path) || 'video/mp4';
							const blob = new Blob([contents], { type: mimeType });
							const url = URL.createObjectURL(blob);

							const dimensions = await getDimensions(url, 'video');
							const { width, height } = normalizeSize(dimensions.width, dimensions.height);
							validFiles.push({
								url,
								width,
								height,
								type: 'video',
								originalPath: path // Store original path
							});
						} catch (err) {
							console.error('Error reading video:', path, err);
						}
					}
				}

				if (isActive && validFiles.length > 0) {
					const count = validFiles.length;
					const cols = Math.ceil(Math.sqrt(count));
					const PADDING = 20;

					validFiles.forEach((file, index) => {
						const col = index % cols;
						const row = Math.floor(index / cols);

						// Simple tiling: offset based on index and standard size (assuming approx same size or just spacing out)
						// For better tiling, we'd accumulate widths/heights, but a grid is fine for now.
						const offsetGridX = col * (500 + PADDING);
						const offsetGridY = row * (500 + PADDING);

						addNode({
							id: crypto.randomUUID(),
							x: worldX + offsetGridX - (file.width / 2),
							y: worldY + offsetGridY - (file.height / 2),
							width: file.width,
							height: file.height,
							content: file.url,
							type: file.type,
							originalPath: file.originalPath,
						});
					});
				}
			});

			const enterUnlisten = await listen('tauri://drag-enter', () => {
				if (isActive) setIsFileOver(true);
			});

			const leaveUnlisten = await listen('tauri://drag-leave', () => {
				if (isActive) setIsFileOver(false);
			});

			if (isActive) {
				unlistenDrop = dropUnlisten;
				unlistenEnter = enterUnlisten;
				unlistenLeave = leaveUnlisten;
			} else {
				dropUnlisten();
				enterUnlisten();
				leaveUnlisten();
			}
		};

		setupListeners();

		return () => {
			isActive = false;
			if (unlistenDrop) unlistenDrop();
			if (unlistenEnter) unlistenEnter();
			if (unlistenLeave) unlistenLeave();
		};
	}, [addNode, containerRef]); // viewRef is used in refs

	return isFileOver;
};
