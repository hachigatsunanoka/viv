import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AppConfig {
    ytDlpPath?: string;
    videoSize?: string;
    nanoBananaApiKey?: string;
}

export const useConfig = () => {
    const [config, setConfig] = useState<AppConfig>({});

    useEffect(() => {
        let mounted = true;
        invoke<string>('get_config')
            .then(configStr => {
                if (mounted) setConfig(JSON.parse(configStr));
            })
            .catch(() => { });
        return () => { mounted = false; };
    }, []);

    const loadConfig = useCallback(() => {
        invoke<string>('get_config')
            .then(configStr => {
                setConfig(JSON.parse(configStr));
            })
            .catch(() => { });
    }, []);

    return {
        ytDlpPath: config.ytDlpPath,
        videoSize: config.videoSize ?? '1080',
        nanoBananaApiKey: config.nanoBananaApiKey,
        reloadConfig: loadConfig,
    };
};
