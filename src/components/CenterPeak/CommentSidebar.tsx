import React, { useState, useEffect, useRef } from 'react';
import './CommentSidebar.css';
import type { Comment } from '../../store/useStore';
import { formatTimestamp } from '../../utils/formatting';

interface CommentSidebarProps {
	comments: Comment[];
	currentFrame: number;
	onAddComment: (text: string, frame: number) => void;
	onSeek: (frame: number) => void;
	isImage?: boolean; // Optional prop, default false
}

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
	comments,
	currentFrame,
	onAddComment,
	onSeek,
	isImage = false
}) => {
	const [inputText, setInputText] = useState('');
	const [tagFrame, setTagFrame] = useState(true);
	const commentsBottomRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom on new comment
	useEffect(() => {
		if (commentsBottomRef.current) {
			commentsBottomRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [comments.length]);

	const handleSubmit = () => {
		if (!inputText.trim()) return;
		const frame = tagFrame ? currentFrame : -1;
		onAddComment(inputText, frame);
		setInputText('');
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	// Sort by timestamp
	const sortedComments = [...comments].sort((a, b) => a.timestamp - b.timestamp);

	return (
		<div className="comment-sidebar">
			<div className="sidebar-header">
				<h3>Comments</h3>
			</div>

			<div className="comments-list">
				{sortedComments.length === 0 ? (
					<div className="empty-state" style={{ padding: 16, color: '#888', textAlign: 'center' }}>
						No comments yet
					</div>
				) : (
					sortedComments.map((comment) => (
						<div
							key={comment.id}
							className="comment-item"
						>
							<div className="comment-content">
								<div className="comment-meta">
									<span className="comment-time">
										{formatTimestamp(comment.timestamp)}
									</span>
								</div>
								{!isImage && comment.frame >= 0 && (
									<div
										className="comment-frame"
										onClick={() => onSeek(comment.frame)}
										title={`Jump to frame ${comment.frame}`}
									>
										Frame {comment.frame}
									</div>
								)}
								<div className="comment-text">{comment.text}</div>
							</div>
						</div>
					))
				)}
				<div ref={commentsBottomRef} />
			</div>

			<div className="comment-input-area">
				{!isImage && (
					<div className="input-options">
						<label>
							<input
								type="checkbox"
								checked={tagFrame}
								onChange={(e) => setTagFrame(e.target.checked)}
							/>
							Frame {currentFrame}
						</label>
					</div>
				)}
				<textarea
					className="comment-textarea"
					placeholder="Add a comment..."
					value={inputText}
					onChange={(e) => setInputText(e.target.value)}
					onKeyDown={handleKeyDown}
				/>
				<button
					className="submit-btn"
					onClick={handleSubmit}
					disabled={!inputText.trim()}
				>
					Submit
				</button>
			</div>
		</div>
	);
};
