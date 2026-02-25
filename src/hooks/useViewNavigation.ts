import { useState, useRef } from 'react';

export interface ViewNavigationState {
    zoom: number;
    pan: { x: number; y: number };
    isFlipped: boolean;
    isPanning: boolean;
}

export interface ViewNavigationHandlers {
    handleWheel: (e: React.WheelEvent) => void;
    handleMouseDown: (e: React.MouseEvent) => void;
    handleMouseMove: (e: React.MouseEvent) => void;
    handleMouseUp: () => void;
    handleResetView: () => void;
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;
    setIsFlipped: (flipped: boolean) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export const useViewNavigation = (): ViewNavigationState & ViewNavigationHandlers => {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isFlipped, setIsFlipped] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const isRightDragging = useRef(false);
    const rightDragMoved = useRef(false);
    const rightDragOrigin = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement | null>(null);
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });

    const setZoomWithRef = (z: number) => { zoomRef.current = z; setZoom(z); };
    const setPanWithRef = (p: { x: number; y: number }) => { panRef.current = p; setPan(p); };

    // Zoom centered on a client-space point
    const applyZoomAtPoint = (scaleAmount: number, clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const prevZoom = zoomRef.current;
        const nextZoom = Math.max(0.05, Math.min(20, prevZoom + scaleAmount));
        if (nextZoom === prevZoom) return;

        if (rect) {
            // Mouse position relative to container center
            const cx = clientX - rect.left - rect.width / 2;
            const cy = clientY - rect.top - rect.height / 2;
            // Adjust pan so the point under cursor stays fixed
            const scale = nextZoom / prevZoom;
            const newPan = {
                x: cx - (cx - panRef.current.x) * scale,
                y: cy - (cy - panRef.current.y) * scale,
            };
            setPanWithRef(newPan);
        }
        setZoomWithRef(nextZoom);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        applyZoomAtPoint(-e.deltaY * 0.005, e.clientX, e.clientY);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (e.button === 2) {
            e.preventDefault();
            isRightDragging.current = true;
            rightDragMoved.current = false;
            rightDragOrigin.current = { x: e.clientX, y: e.clientY };
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            setPanWithRef({ x: panRef.current.x + deltaX, y: panRef.current.y + deltaY });
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        } else if (isRightDragging.current) {
            const deltaX = e.clientX - lastMousePos.current.x;
            const deltaY = e.clientY - lastMousePos.current.y;
            const delta = deltaX - deltaY;
            if (Math.abs(delta) > 0) {
                rightDragMoved.current = true;
                // Drag up/right = zoom in, drag down/left = zoom out; center fixed at drag start
                applyZoomAtPoint(delta * 0.01, rightDragOrigin.current.x, rightDragOrigin.current.y);
            }
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        isRightDragging.current = false;
    };

    const handleResetView = () => {
        setZoomWithRef(1);
        setPanWithRef({ x: 0, y: 0 });
        setIsFlipped(false);
    };

    return {
        zoom,
        pan,
        isFlipped,
        isPanning,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleResetView,
        setZoom: setZoomWithRef,
        setPan: setPanWithRef,
        setIsFlipped,
        containerRef,
    };
};
