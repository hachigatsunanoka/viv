import React from 'react';
import { exit } from '@tauri-apps/plugin-process';
import { saveBoard } from '../../utils/persistence';
import './ConfirmQuitDialog.css';

interface ConfirmQuitDialogProps {
	onCancel: () => void;
}

export const ConfirmQuitDialog: React.FC<ConfirmQuitDialogProps> = ({ onCancel }) => {
	const handleSaveAndClose = async () => {
		const saved = await saveBoard();
		if (saved) exit(0);
	};

	const handleCloseWithoutSaving = () => {
		exit(0);
	};

	return (
		<div
			className="confirm-quit-overlay"
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
		>
			<div className="confirm-quit-dialog">
				<div className="dialog-header">
					<h3>Close Application</h3>
				</div>
				<div className="confirm-quit-body">
					<p>Do you want to save before closing?</p>
				</div>
				<div className="dialog-footer">
					<button className="save-button" onClick={handleSaveAndClose}>Save & Close</button>
					<button className="cancel-button" onClick={handleCloseWithoutSaving}>Close Without Saving</button>
					<button className="cancel-button" onClick={onCancel}>Cancel</button>
				</div>
			</div>
		</div>
	);
};
