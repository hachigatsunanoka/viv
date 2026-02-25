import React from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import type { Notification } from './NotificationContext';
import './Notification.css';

interface NotificationItemProps {
    notification: Notification;
    onClose: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
    const renderIcon = () => {
        switch (notification.type) {
            case 'success':
                return <CheckCircle size={14} className="notification-icon success" />;
            case 'error':
                return <AlertCircle size={14} className="notification-icon error" />;
            case 'warning':
                return <AlertTriangle size={14} className="notification-icon warning" />;
            case 'info':
            default:
                return <Info size={14} className="notification-icon info" />;
        }
    };

    return (
        <div className={`notification-item ${notification.type}`}>
            {renderIcon()}
            <span className="notification-message">{notification.message}</span>
            <button className="notification-close" onClick={() => onClose(notification.id)}>
                <X size={12} />
            </button>
        </div>
    );
};
