import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  X, MapPin, Clock, User, Phone, Calendar, DollarSign, 
  Check, ChevronRight, FileText, Star, MessageSquare, Play,
  CheckCircle, AlertCircle, Navigation, Camera
} from 'lucide-react';

// Task Detail Modal Component
export function TaskDetailModal({ task, booking, isOpen, onClose, userRole, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [completionData, setCompletionData] = useState({
    actual_hours: 1,
    expenses: 0,
    start_time: '',
    end_time: '',
    provider_comments: ''
  });

  if (!isOpen || (!task && !booking)) return null;

  const data = task || booking;
  const isProvider = userRole === 'provider';
  const isClient = userRole === 'client';
  const isAdmin = userRole === 'admin';

  const getStatusInfo = (status) => {
    const statusMap = {
      'draft': { color: 'bg-gray-100 text-gray-700', label: 'Чернетка', icon: FileText },
      'posted': { color: 'bg-yellow-100 text-yellow-700', label: 'Опубліковано', icon: AlertCircle },
      'assigned': { color: 'bg-blue-100 text-blue-700', label: 'Призначено', icon: User },
      'accepted': { color: 'bg-blue-100 text-blue-700', label: 'Прийнято', icon: Check },
      'hold_placed': { color: 'bg-purple-100 text-purple-700', label: 'Оплата утримана', icon: DollarSign },
      'on_the_way': { color: 'bg-indigo-100 text-indigo-700', label: 'В дорозі', icon: Navigation },
      'in_progress': { color: 'bg-purple-100 text-purple-700', label: 'В роботі', icon: Play },
      'started': { color: 'bg-purple-100 text-purple-700', label: 'Розпочато', icon: Play },
      'completed': { color: 'bg-green-100 text-green-700', label: 'Виконано', icon: CheckCircle },
      'completed_pending_payment': { color: 'bg-green-100 text-green-700', label: 'Очікує оплати', icon: DollarSign },
      'paid': { color: 'bg-green-100 text-green-700', label: 'Оплачено', icon: CheckCircle },
      'cancelled': { color: 'bg-red-100 text-red-700', label: 'Скасовано', icon: X },
      'cancelled_by_client': { color: 'bg-red-100 text-red-700', label: 'Скасовано клієнтом', icon: X },
      'cancelled_by_tasker': { color: 'bg-red-100 text-red-700', label: 'Скасовано виконавцем', icon: X },
      'dispute': { color: 'bg-orange-100 text-orange-700', label: 'Диспут', icon: AlertCircle }
    };
    return statusMap[status] || { color: 'bg-gray-100 text-gray-700', label: status, icon: FileText };
  };

  const handleAccept = async () => {
    if (!task) return;
    setLoading(true);
    try {
      await api.acceptTask(task.task_id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error accepting task:', error);
      alert('Не вдалося прийняти завдання');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!task) return;
    setLoading(true);
    try {
      await api.startTask(task.task_id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error starting task:', error);
      alert('Не вдалося розпочати завдання');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!task || !completionData.start_time || !completionData.end_time) {
      alert('Заповніть час початку та завершення');
      return;
    }
    setLoading(true);
    try {
      await api.completeTask(task.task_id, completionData);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Не вдалося завершити завдання');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!task) return;
    const reason = prompt('Вкажіть причину відмови:');
    if (reason === null) return;
    
    setLoading(true);
    try {
      await api.declineTask(task.task_id, reason);
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error declining task:', error);
      alert('Не вдалося відхилити завдання');
    } finally {
      setLoading(false);
    }
  };

  const statusInfo = getStatusInfo(data.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-green-600 to-green-700">
          <div className="text-white">
            <h2 className="text-lg font-semibold">{data.title || 'Деталі завдання'}</h2>
            <p className="text-sm text-green-100">{task ? `#${task.task_id?.slice(-8)}` : `#${booking?.booking_id?.slice(-8)}`}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {['details', 'checklist', 'messages'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab 
                  ? 'text-green-600 border-b-2 border-green-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'details' && 'Деталі'}
              {tab === 'checklist' && 'Чек-лист'}
              {tab === 'messages' && 'Повідомлення'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Status */}
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${statusInfo.color}`}>
                <StatusIcon className="w-4 h-4" />
                <span className="font-medium">{statusInfo.label}</span>
              </div>

              {/* Client/Provider Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3">
                  {isProvider ? 'Клієнт' : 'Виконавець'}
                </h4>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {isProvider 
                        ? (data.client?.name || 'Клієнт') 
                        : (data.provider?.name || 'Очікує призначення')}
                    </p>
                    {(isProvider || isAdmin) && data.client?.phone && (
                      <a href={`tel:${data.client.phone}`} className="text-sm text-green-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {data.client.phone}
                      </a>
                    )}
                  </div>
                  <button className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700">
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Address & Time */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{data.address || 'Адреса не вказана'}</p>
                    {data.latitude && data.longitude && (
                      <a 
                        href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:underline"
                      >
                        Відкрити на карті
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {data.date || data.scheduled_date || 'Дата не вказана'}
                    </p>
                    <p className="text-sm text-gray-500">{data.time || data.scheduled_time || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      ${data.total_price || data.custom_price || data.estimated_price || 0}
                    </p>
                    {data.estimated_hours && (
                      <p className="text-sm text-gray-500">{data.estimated_hours} годин(и)</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {data.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Опис</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              {/* Notes */}
              {data.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Примітки</h4>
                  <p className="text-gray-700">{data.notes}</p>
                </div>
              )}

              {/* Problem Photos */}
              {data.problem_photos && data.problem_photos.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Фото проблеми</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {data.problem_photos.map((photo, idx) => (
                      <img 
                        key={idx}
                        src={photo}
                        alt={`Фото ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completion Form (for Provider) */}
              {isProvider && task && task.status === 'in_progress' && (
                <div className="border-t pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Завершення роботи</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Час початку</label>
                        <input
                          type="time"
                          value={completionData.start_time}
                          onChange={(e) => setCompletionData(prev => ({...prev, start_time: e.target.value}))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Час завершення</label>
                        <input
                          type="time"
                          value={completionData.end_time}
                          onChange={(e) => setCompletionData(prev => ({...prev, end_time: e.target.value}))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Фактичні години</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={completionData.actual_hours}
                          onChange={(e) => setCompletionData(prev => ({...prev, actual_hours: parseFloat(e.target.value)}))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Витрати на матеріали ($)</label>
                        <input
                          type="number"
                          min="0"
                          value={completionData.expenses}
                          onChange={(e) => setCompletionData(prev => ({...prev, expenses: parseFloat(e.target.value) || 0}))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Коментар</label>
                      <textarea
                        value={completionData.provider_comments}
                        onChange={(e) => setCompletionData(prev => ({...prev, provider_comments: e.target.value}))}
                        className="w-full px-3 py-2 border rounded-lg h-20"
                        placeholder="Опишіть виконану роботу..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <p className="text-gray-500 text-center py-8">
                Чек-лист для цього завдання не налаштовано
              </p>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <p className="text-gray-500 text-center py-8">
                Використовуйте чат для спілкування
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isProvider && task && (
          <div className="p-4 border-t bg-gray-50 flex gap-3">
            {task.status === 'assigned' && (
              <>
                <button
                  onClick={handleDecline}
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 disabled:opacity-50"
                >
                  Відхилити
                </button>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Обробка...' : 'Прийняти'}
                </button>
              </>
            )}
            {(task.status === 'accepted' || task.status === 'assigned') && (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Обробка...' : 'Розпочати роботу'}
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Обробка...' : 'Завершити роботу'}
              </button>
            )}
          </div>
        )}

        {/* Client Actions */}
        {isClient && booking && booking.status === 'completed' && (
          <div className="p-4 border-t bg-gray-50 flex gap-3">
            <button
              className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Star className="w-5 h-5" />
              Залишити відгук
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskDetailModal;
