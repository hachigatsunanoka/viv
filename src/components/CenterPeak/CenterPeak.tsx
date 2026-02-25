import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/shallow';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import './CenterPeak.css';

export const CenterPeak: React.FC = () => {
	const { activeNodeId, setActiveNodeId, activeNode } = useStore(
		useShallow((state) => ({
			activeNodeId: state.activeNodeId,
			setActiveNodeId: state.setActiveNodeId,
			activeNode: state.nodes.find((n) => n.id === state.activeNodeId),
		}))
	);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	// Sync isFullscreen state with actual browser fullscreen changes (e.g. Esc key)
	useEffect(() => {
		const onFsChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener('fullscreenchange', onFsChange);
		return () => document.removeEventListener('fullscreenchange', onFsChange);
	}, []);

	if (!activeNodeId || !activeNode) return null;

	const handleClose = () => {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		}
		setActiveNodeId(null);
		setIsFullscreen(false);
	};

	const handleToggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			await contentRef.current?.requestFullscreen();
		} else {
			await document.exitFullscreen();
		}
	};

	return (
		<div
			className="center-peak-overlay"
			onClick={handleClose}
		>
			<div
				ref={contentRef}
				className="center-peak-content"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="node-detail">
					{activeNode.type === 'image' ? (
						<ImageViewer
							src={activeNode.content}
							nodeId={activeNode.id}
							isFullscreen={isFullscreen}
							onToggleFullscreen={handleToggleFullscreen}
						/>
					) : activeNode.type === 'video' ? (
						<VideoPlayer
							src={activeNode.content}
							nodeId={activeNode.id}
							isFullscreen={isFullscreen}
							onToggleFullscreen={handleToggleFullscreen}
						/>
					) : (
						<p>{activeNode.content}</p>
					)}
				</div>
			</div>
		</div>
	);
};
