import React from 'react';
import { useStore } from '../../store/useStore';
import { TEXT_SIZE_FONT_MAP } from '../../constants';
import './TextToolbar.css';

interface TextToolbarProps {
    nodeId: string;
    currentSize: 'small' | 'medium' | 'large';
    currentColor: string;
    currentWeight: 'normal' | 'bold';
    currentStyle: 'normal' | 'italic';
    zoom: number;
}


const COLORS = [
    { label: 'White', value: '#ffffff' },
    { label: 'Black', value: '#1a1a1a' },
    { label: 'Red', value: '#ef4444' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Yellow', value: '#f59e0b' },
];

export const TextToolbar: React.FC<TextToolbarProps> = ({ nodeId, currentSize, currentColor, currentWeight, currentStyle, zoom }) => {
    const { updateNode, pushHistory } = useStore();
    const scale = 1 / zoom;

    const handleSize = (size: 'small' | 'medium' | 'large') => {
        pushHistory();
        updateNode(nodeId, { textSize: size, fontSize: TEXT_SIZE_FONT_MAP[size] });
    };

    const handleColor = (color: string) => {
        pushHistory();
        updateNode(nodeId, { fontColor: color });
    };

    const handleBold = () => {
        pushHistory();
        updateNode(nodeId, { fontWeight: currentWeight === 'bold' ? 'normal' : 'bold' });
    };

    const handleItalic = () => {
        pushHistory();
        updateNode(nodeId, { fontStyle: currentStyle === 'italic' ? 'normal' : 'italic' });
    };

    return (
        <div
            className="text-toolbar"
            style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'bottom center' }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button
                className={`text-toolbar-btn ${currentSize === 'small' ? 'active' : ''}`}
                onClick={() => handleSize('small')}
                title="Small"
            >
                S
            </button>
            <button
                className={`text-toolbar-btn ${currentSize === 'medium' ? 'active' : ''}`}
                onClick={() => handleSize('medium')}
                title="Medium"
            >
                M
            </button>
            <button
                className={`text-toolbar-btn ${currentSize === 'large' ? 'active' : ''}`}
                onClick={() => handleSize('large')}
                title="Large"
            >
                L
            </button>

            <div className="text-toolbar-separator" />

            <button
                className={`text-toolbar-btn ${currentWeight === 'bold' ? 'active' : ''}`}
                onClick={handleBold}
                title="Bold"
                style={{ fontWeight: 'bold' }}
            >
                B
            </button>
            <button
                className={`text-toolbar-btn ${currentStyle === 'italic' ? 'active' : ''}`}
                onClick={handleItalic}
                title="Italic"
                style={{ fontStyle: 'italic' }}
            >
                I
            </button>

            <div className="text-toolbar-separator" />

            {COLORS.map((c) => (
                <div
                    key={c.value}
                    className={`text-toolbar-color ${currentColor === c.value ? 'active' : ''}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => handleColor(c.value)}
                    title={c.label}
                />
            ))}
        </div>
    );
};
