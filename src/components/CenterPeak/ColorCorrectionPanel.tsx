import React from 'react';
import { RefreshCw } from 'lucide-react';
import './ColorCorrectionPanel.css';

interface ColorCorrectionPanelProps {
    saturation: number;
    setSaturation: (value: number) => void;
    contrast: number;
    setContrast: (value: number) => void;
    brightness: number;
    setBrightness: (value: number) => void;
}

export const ColorCorrectionPanel: React.FC<ColorCorrectionPanelProps> = ({
    saturation,
    setSaturation,
    contrast,
    setContrast,
    brightness,
    setBrightness,
}) => {
    const resetValues = () => {
        setSaturation(1);
        setContrast(1);
        setBrightness(1);
    };

    return (
        <div className="color-correction-panel">
            <div className="panel-header">
                <h3>Color Correction</h3>
                <div className="header-actions">
                    <button
                        className="reset-button"
                        onClick={resetValues}
                        title="Reset All"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="panel-content">
                <div className="control-group">
                    <div className="control-label">
                        <span>Saturation</span>
                        <span className="control-value">{saturation.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={saturation}
                        onChange={(e) => setSaturation(parseFloat(e.target.value))}
                    />
                </div>

                <div className="control-group">
                    <div className="control-label">
                        <span>Contrast</span>
                        <span className="control-value">{contrast.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={contrast}
                        onChange={(e) => setContrast(parseFloat(e.target.value))}
                    />
                </div>

                <div className="control-group">
                    <div className="control-label">
                        <span>Brightness</span>
                        <span className="control-value">{brightness.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </div >
    );
};
