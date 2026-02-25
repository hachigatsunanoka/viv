import { useEffect, useRef } from 'react';
import type { NodeData } from '../../../store/useStore';
import { getDimensions, normalizeSize, isValidImageUrl, isValidVideoUrl, isSupportedVideoUrl } from '../utils/mediaUtils';

export const useBrowserInteractions = (
    view: { x: number; y: number; zoom: number },
    addNode: (node: NodeData) => void,
    containerRef: React.RefObject<HTMLDivElement | null>,
    setSelectedNodes: (ids: string[]) => void,
    onDownloadUrl?: (url: string, x: number, y: number) => void
) => {
    const viewRef = useRef(view);

    useEffect(() => {
        viewRef.current = view;
    }, [view]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const processUrl = async (url: string, x: number, y: number) => {
            // Supported video platform check (YouTube, Vimeo, Instagram, Twitter, TikTok)
            if (isSupportedVideoUrl(url)) {
                onDownloadUrl?.(url, x, y);
                return;
            }

            let type: 'image' | 'video' | null = null;

            // Simple check for data URI images
            if (url.startsWith('data:image/')) {
                type = 'image';
            } else if (isValidImageUrl(url)) {
                type = 'image';
            } else if (isValidVideoUrl(url)) {
                type = 'video';
            }

            if (type) {
                const dimensions = await getDimensions(url, type);
                const { width, height } = normalizeSize(dimensions.width, dimensions.height);

                const newNodeId = crypto.randomUUID();
                const newNode: NodeData = {
                    id: newNodeId,
                    type,
                    x,
                    y,
                    width,
                    height,
                    content: url,
                };

                addNode(newNode);
                setSelectedNodes([newNodeId]);
            }
        };

        const handlePaste = async (e: ClipboardEvent) => {
            const activeElement = document.activeElement;
            const isEditable = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                (activeElement as HTMLElement).isContentEditable
            );

            if (isEditable) {
                return;
            }

            const items = e.clipboardData?.items;
            if (!items) return;

            const rect = container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const worldX = (centerX - viewRef.current.x) / viewRef.current.zoom;
            const worldY = (centerY - viewRef.current.y) / viewRef.current.zoom;

            // Priority 1: image blob from clipboard (screenshot, copy-image, etc.)
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (!file) continue;

                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    });

                    const dimensions = await getDimensions(dataUrl, 'image');
                    const { width, height } = normalizeSize(dimensions.width, dimensions.height);

                    const newNodeId = crypto.randomUUID();
                    addNode({ id: newNodeId, type: 'image', x: worldX - width / 2, y: worldY - height / 2, width, height, content: dataUrl });
                    setSelectedNodes([newNodeId]);
                    return;
                }
            }

            // Priority 2: text URL
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'string' && items[i].type === 'text/plain') {
                    items[i].getAsString((s) => {
                        if (isValidImageUrl(s) || isValidVideoUrl(s) || isSupportedVideoUrl(s)) {
                            processUrl(s, worldX - 250, worldY - 250);
                        }
                    });
                }
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const { clientX, clientY } = e;
            const rect = container.getBoundingClientRect();

            const worldX = (clientX - rect.left - viewRef.current.x) / viewRef.current.zoom;
            const worldY = (clientY - rect.top - viewRef.current.y) / viewRef.current.zoom;

            // Priority 1: file blobs (e.g. dragging image from browser image viewer / file manager via web DnD)
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file.type.startsWith('image/')) {
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                        });
                        const dimensions = await getDimensions(dataUrl, 'image');
                        const { width, height } = normalizeSize(dimensions.width, dimensions.height);
                        const newNodeId = crypto.randomUUID();
                        addNode({ id: newNodeId, type: 'image', x: worldX - width / 2, y: worldY - height / 2, width, height, content: dataUrl });
                        setSelectedNodes([newNodeId]);
                        return;
                    }
                    if (file.type.startsWith('video/')) {
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                        });
                        const dimensions = await getDimensions(dataUrl, 'video');
                        const { width, height } = normalizeSize(dimensions.width, dimensions.height);
                        const newNodeId = crypto.randomUUID();
                        addNode({ id: newNodeId, type: 'video', x: worldX - width / 2, y: worldY - height / 2, width, height, content: dataUrl });
                        setSelectedNodes([newNodeId]);
                        return;
                    }
                }
            }

            // Priority 2: URL from text/uri-list or text/html img src
            let url: string | undefined;

            const uriList = e.dataTransfer?.getData('text/uri-list');
            if (uriList) {
                const lines = uriList.split(/[\r\n]+/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
                url = lines[0];
            }

            if (!url) {
                const html = e.dataTransfer?.getData('text/html');
                if (html) {
                    const m = html.match(/src="([^"]+)"/);
                    if (m) url = m[1];
                }
            }

            if (!url) {
                url = e.dataTransfer?.getData('text/plain') || undefined;
            }

            if (!url) return;

            // Known media/video URL patterns
            if (isValidImageUrl(url) || isValidVideoUrl(url) || isSupportedVideoUrl(url)) {
                await processUrl(url, worldX - 250, worldY - 250);
                return;
            }

            // Unknown URL: probe Content-Type via HEAD request
            if (url.startsWith('http')) {
                try {
                    const res = await fetch(url, { method: 'HEAD' });
                    const ct = res.headers.get('content-type') || '';
                    if (ct.startsWith('image/')) {
                        await processUrl(url, worldX - 250, worldY - 250);
                    } else if (ct.startsWith('video/')) {
                        await processUrl(url, worldX - 250, worldY - 250);
                    }
                } catch {
                    // CORS or network error — try as image anyway
                    await processUrl(url, worldX - 250, worldY - 250);
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('paste', handlePaste);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
        };
    }, [addNode, containerRef, setSelectedNodes, onDownloadUrl]);
};

