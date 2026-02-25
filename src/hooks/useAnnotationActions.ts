import { useCallback } from 'react';
import { useStore, type Comment } from '../store/useStore';
import { useAnnotationHistory } from './useAnnotationHistory';

interface UseAnnotationActionsOptions {
	/** When set, all frame arguments are ignored and this frame is used instead (e.g. images always use 0). */
	fixedFrame?: number;
}

export function useAnnotationActions(nodeId: string, options: UseAnnotationActionsOptions = {}) {
	const { fixedFrame } = options;
	const updateNode = useStore((state) => state.updateNode);
	const { pushState } = useAnnotationHistory(nodeId);

	const handleUpdateAnnotation = useCallback((frame: number, dataUrl: string) => {
		const node = useStore.getState().nodes.find(n => n.id === nodeId);
		if (!node) return;
		pushState(node.annotations || {});
		const resolvedFrame = fixedFrame ?? frame;
		const newAnnotations = { ...(node.annotations || {}), [resolvedFrame]: dataUrl };
		updateNode(nodeId, { annotations: newAnnotations });
	}, [nodeId, fixedFrame, pushState, updateNode]);

	const handleClearAnnotation = useCallback((currentFrame: number) => {
		const node = useStore.getState().nodes.find(n => n.id === nodeId);
		if (!node) return;
		pushState(node.annotations || {});
		const newAnnotations = { ...(node.annotations || {}) };
		delete newAnnotations[fixedFrame ?? currentFrame];
		updateNode(nodeId, { annotations: newAnnotations });
	}, [nodeId, fixedFrame, pushState, updateNode]);

	const handleClearAllAnnotations = useCallback(() => {
		const node = useStore.getState().nodes.find(n => n.id === nodeId);
		if (!node) return;
		pushState(node.annotations || {});
		updateNode(nodeId, { annotations: {} });
	}, [nodeId, pushState, updateNode]);

	const handleAddComment = useCallback((text: string, frame: number) => {
		const node = useStore.getState().nodes.find(n => n.id === nodeId);
		if (!node) return;
		const newComment: Comment = {
			id: crypto.randomUUID(),
			text,
			frame: fixedFrame ?? frame,
			timestamp: Date.now(),
		};
		const newComments = [...(node.comments || []), newComment];
		updateNode(nodeId, { comments: newComments });
	}, [nodeId, fixedFrame, updateNode]);

	return { handleUpdateAnnotation, handleClearAnnotation, handleClearAllAnnotations, handleAddComment };
}
