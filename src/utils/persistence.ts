// Removed @tauri-apps/plugin-dialog as dialogs are now handled securely by Rust
import { readFile, writeFile, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store/useStore';
import type { NodeData } from '../store/useStore';
import { getMimeType } from './fileUtils';

interface MediaEntry {
	id: string;
	sourcePath: string;
}

interface LoadedMedia {
	id: string;
	tempPath: string;
}

interface LoadBoardResult {
	json: string;
	media: LoadedMedia[];
}

// We now poll the backend for current file path whenever needed,
// but for some local quick checks we can still rely on backend state.
export const getCurrentFilePath = async (): Promise<string | null> => {
	try {
		const path = await invoke<string | null>('get_current_file_path');
		return path;
	} catch {
		return null;
	}
};

/**
 * Get file extension from a MIME type
 */
const extFromMime = (mime: string): string => {
	const map: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/gif': 'gif',
		'image/webp': 'webp',
		'image/svg+xml': 'svg',
		'video/mp4': 'mp4',
		'video/webm': 'webm',
		'video/quicktime': 'mov',
	};
	return map[mime] || 'bin';
};

/**
 * Save media blob URL to a temporary file, returning the file path
 */
const saveBlobToTemp = async (blobUrl: string, mediaId: string): Promise<string> => {
	const response = await fetch(blobUrl);
	const arrayBuffer = await response.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	const contentType = response.headers.get('content-type') || 'application/octet-stream';
	const ext = extFromMime(contentType);

	const dataDir = await appDataDir();
	const tempDir = await join(dataDir, 'temp_save');
	try {
		await mkdir(tempDir, { recursive: true });
	} catch {
		// directory may already exist
	}

	const fileName = `${mediaId}.${ext}`;
	const filePath = await join(tempDir, fileName);
	await writeFile(filePath, data);

	return filePath;
};

const buildArchiveData = async (state: ReturnType<typeof useStore.getState>) => {
	const processedNodes: NodeData[] = state.nodes.map(node => {
		if ((node.type === 'image' || node.type === 'video') && !node.mediaId) {
			return { ...node, mediaId: crypto.randomUUID() };
		}
		return node;
	});

	const mediaEntries: MediaEntry[] = [];
	const archiveNodes: NodeData[] = [];

	for (const node of processedNodes) {
		if ((node.type === 'image' || node.type === 'video') && node.mediaId) {
			try {
				let sourcePath: string;
				if (node.originalPath && !node.content.startsWith('blob:')) {
					sourcePath = node.originalPath;
				} else {
					sourcePath = await saveBlobToTemp(node.content, node.mediaId);
				}
				mediaEntries.push({ id: node.mediaId, sourcePath });
				const ext = sourcePath.split('.').pop() || 'bin';
				archiveNodes.push({
					...node,
					content: `media/${node.mediaId}.${ext}`,
					originalPath: undefined,
				});
			} catch (err) {
				console.error('Failed to process media node:', node.id, err);
				archiveNodes.push({ ...node, originalPath: undefined });
			}
		} else {
			archiveNodes.push(node);
		}
	}

	const dataToSave = {
		nodes: archiveNodes,
		connections: state.connections,
		view: state.view,
		version: '2.0.0'
	};

	return { processedNodes, mediaEntries, dataToSave };
};

/** Writes the archive via Rust command and commits state. Returns true on success. */
const writeBoardArchive = async (
	command: 'save_board_archive' | 'save_current_board',
	dataToSave: object,
	mediaEntries: MediaEntry[],
	processedNodes: NodeData[],
): Promise<boolean> => {
	try {
		await invoke(command, {
			boardJson: JSON.stringify(dataToSave, null, 2),
			media: mediaEntries,
		});
		useStore.setState({ nodes: processedNodes });
		console.log(`Board saved successfully via ${command}`);
		return true;
	} catch (error) {
		console.error(`Error saving board via ${command}:`, error);
		return false;
	}
};

/** Returns true if saved, false if cancelled or failed */
export const saveBoard = async (): Promise<boolean> => {
	const state = useStore.getState();
	const { processedNodes, mediaEntries, dataToSave } = await buildArchiveData(state);

	// Call save_current_board. If it hasn't been saved yet, Rust will pop a dialog.
	return await writeBoardArchive('save_current_board', dataToSave, mediaEntries, processedNodes);
};

export const saveBoardAs = async (): Promise<boolean> => {
	const state = useStore.getState();
	const { processedNodes, mediaEntries, dataToSave } = await buildArchiveData(state);

	// Call save_board_archive to explicitly force 'save as' dialog in Rust
	return await writeBoardArchive('save_board_archive', dataToSave, mediaEntries, processedNodes);
};

export const loadBoard = async () => {
	try {
		// Dialog is handled cleanly by Rust now
		const result = await invoke<LoadBoardResult>('load_board_archive');

		const data = JSON.parse(result.json);

		if (!data.nodes || !data.connections || !data.view) {
			console.error('Invalid board file format');
			return;
		}

		// Build media ID → temp path map
		const mediaMap = new Map<string, string>();
		for (const m of result.media) {
			mediaMap.set(m.id, m.tempPath);
		}

		// Convert media references back to blob URLs
		const restoredNodes: NodeData[] = await Promise.all(
			data.nodes.map(async (node: NodeData) => {
				if ((node.type === 'image' || node.type === 'video') && node.mediaId) {
					const tempPath = mediaMap.get(node.mediaId);
					if (tempPath) {
						try {
							const contents = await readFile(tempPath);
							const mimeType = getMimeType(tempPath);
							const blob = new Blob([contents], { type: mimeType });
							const blobUrl = URL.createObjectURL(blob);
							return {
								...node,
								content: blobUrl,
								originalPath: tempPath,
							};
						} catch (err) {
							console.error('Failed to load media:', node.mediaId, err);
						}
					}
				}
				return node;
			})
		);

		useStore.setState({
			nodes: restoredNodes,
			connections: data.connections,
			view: data.view
		});
		console.log('Board loaded successfully');
	} catch (error) {
		console.error('Failed to load board:', error);
	}
};
