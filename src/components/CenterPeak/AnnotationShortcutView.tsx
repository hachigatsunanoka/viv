import React from 'react';
import './AnnotationShortcutView.css';

interface AnnotationShortcutViewProps {
	onClose: () => void;
	isImage?: boolean;
}

export const AnnotationShortcutView: React.FC<AnnotationShortcutViewProps> = ({ onClose, isImage = false }) => {
	const mouseOps = [
		{ key: 'Wheel', description: 'Zoom in / out' },
		{ key: 'Middle Drag', description: 'Pan view' },
		{ key: 'Right Drag', description: 'Zoom in / out' },
		{ key: 'Left Drag', description: 'Draw with active tool' },
	];

	const videoShortcuts = [
		{ key: 'Space / K', description: 'Play / Pause' },
		{ key: '← →', description: 'Step one frame' },
		{ key: 'Shift + ← →', description: 'Jump to annotated frame' },
		{ key: 'I', description: 'Set in-point (A-B loop)' },
		{ key: 'O', description: 'Set out-point (A-B loop)' },
		{ key: 'R', description: 'Reset in / out points' },
		{ key: 'B', description: 'Brush tool' },
		{ key: 'G', description: 'Grunge brush tool' },
		{ key: 'E', description: 'Eraser tool' },
		{ key: 'H', description: 'Reset view' },
		{ key: 'F', description: 'Toggle fullscreen' },
		{ key: 'M', description: 'Flip horizontally' },
		{ key: 'V', description: 'Hide / show annotations' },
		{ key: 'Ctrl + Z', description: 'Undo' },
		{ key: 'Ctrl + Shift + Z', description: 'Redo' },
		{ key: '?', description: 'Toggle this cheat sheet' },
	];

	const imageShortcuts = [
		{ key: 'B', description: 'Brush tool' },
		{ key: 'G', description: 'Grunge brush tool' },
		{ key: 'E', description: 'Eraser tool' },
		{ key: 'H', description: 'Reset view' },
		{ key: 'F', description: 'Toggle fullscreen' },
		{ key: 'M', description: 'Flip horizontally' },
		{ key: 'V', description: 'Hide / show annotations' },
		{ key: 'Ctrl + Z', description: 'Undo' },
		{ key: 'Ctrl + Shift + Z', description: 'Redo' },
		{ key: '?', description: 'Toggle this cheat sheet' },
	];

	const keyboardShortcuts = isImage ? imageShortcuts : videoShortcuts;

	return (
		<div className="ann-shortcut-overlay" onClick={onClose}>
			<div className="ann-shortcut-modal" onClick={(e) => e.stopPropagation()}>
				<h2>Controls</h2>
				<div className="ann-shortcut-columns">
					<div className="ann-shortcut-column">
						<div className="ann-shortcut-column-title">Mouse</div>
						<div className="ann-shortcut-list">
							{mouseOps.map((s) => (
								<div key={s.key} className="ann-shortcut-item">
									<span className="ann-shortcut-key">{s.key}</span>
									<span className="ann-shortcut-desc">{s.description}</span>
								</div>
							))}
						</div>
					</div>
					<div className="ann-shortcut-column">
						<div className="ann-shortcut-column-title">Keyboard</div>
						<div className="ann-shortcut-list">
							{keyboardShortcuts.map((s) => (
								<div key={s.key} className="ann-shortcut-item">
									<span className="ann-shortcut-key">{s.key}</span>
									<span className="ann-shortcut-desc">{s.description}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
