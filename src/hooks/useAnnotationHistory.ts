import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';

export function useAnnotationHistory(nodeId: string) {
    const [undoStack, setUndoStack] = useState<Record<number, string>[]>([]);
    const [redoStack, setRedoStack] = useState<Record<number, string>[]>([]);

    const updateNode = useStore((state) => state.updateNode);
    const node = useStore((state) => state.nodes.find(n => n.id === nodeId));

    const pushState = useCallback((currentAnnotations: Record<number, string>) => {
        setUndoStack(prev => [...prev, currentAnnotations]);
        setRedoStack([]);
    }, []);

    const undo = useCallback(() => {
        if (undoStack.length === 0 || !node) return;

        const newUndo = [...undoStack];
        const prevAnnotations = newUndo.pop()!;

        setRedoStack(prev => [...prev, node.annotations || {}]);
        setUndoStack(newUndo);

        updateNode(nodeId, { annotations: prevAnnotations });
    }, [undoStack, node, nodeId, updateNode]);

    const redo = useCallback(() => {
        if (redoStack.length === 0 || !node) return;

        const newRedo = [...redoStack];
        const nextAnnotations = newRedo.pop()!;

        setUndoStack(prev => [...prev, node.annotations || {}]);
        setRedoStack(newRedo);

        updateNode(nodeId, { annotations: nextAnnotations });
    }, [redoStack, node, nodeId, updateNode]);

    return { pushState, undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
