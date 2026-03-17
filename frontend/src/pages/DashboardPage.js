import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/apiClient';
import { 
  Users, Calendar, ClipboardList, Settings, LogOut, 
  Wrench, Star, MapPin, Clock, ChevronRight, Menu, X,
  Home, MessageSquare, User, BarChart3, Plus, Trash2, Edit, Ban, Check, Percent, Send, Phone, DollarSign, Key, Camera, Eye
} from 'lucide-react';

// Bookings Panel Component for Admin
function BookingsPanel({ bookings, user, onRefresh, getStatusColor }) {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [executors, setExecutors] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [assignData, setAssignData] = useState({ provider_id: '', custom_price: '', notes: '' });
  const [editData, setEditData] = useState({});
  const [reassignData, setReassignData] = useState({ new_provider_id: '', notes: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadExecutors();
    }
  }, [user]);

  const loadExecutors = async () => {
    try {
      const res = await api.getExecutors();
      setExecutors(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading executors:', error);
    }
  };

  const handleAssign = async () => {
    if (!assignData.provider_id) {
      alert('Оберіть виконавця');
      return;
    }
    setLoading(true);
    try {
      await api.assignBooking(selectedBooking.booking_id, {
        provider_id: assignData.provider_id,
        custom_price: assignData.custom_price ? parseFloat(assignData.custom_price) : undefined,
        notes: assignData.notes || undefined
      });
      setShowAssignModal(false);
      setSelectedBooking(null);
      setAssignData({ provider_id: '', custom_price: '', notes: '' });
      onRefresh();
      alert('Замовлення направлено виконавцю!');
    } catch (error) {
      console.error('Error assigning booking:', error);
      alert('Помилка при направленні');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    setLoading(true);
    try {
      await api.updateBookingAdmin(selectedBooking.booking_id, editData);
      setShowEditModal(false);
      setSelectedBooking(null);
      setEditData({});
      onRefresh();
      alert('Замовлення оновлено!');
    } catch (error) {
      console.error('Error updating booking:', error);
      alert('Помилка при оновленні');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignData.new_provider_id) {
      alert('Оберіть нового виконавця');
      return;
    }
    setLoading(true);
    try {
      await api.reassignBooking(selectedBooking.booking_id, {
        new_provider_id: reassignData.new_provider_id,
        notes: reassignData.notes || undefined
      });
      setShowReassignModal(false);
      setSelectedBooking(null);
      setReassignData({ new_provider_id: '', notes: '' });
      onRefresh();
      alert('Замовлення перепризначено!');
    } catch (error) {
      console.error('Error reassigning booking:', error);
      alert('Помилка при перепризначенні');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (booking) => {
    setSelectedBooking(booking);
    setAssignData({ 
      provider_id: booking.provider_id || '', 
      custom_price: booking.total_price?.toString() || '',
      notes: ''
    });
    setShowAssignModal(true);
  };

  const openEditModal = (booking) => {
    setSelectedBooking(booking);
    setEditData({
      date: booking.date || '',
      time: booking.time || '',
      total_price: booking.total_price?.toString() || '',
      address: booking.address || '',
      notes: booking.notes || ''
    });
    setShowEditModal(true);
  };

  const openReassignModal = (booking) => {
    setSelectedBooking(booking);
    setReassignData({ new_provider_id: '', notes: '' });
    setShowReassignModal(true);
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Очікує',
      assigned: 'Направлено',
      accepted: 'Прийнято',
      in_progress: 'В роботі',
      completed: 'Завершено',
      cancelled: 'Скасовано'
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {user?.role === 'admin' ? 'Управління замовленнями' : 'Мої замовлення'}
      </h1>
      
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="divide-y">
          {bookings.map(booking => (
            <div key={booking.booking_id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {booking.service?.name || booking.service_id}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                  
                  {/* Client info (for admin) */}
                  {user?.role === 'admin' && booking.client && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700">Клієнт:</p>
                      <p className="text-sm text-gray-600">{booking.client.name}</p>
                      <p className="text-sm text-gray-500">{booking.client.email}</p>
                      {booking.client.phone && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {booking.client.phone}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {booking.date} о {booking.time}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {booking.address}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      ${booking.total_price}
                    </p>
                  </div>

                  {/* Provider info */}
                  {booking.provider && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">Виконавець:</p>
                      <p className="text-sm text-blue-600">{booking.provider.name}</p>
                    </div>
                  )}

                  {/* Task info */}
                  {booking.task && (
                    <div className="mt-2 p-2 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-700">
                        Завдання: {getStatusLabel(booking.task.status)}
                      </p>
                      {booking.task.actual_hours && (
                        <p className="text-sm text-green-600">
                          Відпрацьовано: {booking.task.actual_hours} год
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin actions */}
                {user?.role === 'admin' && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(booking)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      data-testid={`edit-booking-${booking.booking_id}`}
                    >
                      <Edit className="w-4 h-4" />
                      Редагувати
                    </button>
                    {booking.status === 'pending' && (
                      <button
                        onClick={() => openAssignModal(booking)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        data-testid={`assign-booking-${booking.booking_id}`}
                      >
                        <Send className="w-4 h-4" />
                        Направити
                      </button>
                    )}
                    {booking.provider_id && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <button
                        onClick={() => openReassignModal(booking)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                        data-testid={`reassign-booking-${booking.booking_id}`}
                      >
                        <Users className="w-4 h-4" />
                        Перепризначити
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Немає замовлень
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Направити виконавцю</h3>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Виконавець *</label>
                <select
                  value={assignData.provider_id}
                  onChange={(e) => setAssignData({...assignData, provider_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Оберіть виконавця</option>
                  {executors.map(exec => (
                    <option key={exec.user_id} value={exec.user_id}>
                      {exec.name} - {exec.profile?.skills?.join(', ') || 'Без навичок'}
                      {exec.average_rating > 0 && ` (★${exec.average_rating.toFixed(1)})`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ціна ($)</label>
                <input
                  type="number"
                  value={assignData.custom_price}
                  onChange={(e) => setAssignData({...assignData, custom_price: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={selectedBooking?.total_price?.toString()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітки</label>
                <textarea
                  value={assignData.notes}
                  onChange={(e) => setAssignData({...assignData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Додаткові інструкції для виконавця..."
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Скасувати
              </button>
              <button
                onClick={handleAssign}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Направляю...' : 'Направити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Редагувати замовлення</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                  <input
                    type="date"
                    value={editData.date}
                    onChange={(e) => setEditData({...editData, date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Час</label>
                  <input
                    type="time"
                    value={editData.time}
                    onChange={(e) => setEditData({...editData, time: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ціна ($)</label>
                <input
                  type="number"
                  value={editData.total_price}
                  onChange={(e) => setEditData({...editData, total_price: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адреса</label>
                <input
                  type="text"
                  value={editData.address}
                  onChange={(e) => setEditData({...editData, address: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітки</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({...editData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Скасувати
              </button>
              <button
                onClick={handleEdit}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Зберігаю...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Перепризначити виконавця</h3>
              <button onClick={() => setShowReassignModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {selectedBooking?.provider && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>Поточний виконавець:</strong> {selectedBooking.provider.name}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Новий виконавець *</label>
                <select
                  value={reassignData.new_provider_id}
                  onChange={(e) => setReassignData({...reassignData, new_provider_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  data-testid="reassign-provider-select"
                >
                  <option value="">Оберіть виконавця</option>
                  {executors
                    .filter(exec => exec.user_id !== selectedBooking?.provider_id)
                    .map(exec => (
                      <option key={exec.user_id} value={exec.user_id}>
                        {exec.name} - {exec.profile?.skills?.join(', ') || 'Без навичок'}
                        {exec.average_rating > 0 && ` (★${exec.average_rating.toFixed(1)})`}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Причина перепризначення</label>
                <textarea
                  value={reassignData.notes}
                  onChange={(e) => setReassignData({...reassignData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Чому змінюємо виконавця..."
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowReassignModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Скасувати
              </button>
              <button
                onClick={handleReassign}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                data-testid="reassign-confirm-button"
              >
                {loading ? 'Перепризначаю...' : 'Перепризначити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CMS Content Section Component
function CMSSection() {
  const [content, setContent] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [activeTab, setActiveTab] = useState('pages');
  const [editingContent, setEditingContent] = useState(null);
  const [editingFaq, setEditingFaq] = useState(null);
  const [newContent, setNewContent] = useState({
    content_type: 'page',
    slug: '',
    title: '',
    title_uk: '',
    content: '',
    content_uk: '',
    is_published: false
  });
  const [newFaq, setNewFaq] = useState({
    question: '',
    question_uk: '',
    answer: '',
    answer_uk: '',
    category: 'general',
    sort_order: 0,
    is_published: true
  });

  useEffect(() => {
    loadContent();
    loadFaqs();
  }, []);

  const loadContent = async () => {
    try {
      const res = await api.adminGetCMSContent();
      setContent(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading CMS content:', error);
    }
  };

  const loadFaqs = async () => {
    try {
      const res = await api.adminGetFAQs();
      setFaqs(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading FAQs:', error);
    }
  };

  const handleSaveContent = async () => {
    try {
      if (editingContent) {
        await api.updateCMSContent(editingContent.content_id, newContent);
      } else {
        await api.createCMSContent(newContent);
      }
      setShowContentModal(false);
      setEditingContent(null);
      setNewContent({ content_type: 'page', slug: '', title: '', title_uk: '', content: '', content_uk: '', is_published: false });
      loadContent();
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Помилка: ' + (error.response?.data?.detail || 'Не вдалося зберегти'));
    }
  };

  const handleSaveFaq = async () => {
    try {
      if (editingFaq) {
        await api.updateFAQ(editingFaq.faq_id, newFaq);
      } else {
        await api.createFAQ(newFaq);
      }
      setShowFaqModal(false);
      setEditingFaq(null);
      setNewFaq({ question: '', question_uk: '', answer: '', answer_uk: '', category: 'general', sort_order: 0, is_published: true });
      loadFaqs();
    } catch (error) {
      console.error('Error saving FAQ:', error);
      alert('Помилка');
    }
  };

  const handleDeleteContent = async (contentId) => {
    if (window.confirm('Видалити цей контент?')) {
      try {
        await api.deleteCMSContent(contentId);
        loadContent();
      } catch (error) {
        console.error('Error deleting content:', error);
      }
    }
  };

  const handleDeleteFaq = async (faqId) => {
    if (window.confirm('Видалити це питання?')) {
      try {
        await api.deleteFAQ(faqId);
        loadFaqs();
      } catch (error) {
        console.error('Error deleting FAQ:', error);
      }
    }
  };

  const openEditContent = (item) => {
    setEditingContent(item);
    setNewContent({
      content_type: item.content_type,
      slug: item.slug,
      title: item.title,
      title_uk: item.title_uk || '',
      content: item.content,
      content_uk: item.content_uk || '',
      is_published: item.is_published
    });
    setShowContentModal(true);
  };

  const openEditFaq = (faq) => {
    setEditingFaq(faq);
    setNewFaq({
      question: faq.question,
      question_uk: faq.question_uk || '',
      answer: faq.answer,
      answer_uk: faq.answer_uk || '',
      category: faq.category || 'general',
      sort_order: faq.sort_order,
      is_published: faq.is_published
    });
    setShowFaqModal(true);
  };

  const filteredContent = content.filter(c => {
    if (activeTab === 'pages') return c.content_type === 'page';
    if (activeTab === 'blog') return c.content_type === 'blog_post';
    if (activeTab === 'announcements') return c.content_type === 'announcement';
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-600" />
          CMS - Управління контентом
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b pb-2">
        {['pages', 'blog', 'announcements', 'faq'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-lg text-sm ${activeTab === tab ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab === 'pages' ? 'Сторінки' : tab === 'blog' ? 'Блог' : tab === 'announcements' ? 'Оголошення' : 'FAQ'}
          </button>
        ))}
      </div>

      {activeTab !== 'faq' ? (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingContent(null); setNewContent({...newContent, content_type: activeTab === 'blog' ? 'blog_post' : activeTab === 'announcements' ? 'announcement' : 'page'}); setShowContentModal(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              data-testid="add-content-btn"
            >
              <Plus className="w-4 h-4" />
              Додати {activeTab === 'blog' ? 'статтю' : activeTab === 'announcements' ? 'оголошення' : 'сторінку'}
            </button>
          </div>

          <div className="divide-y">
            {filteredContent.length === 0 && (
              <p className="py-4 text-gray-500 text-center">Немає контенту</p>
            )}
            {filteredContent.map(item => (
              <div key={item.content_id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">/{item.slug} • {item.view_count || 0} переглядів</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {item.is_published ? 'Опубліковано' : 'Чернетка'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditContent(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteContent(item.content_id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditingFaq(null); setShowFaqModal(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              data-testid="add-faq-btn"
            >
              <Plus className="w-4 h-4" />
              Додати FAQ
            </button>
          </div>

          <div className="divide-y">
            {faqs.length === 0 && (
              <p className="py-4 text-gray-500 text-center">Немає FAQ</p>
            )}
            {faqs.map(faq => (
              <div key={faq.faq_id} className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{faq.question}</p>
                    <p className="text-sm text-gray-500 mt-1">{faq.answer.substring(0, 100)}...</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{faq.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditFaq(faq)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteFaq(faq.faq_id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Content Modal */}
      {showContentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingContent ? 'Редагувати' : 'Новий контент'}</h3>
              <button onClick={() => setShowContentModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    value={newContent.slug}
                    onChange={(e) => setNewContent({...newContent, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="about-us"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                  <select
                    value={newContent.content_type}
                    onChange={(e) => setNewContent({...newContent, content_type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="page">Сторінка</option>
                    <option value="blog_post">Блог</option>
                    <option value="announcement">Оголошення</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок (EN)</label>
                <input
                  type="text"
                  value={newContent.title}
                  onChange={(e) => setNewContent({...newContent, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Заголовок (UK)</label>
                <input
                  type="text"
                  value={newContent.title_uk}
                  onChange={(e) => setNewContent({...newContent, title_uk: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Контент (EN)</label>
                <textarea
                  value={newContent.content}
                  onChange={(e) => setNewContent({...newContent, content: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Контент (UK)</label>
                <textarea
                  value={newContent.content_uk}
                  onChange={(e) => setNewContent({...newContent, content_uk: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg h-32"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={newContent.is_published}
                  onChange={(e) => setNewContent({...newContent, is_published: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="is_published" className="text-sm text-gray-700">Опублікувати</label>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowContentModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button onClick={handleSaveContent} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                {editingContent ? 'Оновити' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFaqModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingFaq ? 'Редагувати FAQ' : 'Новий FAQ'}</h3>
              <button onClick={() => setShowFaqModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Питання (EN)</label>
                <input
                  type="text"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({...newFaq, question: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Питання (UK)</label>
                <input
                  type="text"
                  value={newFaq.question_uk}
                  onChange={(e) => setNewFaq({...newFaq, question_uk: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Відповідь (EN)</label>
                <textarea
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({...newFaq, answer: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Відповідь (UK)</label>
                <textarea
                  value={newFaq.answer_uk}
                  onChange={(e) => setNewFaq({...newFaq, answer_uk: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категорія</label>
                  <select
                    value={newFaq.category}
                    onChange={(e) => setNewFaq({...newFaq, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="general">Загальне</option>
                    <option value="payments">Оплата</option>
                    <option value="services">Послуги</option>
                    <option value="account">Акаунт</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Порядок</label>
                  <input
                    type="number"
                    value={newFaq.sort_order}
                    onChange={(e) => setNewFaq({...newFaq, sort_order: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowFaqModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button onClick={handleSaveFaq} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                {editingFaq ? 'Оновити' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Commission Rules Section Component
function CommissionRulesSection() {
  const [rules, setRules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [newRule, setNewRule] = useState({
    name: '',
    commission_type: 'percentage',
    commission_value: 15,
    is_global: false,
    category: '',
    city: '',
    priority: 0
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const res = await api.getCommissionRules();
      setRules(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading commission rules:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await api.updateCommissionRule(editingRule.rule_id, newRule);
      } else {
        await api.createCommissionRule(newRule);
      }
      setShowModal(false);
      setEditingRule(null);
      setNewRule({ name: '', commission_type: 'percentage', commission_value: 15, is_global: false, category: '', city: '', priority: 0 });
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Помилка при збереженні');
    }
  };

  const handleDelete = async (ruleId) => {
    if (window.confirm('Видалити це правило?')) {
      try {
        await api.deleteCommissionRule(ruleId);
        loadRules();
      } catch (error) {
        console.error('Error deleting rule:', error);
      }
    }
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setNewRule({
      name: rule.name,
      commission_type: rule.commission_type,
      commission_value: rule.commission_value,
      is_global: rule.is_global,
      category: rule.category || '',
      city: rule.city || '',
      priority: rule.priority
    });
    setShowModal(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Percent className="w-5 h-5 text-green-600" />
          Правила комісій
        </h2>
        <button
          onClick={() => { setEditingRule(null); setShowModal(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          data-testid="add-commission-rule-btn"
        >
          <Plus className="w-4 h-4" />
          Додати правило
        </button>
      </div>

      <div className="divide-y">
        {rules.length === 0 && (
          <p className="py-4 text-gray-500 text-center">Немає правил комісій. Буде застосовано глобальне значення.</p>
        )}
        {rules.map(rule => (
          <div key={rule.rule_id} className="py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{rule.name}</p>
              <p className="text-sm text-gray-500">
                {rule.commission_type === 'percentage' ? `${rule.commission_value}%` : `$${rule.commission_value}`}
                {rule.is_global && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Глобальне</span>}
                {rule.category && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{rule.category}</span>}
                {rule.city && <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">{rule.city}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(rule)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(rule.rule_id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editingRule ? 'Редагувати правило' : 'Нове правило комісії'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва правила</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Наприклад: Комісія для прибирання"
                  data-testid="rule-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                  <select
                    value={newRule.commission_type}
                    onChange={(e) => setNewRule({...newRule, commission_type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="percentage">Відсоток (%)</option>
                    <option value="fixed">Фіксована сума ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Значення</label>
                  <input
                    type="number"
                    value={newRule.commission_value}
                    onChange={(e) => setNewRule({...newRule, commission_value: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                    data-testid="rule-value-input"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_global"
                  checked={newRule.is_global}
                  onChange={(e) => setNewRule({...newRule, is_global: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="is_global" className="text-sm text-gray-700">Глобальне правило (застосовується до всіх)</label>
              </div>
              {!newRule.is_global && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Категорія (опціонально)</label>
                    <select
                      value={newRule.category}
                      onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Всі категорії</option>
                      <option value="handyman_plumbing">Сантехніка</option>
                      <option value="handyman_electrical">Електрика</option>
                      <option value="cleaning_regular">Прибирання</option>
                      <option value="moving_local">Переїзд</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Місто (опціонально)</label>
                    <input
                      type="text"
                      value={newRule.city}
                      onChange={(e) => setNewRule({...newRule, city: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Наприклад: Київ"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пріоритет (вищий = специфічніший)</label>
                <input
                  type="number"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({...newRule, priority: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700" data-testid="save-rule-btn">
                {editingRule ? 'Оновити' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Verification Section Component
function VerificationSection() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await api.getPendingDocuments();
      setDocuments(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (docId, approved, reason = '') => {
    try {
      await api.verifyDocument(docId, approved, reason);
      loadDocuments();
      alert(approved ? 'Документ схвалено!' : 'Документ відхилено');
    } catch (error) {
      console.error('Error verifying document:', error);
      alert('Помилка');
    }
  };

  const getDocTypeName = (type) => {
    const types = {
      'id_card': 'Посвідчення особи',
      'passport': 'Паспорт',
      'drivers_license': 'Водійське посвідчення',
      'insurance': 'Страховка',
      'certificate': 'Сертифікат',
      'background_check': 'Background check'
    };
    return types[type] || type;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Check className="w-5 h-5 text-blue-600" />
        Верифікація виконавців ({documents.length} очікують)
      </h2>

      {loading ? (
        <p className="text-gray-500 text-center py-4">Завантаження...</p>
      ) : documents.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Немає документів на розгляді</p>
      ) : (
        <div className="divide-y">
          {documents.map(doc => (
            <div key={doc.document_id} className="py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{doc.user?.name || 'Невідомий'}</p>
                  <p className="text-sm text-gray-500">{doc.user?.email}</p>
                  <p className="text-sm text-blue-600 mt-1">{getDocTypeName(doc.document_type)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerify(doc.document_id, true)}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    data-testid={`approve-doc-${doc.document_id}`}
                  >
                    Схвалити
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Причина відхилення:');
                      if (reason) handleVerify(doc.document_id, false, reason);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Відхилити
                  </button>
                </div>
              </div>
              {doc.file_data && (
                <div className="mt-2">
                  <img src={doc.file_data} alt="Document" className="max-w-xs rounded-lg border" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Refunds Section Component
function RefundsSection() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    try {
      const res = await api.getRefunds('requested');
      setRefunds(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading refunds:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (refundId, approved, reason = '') => {
    try {
      await api.approveRefund(refundId, approved, reason);
      loadRefunds();
      alert(approved ? 'Повернення схвалено!' : 'Повернення відхилено');
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Помилка');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-red-600" />
        Запити на повернення ({refunds.length})
      </h2>

      {loading ? (
        <p className="text-gray-500 text-center py-4">Завантаження...</p>
      ) : refunds.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Немає запитів на повернення</p>
      ) : (
        <div className="divide-y">
          {refunds.map(refund => (
            <div key={refund.refund_id} className="py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">${refund.amount}</p>
                  <p className="text-sm text-gray-500">{refund.user?.name || 'Користувач'} • {refund.user?.email}</p>
                  <p className="text-sm text-gray-600 mt-1">Причина: {refund.reason}</p>
                  {refund.booking && (
                    <p className="text-xs text-gray-400">Замовлення: {refund.booking.booking_id}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRefund(refund.refund_id, true)}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Схвалити
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Причина відхилення:');
                      if (reason) handleRefund(refund.refund_id, false, reason);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Відхилити
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Settings Panel Component
function SettingsPanel() {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', price: '', duration: '', category: 'handyman_plumbing' });
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [applyCommission, setApplyCommission] = useState(false);
  const [allowSelection, setAllowSelection] = useState(true);
  // New settings
  const [showRatings, setShowRatings] = useState(true);
  const [allowReviews, setAllowReviews] = useState(true);
  const [showExecutorPhone, setShowExecutorPhone] = useState(false);
  const [showPricing, setShowPricing] = useState(true);
  const [allowPayment, setAllowPayment] = useState(false);
  const [showClientPhone, setShowClientPhone] = useState(true);
  const [allowPriceChange, setAllowPriceChange] = useState(false);
  const [showAddress, setShowAddress] = useState(true);
  // Password management
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordInfo, setPasswordInfo] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [usersRes, settingsRes] = await Promise.all([
        api.getUsers().catch(() => ({ data: [] })),
        api.getAdminSettings().catch(() => ({ data: null }))
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : (Array.isArray(usersRes) ? usersRes : []));
      
      const settingsData = settingsRes.data || settingsRes;
      if (settingsData) {
        setSettings(settingsData);
        setCommissionPercent(settingsData.admin_commission_percentage || 0);
        setApplyCommission(settingsData.apply_admin_commission || false);
        setAllowSelection(settingsData.allow_client_executor_selection !== false);
        setShowRatings(settingsData.show_executor_ratings_to_client !== false);
        setAllowReviews(settingsData.allow_client_reviews !== false);
        setShowExecutorPhone(settingsData.show_executor_phone_to_client || false);
        setShowPricing(settingsData.show_pricing_to_client !== false);
        setAllowPayment(settingsData.allow_client_payment || false);
        setShowClientPhone(settingsData.show_client_phone_to_executor !== false);
        setAllowPriceChange(settingsData.allow_executor_price_change || false);
        setShowAddress(settingsData.show_task_address_to_executor !== false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId) => {
    try {
      await api.blockUser(userId, 'Blocked by admin');
      loadSettings();
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await api.unblockUser(userId);
      loadSettings();
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Ви впевнені, що хочете видалити цього користувача?')) {
      try {
        await api.deleteUser(userId);
        loadSettings();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const openPasswordModal = async (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setPasswordInfo(null);
    setShowPasswordModal(true);
    
    // Load password info
    try {
      const res = await api.viewUserPassword(user.user_id);
      setPasswordInfo(res.data || res);
    } catch (error) {
      console.error('Error loading password info:', error);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Пароль має бути не менше 6 символів');
      return;
    }
    
    try {
      await api.resetUserPassword(selectedUser.user_id, newPassword);
      alert('Пароль успішно змінено!');
      setShowPasswordModal(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Помилка при зміні пароля');
    }
  };

  const handleUpdateRole = async (userId, role) => {
    try {
      await api.updateUserRole(userId, role);
      loadSettings();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await api.createService({
        ...newService,
        price: parseFloat(newService.price),
        duration: parseInt(newService.duration),
        available: true
      });
      setShowAddService(false);
      setNewService({ name: '', description: '', price: '', duration: '', category: 'handyman_plumbing' });
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  const handleSaveCommission = async () => {
    try {
      await api.updateFeatureSettings({
        admin_commission_percentage: commissionPercent,
        apply_admin_commission: applyCommission,
        allow_client_executor_selection: allowSelection,
        show_executor_ratings_to_client: showRatings,
        allow_client_reviews: allowReviews,
        show_executor_phone_to_client: showExecutorPhone,
        show_pricing_to_client: showPricing,
        allow_client_payment: allowPayment,
        show_client_phone_to_executor: showClientPhone,
        allow_executor_price_change: allowPriceChange,
        show_task_address_to_executor: showAddress
      });
      alert('Налаштування збережено!');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const ToggleSwitch = ({ value, onChange, label, description }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-center">Завантаження налаштувань...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Налаштування системи</h1>
      
      {/* Commission Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-blue-600" />
          Комісія та ціноутворення
        </h2>
        <div className="space-y-4">
          <ToggleSwitch
            value={applyCommission}
            onChange={setApplyCommission}
            label="Застосовувати комісію"
            description="Додавати націнку до цін виконавців"
          />
          
          {applyCommission && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Відсоток комісії</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border rounded-lg"
                  min="0"
                  max="100"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-green-600" />
          Налаштування для клієнтів
        </h2>
        <div className="space-y-2">
          <ToggleSwitch
            value={allowSelection}
            onChange={setAllowSelection}
            label="Вибір виконавця"
            description="Дозволити клієнтам обирати виконавця"
          />
          <ToggleSwitch
            value={showRatings}
            onChange={setShowRatings}
            label="Показувати рейтинги"
            description="Показувати рейтинги виконавців клієнтам"
          />
          <ToggleSwitch
            value={allowReviews}
            onChange={setAllowReviews}
            label="Дозволити відгуки"
            description="Клієнти можуть залишати відгуки"
          />
          <ToggleSwitch
            value={showExecutorPhone}
            onChange={setShowExecutorPhone}
            label="Показувати телефон виконавця"
            description="Клієнти бачать телефон виконавця"
          />
          <ToggleSwitch
            value={showPricing}
            onChange={setShowPricing}
            label="Показувати ціни"
            description="Показувати ціни клієнтам"
          />
          <ToggleSwitch
            value={allowPayment}
            onChange={setAllowPayment}
            label="Онлайн оплата"
            description="Дозволити онлайн оплату"
          />
        </div>
      </div>

      {/* Executor Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-600" />
          Налаштування для виконавців
        </h2>
        <div className="space-y-2">
          <ToggleSwitch
            value={showClientPhone}
            onChange={setShowClientPhone}
            label="Показувати телефон клієнта"
            description="Виконавці бачать телефон клієнта"
          />
          <ToggleSwitch
            value={allowPriceChange}
            onChange={setAllowPriceChange}
            label="Зміна ціни"
            description="Виконавці можуть пропонувати нову ціну"
          />
          <ToggleSwitch
            value={showAddress}
            onChange={setShowAddress}
            label="Показувати адресу"
            description="Виконавці бачать адресу завдання"
          />
        </div>
      </div>

      <button
        onClick={handleSaveCommission}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
      >
        Зберегти всі налаштування
      </button>

      {/* Payment Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Налаштування оплати (Stripe)
        </h2>
        <div className="space-y-2">
          <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700 mb-4">
            Для активації онлайн оплат налаштуйте Stripe API ключі
          </div>
          <ToggleSwitch
            value={settings?.enable_stripe_payments || false}
            onChange={(v) => setSettings({...settings, enable_stripe_payments: v})}
            label="Увімкнути Stripe"
            description="Дозволити онлайн оплати через Stripe"
          />
          <ToggleSwitch
            value={settings?.use_payment_hold || false}
            onChange={(v) => setSettings({...settings, use_payment_hold: v})}
            label="Hold платежів"
            description="Заморожувати кошти до завершення роботи"
          />
          <ToggleSwitch
            value={settings?.enable_tips || false}
            onChange={(v) => setSettings({...settings, enable_tips: v})}
            label="Чайові"
            description="Дозволити клієнтам залишати чайові"
          />
          <ToggleSwitch
            value={settings?.enable_stripe_connect || false}
            onChange={(v) => setSettings({...settings, enable_stripe_connect: v})}
            label="Stripe Connect"
            description="Виплати виконавцям через Connect"
          />
        </div>
      </div>

      {/* Matching Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-600" />
          Геопошук та matching
        </h2>
        <div className="space-y-4">
          <ToggleSwitch
            value={settings?.enable_geo_matching !== false}
            onChange={(v) => setSettings({...settings, enable_geo_matching: v})}
            label="Геопошук"
            description="Шукати виконавців по локації"
          />
          <ToggleSwitch
            value={settings?.show_tasker_distance !== false}
            onChange={(v) => setSettings({...settings, show_tasker_distance: v})}
            label="Відстань"
            description="Показувати відстань до виконавця"
          />
          <ToggleSwitch
            value={settings?.priority_verified_taskers !== false}
            onChange={(v) => setSettings({...settings, priority_verified_taskers: v})}
            label="Пріоритет верифікованим"
            description="Верифіковані виконавці показуються першими"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Радіус пошуку за замовчуванням (км)</label>
            <input
              type="number"
              value={settings?.default_search_radius_km || 25}
              onChange={(e) => setSettings({...settings, default_search_radius_km: parseFloat(e.target.value)})}
              className="w-32 px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Moderation Settings */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Ban className="w-5 h-5 text-purple-600" />
          Модерація
        </h2>
        <div className="space-y-2">
          <ToggleSwitch
            value={settings?.require_profile_approval || false}
            onChange={(v) => setSettings({...settings, require_profile_approval: v})}
            label="Схвалення профілів"
            description="Вимагати схвалення нових виконавців"
          />
          <ToggleSwitch
            value={settings?.require_id_verification || false}
            onChange={(v) => setSettings({...settings, require_id_verification: v})}
            label="Верифікація ID"
            description="Вимагати верифікацію документів"
          />
          <ToggleSwitch
            value={settings?.enable_dispute_system !== false}
            onChange={(v) => setSettings({...settings, enable_dispute_system: v})}
            label="Система спорів"
            description="Дозволити відкривати спори"
          />
        </div>
      </div>

      {/* CMS Content Management */}
      <CMSSection />

      {/* Commission Rules */}
      <CommissionRulesSection />

      {/* Pending Verifications */}
      <VerificationSection />

      {/* Pending Refunds */}
      <RefundsSection />

      {/* Add Service */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-green-600" />
            Services Management
          </h2>
          <button
            onClick={() => setShowAddService(!showAddService)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
        
        {showAddService && (
          <form onSubmit={handleAddService} className="space-y-4 p-4 bg-gray-50 rounded-lg mb-4">
            <input
              type="text"
              placeholder="Service Name"
              value={newService.name}
              onChange={(e) => setNewService({...newService, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <textarea
              placeholder="Description"
              value={newService.description}
              onChange={(e) => setNewService({...newService, description: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Price ($)"
                value={newService.price}
                onChange={(e) => setNewService({...newService, price: e.target.value})}
                className="px-3 py-2 border rounded-lg"
                required
              />
              <input
                type="number"
                placeholder="Duration (min)"
                value={newService.duration}
                onChange={(e) => setNewService({...newService, duration: e.target.value})}
                className="px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <select
              value={newService.category}
              onChange={(e) => setNewService({...newService, category: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="handyman_plumbing">Plumbing</option>
              <option value="handyman_electrical">Electrical</option>
              <option value="handyman_carpentry">Carpentry</option>
              <option value="handyman_painting">Painting</option>
              <option value="cleaning_regular">Regular Cleaning</option>
              <option value="cleaning_deep">Deep Cleaning</option>
              <option value="cleaning_move_out">Move-out Cleaning</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Create Service
              </button>
              <button type="button" onClick={() => setShowAddService(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* User Management */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          Керування користувачами ({users.length})
        </h2>
        <div className="divide-y">
          {users.map(u => (
            <div key={u.user_id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{u.name}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'provider' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {u.role}
                  </span>
                  {u.is_blocked && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">Заблоковано</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={(e) => handleUpdateRole(u.user_id, e.target.value)}
                  className="text-sm px-2 py-1 border rounded"
                >
                  <option value="client">Клієнт</option>
                  <option value="provider">Виконавець</option>
                  <option value="admin">Адмін</option>
                </select>
                {!u.is_blocked ? (
                  <button
                    onClick={() => handleBlockUser(u.user_id)}
                    className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                    title="Заблокувати"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnblockUser(u.user_id)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="Розблокувати"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteUser(u.user_id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Видалити"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openPasswordModal(u)}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1"
                  title="Переглянути/змінити пароль"
                  data-testid={`password-btn-${u.user_id}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Password Management Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Пароль користувача</h3>
              <button onClick={() => setShowPasswordModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Користувач:</strong> {selectedUser.name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {selectedUser.email}
                </p>
              </div>
              
              {passwordInfo && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">Поточний пароль:</p>
                  <p className="text-lg font-mono font-bold text-blue-700" data-testid="current-password-display">
                    {passwordInfo.password || 'Не збережено'}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Встановити новий пароль
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Мінімум 6 символів"
                  data-testid="new-password-input"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Закрити
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                data-testid="reset-password-button"
              >
                Змінити пароль
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Services Panel with Admin CRUD and Client Booking
function ServicesPanel({ services, user, onRefresh }) {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'projects'
  const [bookingData, setBookingData] = useState({ date: '', time: '', address: '', problem_description: '', notes: '' });
  const [serviceData, setServiceData] = useState({
    name: '', description: '', price: '', duration: '', category: 'handyman_plumbing', image: '', gallery: []
  });
  const [newProject, setNewProject] = useState({ description: '', date: '', photos: [], duration: '', price: '' });
  const [loading, setLoading] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const imageInputRef = React.useRef(null);
  const projectImageRef = React.useRef(null);

  const isAdmin = user?.role === 'admin';
  const canBook = user?.role === 'client' || user?.role === 'admin';

  useEffect(() => {
    if (user?.role === 'client') loadMyBookings();
  }, [user]);

  const loadMyBookings = async () => {
    try {
      const res = await api.getBookings();
      const bookings = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setMyBookings(bookings.filter(b => b.client_id === user.user_id));
    } catch (error) { console.error('Error loading bookings:', error); }
  };

  // Admin: Create/Edit Service
  const openServiceModal = (service = null) => {
    if (service) {
      setEditMode(true);
      setServiceData({
        name: service.name || '',
        description: service.description || '',
        price: service.price?.toString() || '',
        duration: service.duration?.toString() || '',
        category: service.category || 'handyman_plumbing',
        image: service.image || '',
        gallery: service.gallery || []
      });
      setSelectedService(service);
    } else {
      setEditMode(false);
      setServiceData({ name: '', description: '', price: '', duration: '', category: 'handyman_plumbing', image: '', gallery: [] });
      setSelectedService(null);
    }
    setActiveTab('info');
    setShowServiceModal(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Максимум 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setServiceData({...serviceData, image: reader.result});
    reader.readAsDataURL(file);
  };

  const handleProjectImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => setNewProject(prev => ({...prev, photos: [...prev.photos, reader.result]}));
      reader.readAsDataURL(file);
    });
  };

  const addProject = () => {
    if (!newProject.description) { alert('Введіть опис проекту'); return; }
    setServiceData({
      ...serviceData,
      gallery: [...serviceData.gallery, { ...newProject }]
    });
    setNewProject({ description: '', date: '', photos: [], duration: '', price: '' });
  };

  const removeProject = (index) => {
    setServiceData({
      ...serviceData,
      gallery: serviceData.gallery.filter((_, i) => i !== index)
    });
  };

  const handleSaveService = async () => {
    if (!serviceData.name || !serviceData.price) { alert('Заповніть назву та ціну'); return; }
    setLoading(true);
    try {
      const data = {
        name: serviceData.name,
        description: serviceData.description,
        price: parseFloat(serviceData.price),
        duration: parseInt(serviceData.duration) || 60,
        category: serviceData.category,
        image: serviceData.image,
        gallery: serviceData.gallery,
        available: true
      };
      if (editMode && selectedService) {
        await api.updateServiceEnhanced(selectedService.service_id, data);
        alert('Послугу оновлено!');
      } else {
        await api.createServiceEnhanced(data);
        alert('Послугу створено!');
      }
      setShowServiceModal(false);
      onRefresh();
    } catch (error) { console.error('Error saving service:', error); alert('Помилка збереження'); }
    finally { setLoading(false); }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Видалити цю послугу?')) return;
    try {
      await api.deleteService(serviceId);
      onRefresh();
      alert('Послугу видалено!');
    } catch (error) { console.error('Error deleting service:', error); alert('Помилка видалення'); }
  };

  // Client: Booking
  const openBookingModal = (service) => {
    setSelectedService(service);
    setBookingData({ date: '', time: '', address: '', problem_description: '', notes: '' });
    setShowBookingModal(true);
  };

  const handleCreateBooking = async () => {
    if (!bookingData.date || !bookingData.time || !bookingData.address) {
      alert('Заповніть обов\'язкові поля: дата, час, адреса'); return;
    }
    setLoading(true);
    try {
      await api.clientCreateBooking({
        service_id: selectedService.service_id,
        ...bookingData
      });
      setShowBookingModal(false);
      loadMyBookings();
      onRefresh();
      alert('Замовлення створено!');
    } catch (error) { console.error('Error creating booking:', error); alert('Помилка створення'); }
    finally { setLoading(false); }
  };

  // View Projects
  const openProjectsView = (service) => {
    setSelectedService(service);
    setShowProjectsModal(true);
  };

  const categories = [
    { value: 'handyman_plumbing', label: 'Сантехніка' },
    { value: 'handyman_electrical', label: 'Електрика' },
    { value: 'cleaning_regular', label: 'Прибирання' },
    { value: 'cleaning_deep', label: 'Генеральне прибирання' },
    { value: 'assembly_furniture', label: 'Збірка меблів' },
    { value: 'other', label: 'Інше' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Послуги</h1>
        {isAdmin && (
          <button
            onClick={() => openServiceModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            data-testid="add-service-button"
          >
            <Plus className="w-5 h-5" />
            Додати послугу
          </button>
        )}
      </div>

      {/* Client's draft bookings */}
      {canBook && !isAdmin && myBookings.filter(b => b.status === 'draft').length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Ваші чернетки замовлень</h3>
          <div className="space-y-2">
            {myBookings.filter(b => b.status === 'draft').map(booking => (
              <div key={booking.booking_id} className="bg-white rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{booking.title}</p>
                  <p className="text-sm text-gray-500">{booking.date} о {booking.time}</p>
                </div>
                <button
                  onClick={() => api.clientSubmitBooking(booking.booking_id).then(() => { loadMyBookings(); onRefresh(); alert('Замовлення відправлено!'); })}
                  className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  Відправити
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Services Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map(service => (
          <div key={service.service_id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {service.image ? (
              <img src={service.image} alt={service.name} className="h-40 w-full object-cover" />
            ) : (
              <div className="h-40 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Wrench className="w-12 h-12 text-white/80" />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{service.name}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-blue-600">${service.price}</span>
                <span className="text-sm text-gray-500">{service.duration} хв</span>
              </div>
              
              {/* Projects badge */}
              {service.gallery?.length > 0 && (
                <button
                  onClick={() => openProjectsView(service)}
                  className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Camera className="w-4 h-4" />
                  Наші проекти ({service.gallery.length})
                </button>
              )}

              <div className="mt-3 flex gap-2">
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => openServiceModal(service)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-1"
                      data-testid={`edit-service-${service.service_id}`}
                    >
                      <Edit className="w-4 h-4" />
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.service_id)}
                      className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                      data-testid={`delete-service-${service.service_id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : canBook && (
                  <button
                    onClick={() => openBookingModal(service)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                    data-testid={`book-service-${service.service_id}`}
                  >
                    Замовити
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border">
            Послуги не знайдено
          </div>
        )}
      </div>

      {/* Admin: Service Create/Edit Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editMode ? 'Редагувати послугу' : 'Нова послуга'}</h3>
              <button onClick={() => setShowServiceModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="border-b flex">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-3 font-medium ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              >
                Інформація
              </button>
              <button
                onClick={() => setActiveTab('projects')}
                className={`px-4 py-3 font-medium ${activeTab === 'projects' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              >
                Наші проекти ({serviceData.gallery?.length || 0})
              </button>
            </div>

            {activeTab === 'info' && (
              <div className="p-4 space-y-4">
                {/* Main Photo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Головне фото</label>
                  <div className="flex items-center gap-4">
                    {serviceData.image ? (
                      <img src={serviceData.image} alt="Preview" className="w-32 h-24 object-cover rounded-lg" />
                    ) : (
                      <div className="w-32 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Camera className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Завантажити фото
                      </button>
                      {serviceData.image && (
                        <button
                          onClick={() => setServiceData({...serviceData, image: ''})}
                          className="ml-2 text-red-600 hover:underline text-sm"
                        >
                          Видалити
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Назва послуги *</label>
                  <input
                    type="text"
                    value={serviceData.name}
                    onChange={(e) => setServiceData({...serviceData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Напр: Ремонт сантехніки"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Категорія</label>
                  <select
                    value={serviceData.category}
                    onChange={(e) => setServiceData({...serviceData, category: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                  <textarea
                    value={serviceData.description}
                    onChange={(e) => setServiceData({...serviceData, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="Детальний опис послуги..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ціна ($) *</label>
                    <input
                      type="number"
                      value={serviceData.price}
                      onChange={(e) => setServiceData({...serviceData, price: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Тривалість (хв)</label>
                    <input
                      type="number"
                      value={serviceData.duration}
                      onChange={(e) => setServiceData({...serviceData, duration: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="60"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="p-4 space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-3">Додати проект</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Опис роботи *</label>
                      <textarea
                        value={newProject.description}
                        onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={2}
                        placeholder="Опишіть виконану роботу..."
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                        <input
                          type="date"
                          value={newProject.date}
                          onChange={(e) => setNewProject({...newProject, date: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Термін (днів)</label>
                        <input
                          type="text"
                          value={newProject.duration}
                          onChange={(e) => setNewProject({...newProject, duration: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="3"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ціна ($)</label>
                        <input
                          type="text"
                          value={newProject.price}
                          onChange={(e) => setNewProject({...newProject, price: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Фото проекту</label>
                      <input ref={projectImageRef} type="file" accept="image/*" multiple onChange={handleProjectImageUpload} className="hidden" />
                      <div className="flex flex-wrap gap-2">
                        {newProject.photos.map((photo, idx) => (
                          <div key={idx} className="relative">
                            <img src={photo} alt="" className="w-16 h-16 object-cover rounded" />
                            <button
                              onClick={() => setNewProject({...newProject, photos: newProject.photos.filter((_, i) => i !== idx)})}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs"
                            >×</button>
                          </div>
                        ))}
                        <button
                          onClick={() => projectImageRef.current?.click()}
                          className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center hover:border-blue-500"
                        >
                          <Plus className="w-6 h-6 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={addProject}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Додати проект
                    </button>
                  </div>
                </div>

                {/* Existing Projects */}
                {serviceData.gallery?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Додані проекти</h4>
                    {serviceData.gallery.map((project, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 relative">
                        <button
                          onClick={() => removeProject(idx)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <p className="font-medium text-gray-900 pr-8">{project.description}</p>
                        <div className="flex gap-4 text-sm text-gray-500 mt-1">
                          {project.date && <span>Дата: {project.date}</span>}
                          {project.duration && <span>Термін: {project.duration} дн.</span>}
                          {project.price && <span>Ціна: ${project.price}</span>}
                        </div>
                        {project.photos?.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {project.photos.map((photo, pIdx) => (
                              <img key={pIdx} src={photo} alt="" className="w-12 h-12 object-cover rounded" />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button
                onClick={handleSaveService}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Зберігаю...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects View Modal */}
      {showProjectsModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Наші проекти - {selectedService.name}</h3>
              <button onClick={() => setShowProjectsModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {selectedService.gallery?.map((project, idx) => (
                <div key={idx} className="border rounded-lg overflow-hidden">
                  {project.photos?.length > 0 && (
                    <div className="flex overflow-x-auto gap-1">
                      {project.photos.map((photo, pIdx) => (
                        <img key={pIdx} src={photo} alt="" className="h-48 object-cover flex-shrink-0" />
                      ))}
                    </div>
                  )}
                  <div className="p-4">
                    <p className="font-medium text-gray-900">{project.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                      {project.date && <span>Дата: {project.date}</span>}
                      {project.duration && <span>Термін: {project.duration} дн.</span>}
                      {project.price && <span className="text-green-600 font-medium">Ціна: ${project.price}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {(!selectedService.gallery || selectedService.gallery.length === 0) && (
                <p className="text-center text-gray-500 py-8">Немає проектів</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client: Booking Modal */}
      {showBookingModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Замовити послугу</h3>
              <button onClick={() => setShowBookingModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-900">{selectedService.name}</p>
                <p className="text-sm text-blue-700">Ціна: ${selectedService.price}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
                  <input type="date" value={bookingData.date} onChange={(e) => setBookingData({...bookingData, date: e.target.value})} className="w-full px-3 py-2 border rounded-lg" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Час *</label>
                  <input type="time" value={bookingData.time} onChange={(e) => setBookingData({...bookingData, time: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адреса *</label>
                <input type="text" value={bookingData.address} onChange={(e) => setBookingData({...bookingData, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Вулиця, будинок, квартира" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис проблеми</label>
                <textarea value={bookingData.problem_description} onChange={(e) => setBookingData({...bookingData, problem_description: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Детально опишіть проблему..." />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowBookingModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Скасувати</button>
              <button onClick={handleCreateBooking} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Створюю...' : 'Створити замовлення'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Provider Tasks Panel with Status Management
function ProviderTasksPanel({ user, onRefresh }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeData, setCompleteData] = useState({ actual_hours: '', expenses: '', notes: '' });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await api.getProviderTasks();
      const data = res.data || res;
      setTasks(data.tasks || []);
      setCommissionPercent(data.commission_percent || 0);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTask = async (taskId) => {
    try {
      await api.acceptTask(taskId);
      loadTasks();
      alert('Завдання прийнято!');
    } catch (error) {
      console.error('Error accepting task:', error);
      alert('Помилка: ' + (error.response?.data?.detail || 'Не вдалося прийняти'));
    }
  };

  const handleStartTask = async (taskId) => {
    try {
      await api.startTask(taskId);
      loadTasks();
      alert('Завдання розпочато!');
    } catch (error) {
      console.error('Error starting task:', error);
      alert('Помилка: ' + (error.response?.data?.detail || 'Не вдалося розпочати'));
    }
  };

  const handleDeclineTask = async (taskId) => {
    const reason = prompt('Причина відмови:');
    if (!reason) return;
    try {
      await api.declineTask(taskId, reason);
      loadTasks();
      alert('Завдання відхилено');
    } catch (error) {
      console.error('Error declining task:', error);
      alert('Помилка відхилення');
    }
  };

  const openCompleteModal = (task) => {
    setSelectedTask(task);
    setCompleteData({ actual_hours: '', expenses: '', notes: '' });
    setShowCompleteModal(true);
  };

  const handleCompleteTask = async () => {
    if (!completeData.actual_hours) {
      alert('Вкажіть кількість годин');
      return;
    }
    try {
      await api.completeTask(selectedTask.task_id, {
        actual_hours: parseFloat(completeData.actual_hours),
        expenses: completeData.expenses ? parseFloat(completeData.expenses) : 0,
        notes: completeData.notes
      });
      setShowCompleteModal(false);
      loadTasks();
      onRefresh();
      alert('Завдання завершено!');
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Помилка: ' + (error.response?.data?.detail || 'Не вдалося завершити'));
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'assigned': 'Призначено',
      'accepted': 'Прийнято',
      'in_progress': 'В роботі',
      'completed': 'Завершено',
      'paid': 'Оплачено',
      'declined': 'Відхилено',
      'cancelled_by_client': 'Скасовано клієнтом',
      'cancelled_by_tasker': 'Скасовано виконавцем'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'assigned': 'bg-yellow-100 text-yellow-800',
      'accepted': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800',
      'paid': 'bg-green-100 text-green-800',
      'declined': 'bg-red-100 text-red-800',
      'cancelled_by_client': 'bg-red-100 text-red-800',
      'cancelled_by_tasker': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Мої завдання</h1>
        {commissionPercent > 0 && (
          <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
            Комісія платформи: {commissionPercent}%
          </div>
        )}
      </div>

      <div className="space-y-4">
        {tasks.map(task => (
          <div key={task.task_id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{task.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
              </div>

              {/* Task Details */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {task.booking?.date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {task.booking.date} о {task.booking.time}
                  </div>
                )}
                {task.booking?.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {task.booking.address}
                  </div>
                )}
              </div>

              {/* Price with Commission */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Ціна замовлення:</span>
                  <span className="font-medium">${task.original_price}</span>
                </div>
                {commissionPercent > 0 && (
                  <>
                    <div className="flex justify-between items-center text-orange-600">
                      <span>Комісія ({commissionPercent}%):</span>
                      <span>-${task.commission_amount}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600 font-semibold border-t mt-2 pt-2">
                      <span>Ваш заробіток:</span>
                      <span>${task.provider_earnings}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {task.status === 'assigned' && (
                  <>
                    <button
                      onClick={() => handleAcceptTask(task.task_id)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                      data-testid={`accept-task-${task.task_id}`}
                    >
                      Прийняти
                    </button>
                    <button
                      onClick={() => handleDeclineTask(task.task_id)}
                      className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      Відхилити
                    </button>
                  </>
                )}
                {task.status === 'accepted' && (
                  <button
                    onClick={() => handleStartTask(task.task_id)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                    data-testid={`start-task-${task.task_id}`}
                  >
                    Розпочати роботу
                  </button>
                )}
                {task.status === 'in_progress' && (
                  <button
                    onClick={() => openCompleteModal(task)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                    data-testid={`complete-task-${task.task_id}`}
                  >
                    Завершити роботу
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
            Немає завдань
          </div>
        )}
      </div>

      {/* Complete Task Modal */}
      {showCompleteModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Завершення роботи</h3>
              <button onClick={() => setShowCompleteModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-900">{selectedTask.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Кількість годин *</label>
                <input
                  type="number"
                  step="0.5"
                  value={completeData.actual_hours}
                  onChange={(e) => setCompleteData({...completeData, actual_hours: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Наприклад: 2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Витрати на матеріали ($)</label>
                <input
                  type="number"
                  value={completeData.expenses}
                  onChange={(e) => setCompleteData({...completeData, expenses: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Примітки</label>
                <textarea
                  value={completeData.notes}
                  onChange={(e) => setCompleteData({...completeData, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Опис виконаної роботи..."
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button onClick={handleCompleteTask} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Завершити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Profile Panel Component with Photo Upload, Availability Calendar & Service Zone
function ProfilePanel({ user, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [providerStats, setProviderStats] = useState(null);
  const [executorProfile, setExecutorProfile] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: '', skills: [], hourly_rate: '', experience_years: '', service_zones: [], service_radius_km: ''
  });
  const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '09:00', end_time: '18:00' });
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (user?.role === 'provider') {
      loadProviderData();
    }
  }, [user]);

  const loadProviderData = async () => {
    try {
      const [statsRes, profileRes, availRes] = await Promise.all([
        api.getProviderStats(user.user_id).catch(() => null),
        api.getExecutorProfile(user.user_id).catch(() => null),
        api.getExecutorAvailability(user.user_id).catch(() => ({ data: [] }))
      ]);
      if (statsRes) setProviderStats(statsRes.data || statsRes);
      if (profileRes?.data || profileRes) {
        const profile = profileRes.data || profileRes;
        setExecutorProfile(profile);
        setProfileData({
          bio: profile.bio || '',
          skills: profile.skills || [],
          hourly_rate: profile.hourly_rate?.toString() || '',
          experience_years: profile.experience_years?.toString() || '',
          service_zones: profile.service_zones || [],
          service_radius_km: profile.service_radius_km?.toString() || ''
        });
      }
      setAvailability(availRes.data || availRes || []);
    } catch (error) {
      console.error('Error loading provider data:', error);
    }
  };

  const loadProviderStats = async () => {
    try {
      const res = await api.getProviderStats(user.user_id);
      setProviderStats(res.data || res);
    } catch (error) {
      console.error('Error loading provider stats:', error);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Виберіть файл зображення');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальний розмір файлу 5MB');
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        await api.updateProfilePhoto(base64);
        onUpdate();
        alert('Фото оновлено!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Помилка при завантаженні фото');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Профіль</h1>
      
      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-blue-600" />
              </div>
            )}
            <button 
              onClick={handlePhotoClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-50"
              title="Змінити фото"
              data-testid="change-photo-button"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-gray-500 capitalize">{user?.role === 'provider' ? 'Виконавець' : user?.role === 'admin' ? 'Адміністратор' : 'Клієнт'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium text-gray-900">{user?.email}</p>
          </div>
          {user?.phone && (
            <div>
              <label className="text-sm text-gray-500">Телефон</label>
              <p className="font-medium text-gray-900">{user?.phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Provider Stats */}
      {user?.role === 'provider' && providerStats && (
        <>
          {/* Statistics */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Статистика
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{providerStats.stats?.total_completed_tasks || 0}</p>
                <p className="text-sm text-gray-600">Виконано завдань</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{providerStats.stats?.total_hours_worked || 0}</p>
                <p className="text-sm text-gray-600">Годин роботи</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">${providerStats.stats?.total_earnings || 0}</p>
                <p className="text-sm text-gray-600">Заробіток</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <p className="text-2xl font-bold text-purple-600">{providerStats.stats?.average_rating || 0}</p>
                </div>
                <p className="text-sm text-gray-600">{providerStats.stats?.total_reviews || 0} відгуків</p>
              </div>
            </div>
          </div>

          {/* Reviews */}
          {providerStats.reviews?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Останні відгуки
              </h3>
              <div className="space-y-3">
                {providerStats.reviews.map((review, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archived Tasks */}
          {providerStats.archived_tasks?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-gray-500" />
                Архів завдань
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {providerStats.archived_tasks.map((task, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.scheduled_date || 'Без дати'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      task.status === 'paid' ? 'bg-green-100 text-green-800' :
                      task.status?.includes('cancelled') ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status === 'paid' ? 'Оплачено' : 
                       task.status === 'cancelled_by_client' ? 'Скасовано клієнтом' :
                       task.status === 'cancelled_by_tasker' ? 'Скасовано виконавцем' :
                       task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Zones */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Зони обслуговування
              </h3>
              <button 
                onClick={() => setShowEditProfile(true)}
                className="text-blue-600 text-sm hover:underline"
              >
                Редагувати
              </button>
            </div>
            {executorProfile?.service_zones?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {executorProfile.service_zones.map((zone, idx) => (
                  <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {zone}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Зони не вказані. Натисніть "Редагувати" щоб додати.</p>
            )}
            {executorProfile?.service_radius_km && (
              <p className="text-sm text-gray-600 mt-2">Радіус обслуговування: {executorProfile.service_radius_km} км</p>
            )}
          </div>

          {/* Availability Calendar */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Графік роботи
              </h3>
              <button 
                onClick={() => setShowAvailability(true)}
                className="text-blue-600 text-sm hover:underline"
              >
                Налаштувати
              </button>
            </div>
            {availability.length > 0 ? (
              <div className="space-y-2">
                {['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'].map((day, idx) => {
                  const daySlots = availability.filter(s => s.day_of_week === idx);
                  return daySlots.length > 0 ? (
                    <div key={idx} className="flex items-center gap-4 text-sm">
                      <span className="w-24 font-medium text-gray-700">{day}</span>
                      <div className="flex gap-2">
                        {daySlots.map((slot, sIdx) => (
                          <span key={sIdx} className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            {slot.start_time} - {slot.end_time}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Графік не налаштовано. Натисніть "Налаштувати" щоб додати.</p>
            )}
          </div>
        </>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Редагувати профіль</h3>
              <button onClick={() => setShowEditProfile(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Про себе</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Розкажіть про свій досвід..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ставка ($/год)</label>
                  <input
                    type="number"
                    value={profileData.hourly_rate}
                    onChange={(e) => setProfileData({...profileData, hourly_rate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Досвід (років)</label>
                  <input
                    type="number"
                    value={profileData.experience_years}
                    onChange={(e) => setProfileData({...profileData, experience_years: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Зони обслуговування</label>
                <p className="text-xs text-gray-500 mb-2">Введіть райони/зони через кому</p>
                <input
                  type="text"
                  value={profileData.service_zones.join(', ')}
                  onChange={(e) => setProfileData({...profileData, service_zones: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Центр, Оболонь, Подол..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Радіус обслуговування (км)</label>
                <input
                  type="number"
                  value={profileData.service_radius_km}
                  onChange={(e) => setProfileData({...profileData, service_radius_km: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="10"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setShowEditProfile(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Скасувати
              </button>
              <button 
                onClick={async () => {
                  try {
                    await api.createExecutorProfile({
                      bio: profileData.bio,
                      hourly_rate: profileData.hourly_rate ? parseFloat(profileData.hourly_rate) : null,
                      experience_years: profileData.experience_years ? parseInt(profileData.experience_years) : null,
                      service_zones: profileData.service_zones,
                      service_radius_km: profileData.service_radius_km ? parseFloat(profileData.service_radius_km) : null,
                      skills: profileData.skills
                    });
                    setShowEditProfile(false);
                    loadProviderData();
                    alert('Профіль оновлено!');
                  } catch (error) {
                    console.error('Error updating profile:', error);
                    alert('Помилка збереження');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {showAvailability && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Графік роботи</h3>
              <button onClick={() => setShowAvailability(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Add new slot */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3">Додати час роботи</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">День</label>
                    <select
                      value={newSlot.day_of_week}
                      onChange={(e) => setNewSlot({...newSlot, day_of_week: parseInt(e.target.value)})}
                      className="w-full px-2 py-2 border rounded-lg text-sm"
                    >
                      {['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'].map((day, idx) => (
                        <option key={idx} value={idx}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">З</label>
                    <input
                      type="time"
                      value={newSlot.start_time}
                      onChange={(e) => setNewSlot({...newSlot, start_time: e.target.value})}
                      className="w-full px-2 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">До</label>
                    <input
                      type="time"
                      value={newSlot.end_time}
                      onChange={(e) => setNewSlot({...newSlot, end_time: e.target.value})}
                      className="w-full px-2 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.createAvailabilitySlot(newSlot);
                      loadProviderData();
                      alert('Додано!');
                    } catch (error) {
                      console.error('Error adding slot:', error);
                      alert('Помилка');
                    }
                  }}
                  className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Додати
                </button>
              </div>

              {/* Existing slots */}
              {availability.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Поточний графік</h4>
                  <div className="space-y-2">
                    {availability.map((slot, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <span className="text-sm">
                          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'][slot.day_of_week]}: {slot.start_time} - {slot.end_time}
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              await api.deleteAvailabilitySlot(slot.slot_id);
                              loadProviderData();
                            } catch (error) {
                              console.error('Error deleting slot:', error);
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button onClick={() => setShowAvailability(false)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      console.log('Loading dashboard data...');
      const [servicesRes, bookingsRes, tasksRes] = await Promise.all([
        api.getServices().catch(e => { console.error('Services error:', e); return { data: [] }; }),
        api.getBookings().catch(e => { console.error('Bookings error:', e); return { data: [] }; }),
        api.getTasks().catch(e => { console.error('Tasks error:', e); return { data: [] }; }),
      ]);
      
      console.log('Services response:', servicesRes);
      console.log('Bookings response:', bookingsRes);
      console.log('Tasks response:', tasksRes);
      
      // Handle both direct array and {data: array} response formats
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : (Array.isArray(servicesRes) ? servicesRes : []));
      setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : (Array.isArray(bookingsRes) ? bookingsRes : []));
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : (Array.isArray(tasksRes) ? tasksRes : []));

      if (user?.role === 'admin') {
        console.log('Loading admin dashboard...');
        const dashboardRes = await api.getDashboard().catch(e => { console.error('Dashboard error:', e); return { data: null }; });
        console.log('Dashboard response:', dashboardRes);
        setStats(dashboardRes.data || dashboardRes);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      assigned: 'bg-gray-100 text-gray-800',
      accepted: 'bg-blue-100 text-blue-800',
      declined: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'services', icon: Wrench, label: 'Services' },
    { id: 'bookings', icon: Calendar, label: 'Bookings' },
    { id: 'tasks', icon: ClipboardList, label: 'Tasks', roles: ['admin', 'provider'] },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'settings', icon: Settings, label: 'Settings', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(
    item => !item.roles || item.roles.includes(user?.role)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-gray-900">HandyHub</span>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r z-50 transform transition-transform duration-200
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">HandyHub</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {filteredMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.name}!
              </h1>

              {/* Admin Stats */}
              {user?.role === 'admin' && stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Users</p>
                        <p className="text-xl font-bold text-gray-900">{stats.total_users}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Services</p>
                        <p className="text-xl font-bold text-gray-900">{stats.total_services}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Bookings</p>
                        <p className="text-xl font-bold text-gray-900">{stats.total_bookings}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Pending</p>
                        <p className="text-xl font-bold text-gray-900">{stats.pending_bookings}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Bookings */}
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
                  <button 
                    onClick={() => setActiveTab('bookings')}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y">
                  {bookings.slice(0, 5).map(booking => (
                    <div key={booking.booking_id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{booking.service_id}</p>
                        <p className="text-sm text-gray-500">{booking.date} at {booking.time}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                  {bookings.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      No bookings yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && (
            <ServicesPanel 
              services={services} 
              user={user} 
              onRefresh={loadData}
            />
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <BookingsPanel 
              bookings={bookings} 
              user={user} 
              onRefresh={loadData}
              getStatusColor={getStatusColor}
            />
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <ProviderTasksPanel user={user} onRefresh={loadData} />
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-gray-900">Повідомлення</h1>
              <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                Немає повідомлень
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <ProfilePanel user={user} onUpdate={loadData} />
          )}

          {/* Settings Tab (Admin Only) */}
          {activeTab === 'settings' && user?.role === 'admin' && (
            <SettingsPanel />
          )}
        </div>
      </main>
    </div>
  );
}
