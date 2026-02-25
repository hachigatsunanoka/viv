import { NORMALIZE_TARGET_SIZE } from '../../../constants';

export const getDimensions = (url: string, type: 'image' | 'video'): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
        if (type === 'image') {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 300, height: 200 }); // Fallback
            img.src = url;
        } else {
            const video = document.createElement('video');
            video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
            video.onerror = () => resolve({ width: 300, height: 200 }); // Fallback
            video.src = url;
        }
    });
};

export const normalizeSize = (width: number, height: number): { width: number; height: number } => {
    const TARGET_SIZE = NORMALIZE_TARGET_SIZE;
    let newWidth = width;
    let newHeight = height;

    if (width >= height) {
        // Landscape or Square - fix width to TARGET_SIZE
        newWidth = TARGET_SIZE;
        newHeight = (height / width) * TARGET_SIZE;
    } else {
        // Portrait - fix height to TARGET_SIZE
        newHeight = TARGET_SIZE;
        newWidth = (width / height) * TARGET_SIZE;
    }

    return { width: newWidth, height: newHeight };
};

export const isValidImageUrl = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
};

export const isValidVideoUrl = (url: string): boolean => {
    return /\.(mp4|webm|mov)$/i.test(url);
};

export const isSupportedVideoUrl = (url: string): boolean => {
    return /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/|vimeo\.com\/|instagram\.com\/(reel|p)\/|twitter\.com\/|x\.com\/|tiktok\.com\/)/i.test(url);
};

/**
 * Compute display dimensions for a media element inside a container,
 * preserving aspect ratio. Used by VideoPlayer and ImageViewer.
 */
export const computeDisplaySize = (
    container: { width: number; height: number },
    media: { width: number; height: number }
): { width: number; height: number } => {
    if (!container.width || !container.height || !media.width || !media.height) {
        return { width: container.width, height: container.height };
    }
    const containerAspect = container.width / container.height;
    const mediaAspect = media.width / media.height;
    if (containerAspect > mediaAspect) {
        return { width: container.height * mediaAspect, height: container.height };
    } else {
        return { width: container.width, height: container.width / mediaAspect };
    }
};

