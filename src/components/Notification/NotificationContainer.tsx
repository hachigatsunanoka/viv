import React from 'react';
import { NotificationItem } from './NotificationItem';
import type { Notification } from './NotificationContext';
import './Notification.css';

interface NotificationContainerProps {
    notifications: Notification[];
    onClose: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onClose }) => {
    return (
        <div className="notification-container">
            {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onClose={onClose} />
            ))}
        </div>
    );
};
