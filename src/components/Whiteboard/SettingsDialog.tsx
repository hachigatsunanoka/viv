import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Check, Sun, Moon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { SANS_FONTS, MONO_FONTS } from '../../lib/fontOptions';
import LabelSlider from '../ui/LabelSlider';
import './SettingsDialog.css';

interface AppConfig {
    ytDlpPath?: string;
    videoSize?: string;
    nanoBananaApiKey?: string;
}

interface SettingsDialogProps {
    onClose: () => void;
}

const VIDEO_SIZES = [
    { value: '2160', label: '4K (2160p)' },
    { value: '1440', label: '1440p' },
    { value: '1080', label: '1080p (Full HD)' },
    { value: '720',  label: '720p (HD)' },
    { value: '480',  label: '480p' },
    { value: '360',  label: '360p' },
];

type Tab = 'appearance' | 'plugin';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('appearance');
    const [ytDlpPath, setYtDlpPath] = useState('');
    const [videoSize, setVideoSize] = useState('1080');
    const [nanoBananaApiKey, setNanoBananaApiKey] = useState('');
    const [saved, setSaved] = useState(false);
    const { fontSans, fontMono, setFontSans, setFontMono, theme, toggleTheme, dotGridEnabled, dotGridPitch, setDotGridEnabled, setDotGridPitch } = useStore();

    useEffect(() => {
        invoke<string>('get_config').then((configStr) => {
            try {
                const config: AppConfig = JSON.parse(configStr);
                if (config.ytDlpPath) setYtDlpPath(config.ytDlpPath);
                if (config.videoSize) setVideoSize(config.videoSize);
                if (config.nanoBananaApiKey) setNanoBananaApiKey(config.nanoBananaApiKey);
            } catch { /* ignore */ }
        });
    }, []);

    const handleBrowse = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Executable', extensions: ['exe', ''] }]
        });
        if (selected && typeof selected === 'string') {
            setYtDlpPath(selected);
            setSaved(false);
        }
    };

    const handleSave = async () => {
        try {
            const existingStr = await invoke<string>('get_config');
            let config: AppConfig = {};
            try { config = JSON.parse(existingStr); } catch { /* empty */ }
            config.ytDlpPath = ytDlpPath || undefined;
            config.videoSize = videoSize;
            config.nanoBananaApiKey = nanoBananaApiKey || undefined;
            await invoke('save_config', { config: JSON.stringify(config, null, 2) });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Failed to save config:', err);
        }
    };

    const sansStack = SANS_FONTS.find(f => f.id === fontSans)?.stack ?? SANS_FONTS[0].stack;
    const monoStack = MONO_FONTS.find(f => f.id === fontMono)?.stack ?? MONO_FONTS[0].stack;

    return (
        <div
            className="settings-overlay"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
        >
            <div className="settings-dialog">
                <div className="dialog-header">
                    <h3>Settings</h3>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        Appearance
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'plugin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('plugin')}
                    >
                        Plugin
                    </button>
                </div>

                <div className="dialog-content">
                    {activeTab === 'appearance' && (
                        <>
                            <div className="plugin-subsection-label">
                                Whiteboard
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Theme</span>
                                <div className="theme-btn-group">
                                    <button
                                        className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                                        onClick={() => theme !== 'light' && toggleTheme()}
                                        title="Light Mode"
                                    >
                                        <Sun size={13} /> Light
                                    </button>
                                    <button
                                        className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                                        onClick={() => theme !== 'dark' && toggleTheme()}
                                        title="Dark Mode"
                                    >
                                        <Moon size={13} /> Dark
                                    </button>
                                </div>
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Dot Grid</span>
                                <button
                                    className={`toggle-switch ${dotGridEnabled ? 'on' : ''}`}
                                    onClick={() => setDotGridEnabled(!dotGridEnabled)}
                                    role="switch"
                                    aria-checked={dotGridEnabled}
                                />
                                {dotGridEnabled && (
                                    <LabelSlider
                                        label="Pitch"
                                        min={10}
                                        max={200}
                                        step={2}
                                        value={dotGridPitch}
                                        onChange={setDotGridPitch}
                                        formatValue={(v) => `${v}px`}
                                        width="100%"
                                    />
                                )}
                            </div>

                            <div className="plugin-subsection-label" style={{ marginTop: 8 }}>
                                Markdown
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Sans-serif</span>
                                <select
                                    className="settings-select"
                                    value={fontSans}
                                    onChange={(e) => setFontSans(e.target.value)}
                                >
                                    {SANS_FONTS.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Monospace</span>
                                <select
                                    className="settings-select"
                                    value={fontMono}
                                    onChange={(e) => setFontMono(e.target.value)}
                                >
                                    {MONO_FONTS.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="font-preview-area">
                                <div className="font-preview-row">
                                    <span className="font-preview-tag">Sans</span>
                                    <span className="font-preview-text" style={{ fontFamily: sansStack }}>
                                        The quick brown fox — あいうえお — 123
                                    </span>
                                </div>
                                <div className="font-preview-row">
                                    <span className="font-preview-tag">Mono</span>
                                    <span className="font-preview-text" style={{ fontFamily: monoStack }}>
                                        font-family: var(--font-mono);
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'plugin' && (
                        <>
                            <div className="plugin-subsection-label">
                                <span className={`plugin-status-dot ${ytDlpPath ? 'active' : ''}`} />
                                yt-dlp
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Binary Path</span>
                                <div className="path-input-row">
                                    <input
                                        type="text"
                                        value={ytDlpPath}
                                        onChange={(e) => { setYtDlpPath(e.target.value); setSaved(false); }}
                                        placeholder="Leave empty to use system PATH"
                                    />
                                    <button className="browse-button" onClick={handleBrowse} title="Browse">
                                        <FolderOpen size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">Video Size</span>
                                <select
                                    className="settings-select"
                                    value={videoSize}
                                    onChange={(e) => { setVideoSize(e.target.value); setSaved(false); }}
                                >
                                    {VIDEO_SIZES.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="hint">
                                Download from <a href="https://github.com/yt-dlp/yt-dlp/releases" target="_blank" rel="noreferrer">github.com/yt-dlp/yt-dlp</a>
                            </div>

                            <div className="plugin-subsection-label" style={{ marginTop: 20 }}>
                                <span className={`plugin-status-dot ${nanoBananaApiKey ? 'active' : ''}`} />
                                Nano Banana
                            </div>

                            <div className="settings-row">
                                <span className="settings-row-label">API Key</span>
                                <input
                                    type="password"
                                    value={nanoBananaApiKey}
                                    onChange={(e) => { setNanoBananaApiKey(e.target.value); setSaved(false); }}
                                    placeholder="Google Gemini API key"
                                    style={{ flex: 1 }}
                                />
                            </div>
                            <div className="hint">
                                Get it from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>
                            </div>
                        </>
                    )}
                </div>

                <div className="dialog-footer">
                    <button className="cancel-button" onClick={onClose}>Close</button>
                    <button className="save-button" onClick={handleSave}>
                        {saved ? <><Check size={16} /> Saved</> : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};
