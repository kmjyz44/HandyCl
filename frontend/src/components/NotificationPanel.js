import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  Bell, X, Check, ChevronRight, ClipboardList, MessageSquare, 
  DollarSign, Star, FileText, Zap, Trash2
} from 'lucide-react';

// Notification Panel Component
export function NotificationPanel({ isOpen, onClose, onNotificationClick }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const [notifRes, countRes] = await Promise.all([
        api.getNotifications(),
        api.getUnreadNotificationCount()
      ]);
      setNotifications(Array.isArray(notifRes.data) ? notifRes.data : (Array.isArray(notifRes) ? notifRes : []));
      setUnreadCount(countRes.data?.unread_count || countRes?.unread_count || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? {...n, is_read: true} : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({...n, is_read: true})));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.notification_id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  const getNotificationIcon = (type) => {
    const iconMap = {
      'booking_created': ClipboardList,
      'booking_assigned': ClipboardList,
      'booking_accepted': Check,
      'booking_started': Zap,
      'booking_completed': Check,
      'booking_cancelled': X,
      'task_assigned': ClipboardList,
      'task_updated': ClipboardList,
      'new_message': MessageSquare,
      'payment_received': DollarSign,
      'payout_completed': DollarSign,
      'document_approved': FileText,
      'document_rejected': FileText,
      'review_received': Star,
      'system': Bell
    };
    return iconMap[type] || Bell;
  };

  const getNotificationColor = (type) => {
    const colorMap = {
      'booking_created': 'bg-blue-100 text-blue-600',
      'booking_assigned': 'bg-purple-100 text-purple-600',
      'booking_accepted': 'bg-green-100 text-green-600',
      'booking_started': 'bg-yellow-100 text-yellow-600',
      'booking_completed': 'bg-green-100 text-green-600',
      'booking_cancelled': 'bg-red-100 text-red-600',
      'task_assigned': 'bg-blue-100 text-blue-600',
      'task_updated': 'bg-purple-100 text-purple-600',
      'new_message': 'bg-green-100 text-green-600',
      'payment_received': 'bg-green-100 text-green-600',
      'payout_completed': 'bg-green-100 text-green-600',
      'document_approved': 'bg-green-100 text-green-600',
      'document_rejected': 'bg-red-100 text-red-600',
      'review_received': 'bg-yellow-100 text-yellow-600',
      'system': 'bg-gray-100 text-gray-600'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-600';
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffHours < 24) return `${diffHours} год тому`;
    if (diffDays < 7) return `${diffDays} дн тому`;
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-900">Сповіщення</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Прочитати всі
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-gray-500">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">Немає сповіщень</p>
              <p className="text-sm mt-1">Нові сповіщення з'являться тут</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {notifications.map(notification => {
              const Icon = getNotificationIcon(notification.notification_type);
              const colorClass = getNotificationColor(notification.notification_type);
              
              return (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 flex gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-green-50' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(notification.notification_id, e)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Notification Bell with Badge
export function NotificationBell({ onClick }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      setUnreadCount(res.data?.unread_count || res?.unread_count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
      data-testid="notification-bell"
    >
      <Bell className="w-5 h-5 text-gray-600" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default NotificationPanel;
