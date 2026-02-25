import { useState } from 'react';
import type { ToolType } from '../components/CenterPeak/SketchTools';

export interface DrawingState {
	activeTool: ToolType;
	setActiveTool: (tool: ToolType) => void;
	brushColor: string;
	setBrushColor: (color: string) => void;
	// Per-tool size
	brushSize: number;
	setBrushSize: (size: number) => void;
	grungeSize: number;
	setGrungeSize: (size: number) => void;
	eraserSize: number;
	setEraserSize: (size: number) => void;
	// Per-tool opacity
	brushOpacity: number;
	setBrushOpacity: (opacity: number) => void;
	grungeOpacity: number;
	setGrungeOpacity: (opacity: number) => void;
	eraserOpacity: number;
	setEraserOpacity: (opacity: number) => void;
	ghostingEnabled: boolean;
	setGhostingEnabled: (enabled: boolean) => void;
	onionSkinFrames: number;
	setOnionSkinFrames: (frames: number) => void;
	showAnnotations: boolean;
	setShowAnnotations: (show: boolean) => void;
}

export const useDrawing = (): DrawingState => {
	const [activeTool, setActiveTool] = useState<ToolType>('brush');
	const [brushColor, setBrushColor] = useState('#ff0000');
	const [brushSize, setBrushSize] = useState(10);
	const [grungeSize, setGrungeSize] = useState(20);
	const [eraserSize, setEraserSize] = useState(20);
	const [brushOpacity, setBrushOpacity] = useState(1);
	const [grungeOpacity, setGrungeOpacity] = useState(0.5);
	const [eraserOpacity, setEraserOpacity] = useState(1);
	const [ghostingEnabled, setGhostingEnabled] = useState(false);
	const [onionSkinFrames, setOnionSkinFrames] = useState(2);
	const [showAnnotations, setShowAnnotations] = useState(true);

	return {
		activeTool,
		setActiveTool,
		brushColor,
		setBrushColor,
		brushSize,
		setBrushSize,
		grungeSize,
		setGrungeSize,
		eraserSize,
		setEraserSize,
		brushOpacity,
		setBrushOpacity,
		grungeOpacity,
		setGrungeOpacity,
		eraserOpacity,
		setEraserOpacity,
		ghostingEnabled,
		setGhostingEnabled,
		onionSkinFrames,
		setOnionSkinFrames,
		showAnnotations,
		setShowAnnotations
	};
};
