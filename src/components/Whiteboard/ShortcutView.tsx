import React from 'react';
import './ShortcutView.css';

interface ShortcutViewProps {
	onClose: () => void;
}

export const ShortcutView: React.FC<ShortcutViewProps> = ({ onClose }) => {
	const mouseOps = [
		{ key: 'Middle Drag', description: 'Pan the board' },
		{ key: 'Space + Drag', description: 'Pan the board' },
		{ key: 'Alt + Middle Drag', description: 'Move window' },
		{ key: 'Right Drag', description: 'Zoom in / out' },
		{ key: 'Wheel', description: 'Zoom in / out' },
		{ key: 'Drag Background', description: 'Select multiple nodes' },
		{ key: 'Double Click Node', description: 'Focus / edit text' },
	];

	const keyboardShortcuts = [
		{ key: 'Delete / Backspace', description: 'Delete selected nodes' },
		{ key: 'F', description: 'Focus on selected nodes' },
		{ key: 'Enter', description: 'Open selected video / image' },
		{ key: 'B', description: 'Create backdrop around selection' },
		{ key: 'Alt + H', description: 'Align nodes horizontally' },
		{ key: 'Alt + V', description: 'Align nodes vertically' },
		{ key: 'Alt + G', description: 'Arrange nodes in grid' },
		{ key: 'Ctrl + S', description: 'Save board' },
		{ key: 'Ctrl + Shift + S', description: 'Save board as…' },
		{ key: 'Ctrl + O', description: 'Load board' },
		{ key: 'Ctrl + T', description: 'Always on top' },
		{ key: 'Ctrl + Q', description: 'Close application' },
		{ key: '?', description: 'Toggle this cheat sheet' },
	];

	return (
		<div className="shortcut-overlay" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
			<div className="shortcut-modal" onClick={(e) => e.stopPropagation()}>
				<h2>Controls</h2>
				<div className="shortcut-columns">
					<div className="shortcut-column">
						<div className="shortcut-column-title">Mouse</div>
						<div className="shortcut-list">
							{mouseOps.map((s) => (
								<div key={s.key} className="shortcut-item">
									<span className="shortcut-key">{s.key}</span>
									<span className="shortcut-desc">{s.description}</span>
								</div>
							))}
						</div>
					</div>
					<div className="shortcut-column">
						<div className="shortcut-column-title">Keyboard</div>
						<div className="shortcut-list">
							{keyboardShortcuts.map((s) => (
								<div key={s.key} className="shortcut-item">
									<span className="shortcut-key">{s.key}</span>
									<span className="shortcut-desc">{s.description}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
