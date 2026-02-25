import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { useNotification } from '../components/Notification/NotificationContext';

export const useUpdateCheck = () => {
    const { addNotification } = useNotification();

    useEffect(() => {
        const checkUpdate = async () => {
            try {
                // Delay checks to ensure UI is ready and not block startup
                await new Promise(resolve => setTimeout(resolve, 2000));

                const update = await check();
                if (update) {
                    const yes = await ask(
                        `Update to ${update.version} is available!\n\nRelease notes: ${update.body}`,
                        {
                            title: 'Update Available',
                            kind: 'info',
                            okLabel: 'Update',
                            cancelLabel: 'Cancel'
                        }
                    );
                    if (yes) {
                        await update.downloadAndInstall();
                        await relaunch();
                    }
                }
            } catch (error) {
                console.error('Failed to check for updates:', error);
                addNotification(`Failed to check for updates: ${error}`, 'warning');
            }
        };

        checkUpdate();
    }, [addNotification]);
};
