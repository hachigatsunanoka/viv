import React, { useMemo } from 'react';
import type { NodeData } from '../../store/useStore';
import { useStore } from '../../store/useStore';
import { useShallow } from 'zustand/shallow';
import { TEXT_SIZE_FONT_MAP } from '../../constants';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { githubGist, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

const BackdropContent: React.FC<{ node: NodeData }> = ({ node }) => {
	const { updateNode, zoom, theme, activeDropTargetId } = useStore(
		useShallow((state) => ({
			updateNode: state.updateNode,
			zoom: state.view.zoom,
			theme: state.theme,
			activeDropTargetId: state.activeDropTargetId,
		}))
	);
	const scale = 1 / zoom;

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		updateNode(node.id, { content: e.target.value });
	};

	if (node.layoutMode === 'column') {
		const isHovered = activeDropTargetId === node.id;
		return (
			<div style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				backgroundColor: theme === 'dark' ? 'rgba(30, 30, 30, 0.6)' : 'rgba(240, 240, 240, 0.6)',
				borderRadius: '12px',
				border: isHovered
					? `2px solid ${theme === 'dark' ? '#646cff' : '#4444ff'}`
					: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
				boxShadow: isHovered
					? `0 0 15px ${theme === 'dark' ? 'rgba(100, 108, 255, 0.4)' : 'rgba(68, 68, 255, 0.4)'}`
					: '0 4px 12px rgba(0,0,0,0.05)',
				backdropFilter: 'blur(8px)',
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column',
				transition: 'border 0.2s ease, box-shadow 0.2s ease',
				// We inherit the specific color tint but mix it with the blur implicitly if color is provided?
				// Actually, if node.color is provided, mix it in:
				...(node.color ? { backgroundColor: node.color } : {})
			}}>
				<div style={{
					padding: '12px 20px',
					borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
					backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
				}}>
					<input
						type="text"
						value={node.content}
						onChange={handleTitleChange}
						placeholder="Column Title"
						style={{
							width: '100%',
							backgroundColor: 'transparent',
							color: theme === 'dark' ? '#ffffff' : '#000000',
							fontSize: '16px',
							fontFamily: 'var(--font-ui)',
							fontWeight: '600',
							border: 'none',
							outline: 'none',
							pointerEvents: 'auto',
						}}
						onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
						onMouseDown={(e) => e.stopPropagation()}
						onDoubleClick={(e) => e.stopPropagation()}
					/>
				</div>
			</div>
		);
	}

	return (
		<div style={{
			width: '100%',
			height: '100%',
			position: 'relative',
			backgroundColor: node.color || 'rgba(200, 200, 200, 0.2)',
			borderRadius: '8px',
		}}>
			<input
				type="text"
				value={node.content}
				onChange={handleTitleChange}
				placeholder="Backdrop Title"
				style={{
					position: 'absolute',
					top: -24 * scale,
					left: 0,
					padding: `${4 * scale}px ${8 * scale}px`,
					backgroundColor: node.color || 'rgba(200, 200, 200)',
					color: theme === 'dark' ? '#ffffff' : '#000000',
					borderRadius: `${16 * scale}px`,
					fontSize: `${14 * scale}px`,
					fontFamily: 'var(--font-ui)',
					fontWeight: 'bold',
					border: 'none',
					outline: 'none',
					minWidth: `${50 * scale}px`,
					maxWidth: '100%',
					pointerEvents: 'auto',
					transformOrigin: 'bottom left',
					boxShadow: `0 ${2 * scale}px ${4 * scale}px rgba(0,0,0,0.2)`
				}}
				onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
				onMouseDown={(e) => e.stopPropagation()}
				onDoubleClick={(e) => e.stopPropagation()}
			/>
		</div>
	);
};

interface NodeContentProps {
	node: NodeData;
	isEditing: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	textRef: React.RefObject<HTMLDivElement | null>;
	onInput: () => void;
	onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}


export const NodeContent: React.FC<NodeContentProps> = ({
	node,
	isEditing,
	textareaRef,
	textRef,
	onInput,
	onBlur,
	onKeyDown
}) => {
	const theme = useStore((state) => state.theme);

	const markdownComponents = useMemo<Components>(() => ({
		code({ className, children, ...props }) {
			const match = /language-(\w+)/.exec(className || '');
			const isInline = !match;
			if (isInline) {
				return (
					<code
						{...props}
						style={{
							backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f0f0f0',
							color: theme === 'dark' ? '#e6e6e6' : '#333',
							padding: '2px 5px',
							borderRadius: '4px',
							fontSize: '0.9em',
							fontFamily: "var(--font-node-mono)",
						}}
					>
						{children}
					</code>
				);
			}
			return (
				<SyntaxHighlighter
					style={theme === 'dark' ? atomOneDark : githubGist}
					language={match[1]}
					PreTag="div"
					customStyle={{
						margin: '8px 0',
						borderRadius: '6px',
						fontSize: '13px',
					}}
				>
					{String(children).replace(/\n$/, '')}
				</SyntaxHighlighter>
			);
		},
	}), [theme]);

	if (node.status === 'downloading') {
		const T = 1.6; // seconds per full cycle
		return (
			<div className="download-placeholder">
				<div className="dot-grid-loader">
					{[0, 1, 2].map(row => (
						[0, 1, 2].map(col => (
							<div
								key={`${row}-${col}`}
								className="dot-grid-dot"
								style={{ animationDelay: `${-((row + col) / 8) * T}s` }}
							/>
						))
					))}
				</div>
			</div>
		);
	}
	if (node.status === 'error') {
		return (
			<div className="download-placeholder error">
				<span className="download-label">Download Failed</span>
			</div>
		);
	}

	switch (node.type) {
		case 'image':
			return (
				<img
					src={node.content}
					alt="node"
					draggable={false}
				/>
			);
		case 'video':
			return (
				<video
					src={node.content}
					muted
					playsInline
					style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
				/>
			);
		case 'backdrop':
			return <BackdropContent node={node} />;
		case 'text': {
			const fontSize = node.fontSize || TEXT_SIZE_FONT_MAP[node.textSize || 'medium'];
			const fontColor = node.fontColor || (theme === 'dark' ? '#ffffff' : '#1a1a1a');
			const fontWeight = node.fontWeight || 'normal';
			const fontStyle = node.fontStyle || 'normal';

			if (isEditing) {
				return (
					<textarea
						ref={textareaRef}
						className="node-content-edit"
						defaultValue={node.content}
						onBlur={onBlur}
						onKeyDown={onKeyDown}
						onInput={onInput}
						autoFocus
						rows={1}
						style={{
							fontSize,
							color: fontColor,
							fontWeight,
							fontStyle,
							width: '100%',
							padding: '4px 0',
							resize: 'none',
							border: 'none',
							outline: 'none',
							backgroundColor: 'transparent',
							fontFamily: 'var(--font-ui)',
							overflow: 'hidden',
							whiteSpace: 'nowrap',
						}}
					/>
				);
			}
			return (
				<div
					ref={textRef}
					className="node-content"
					style={{
						fontSize,
						color: fontColor,
						fontWeight,
						fontStyle,
						fontFamily: 'var(--font-ui)',
						width: '100%',
						padding: '4px 0',
						overflow: 'hidden',
						whiteSpace: 'nowrap',
						textOverflow: 'ellipsis',
					}}
				>
					{node.content || 'Double click to edit'}
				</div>
			);
		}
		case 'markdown': {
			const mdTextColor = theme === 'dark' ? '#ccc' : '#333';
			const mdBgColor = theme === 'dark' ? '#1e1e1e' : '#fff';
			if (isEditing) {
				return (
					<textarea
						ref={textareaRef}
						className="node-content-edit"
						defaultValue={node.content}
						onBlur={onBlur}
						onKeyDown={onKeyDown}
						onInput={onInput}
						autoFocus
						style={{
							fontSize: 13,
							color: mdTextColor,
							width: '100%',
							height: '100%',
							padding: '16px',
							resize: 'none',
							border: 'none',
							outline: 'none',
							backgroundColor: mdBgColor,
							fontFamily: "var(--font-node-mono)",
							overflow: 'auto',
							whiteSpace: 'pre-wrap',
							boxSizing: 'border-box',
							lineHeight: 1.6,
						}}
					/>
				);
			}
			return (
				<div
					ref={textRef}
					className="markdown-card-content"
					style={{
						width: '100%',
						height: '100%',
						padding: '16px',
						overflow: 'hidden',
						boxSizing: 'border-box',
						fontSize: 14,
						lineHeight: 1.6,
						color: mdTextColor,
					}}
				>
					<Markdown components={markdownComponents}>{node.content || '*Double click to edit*'}</Markdown>
				</div>
			);
		}
		case 'draw': {
			const strokeColor = node.fontColor || (theme === 'dark' ? '#ffffff' : '#1a1a1a');
			const pointsString = node.points ? node.points.map(p => `${p.x},${p.y}`).join(' ') : '';
			return (
				<svg
					width="100%"
					height="100%"
					viewBox={`0 0 ${node.width} ${node.height}`}
					style={{ overflow: 'visible', pointerEvents: 'none' }}
				>
					<polyline
						points={pointsString}
						fill="none"
						stroke={strokeColor}
						strokeWidth={node.strokeWidth || 2}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		}
		default:
			return null;
	}
};
