import { useStore } from '../store/useStore';
import type { NodeData } from '../store/useStore';

interface ExportContext {
    nodeId: string;
    node: NodeData;
    addNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const finalizeExport = (
    canvas: HTMLCanvasElement,
    options: { addToWhiteboard: boolean },
    context: ExportContext,
    frameNameSuffix: string | number = ''
) => {
    const { node, addNotification } = context;
    const dataUrl = canvas.toDataURL('image/png');

    if (options.addToWhiteboard) {
        const newNodeId = crypto.randomUUID();
        const newNode = {
            id: newNodeId,
            x: (node?.x || 0) + (node?.width || 0) + 20,
            y: node?.y || 0,
            width: node?.width || 400,
            height: node?.height || 300,
            content: dataUrl,
            type: 'image' as const,
        };

        useStore.getState().addNode(newNode);
        addNotification('Added to Whiteboard', 'success');
    } else {
        // Download
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `export_frame_${frameNameSuffix}_${Date.now()}.png`;
        a.click();
        addNotification('Image Saved', 'success');
    }
};

export const applyColorCorrection = (
    ctx: CanvasRenderingContext2D,
    filters: { saturation: number; contrast: number; brightness: number }
) => {
    ctx.filter = `saturate(${filters.saturation}) contrast(${filters.contrast}) brightness(${filters.brightness})`;
};

export const drawAnnotation = async (
    ctx: CanvasRenderingContext2D,
    annotationUrl: string,
    width: number,
    height: number
): Promise<void> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = annotationUrl;
    });
};
