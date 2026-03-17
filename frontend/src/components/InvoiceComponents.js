import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  FileText, X, Plus, Send, Calendar, DollarSign, 
  User, Clock, CheckCircle, AlertCircle, Download, Printer
} from 'lucide-react';

// Invoice List Component for Provider
export function ProviderInvoiceList({ onCreateNew }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.getProviderInvoices();
      setInvoices(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { color: 'bg-yellow-100 text-yellow-700', label: 'Очікує оплати' },
      'sent': { color: 'bg-blue-100 text-blue-700', label: 'Відправлено' },
      'paid': { color: 'bg-green-100 text-green-700', label: 'Оплачено' },
      'overdue': { color: 'bg-red-100 text-red-700', label: 'Прострочено' },
      'cancelled': { color: 'bg-gray-100 text-gray-700', label: 'Скасовано' }
    };
    return statusMap[status] || { color: 'bg-gray-100 text-gray-700', label: status };
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Мої інвойси</h2>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Створити інвойс
        </button>
      </div>

      {/* Invoice List */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">Немає інвойсів</p>
          <p className="text-sm text-gray-400 mt-1">Створіть перший інвойс після виконання роботи</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(invoice => {
            const statusInfo = getStatusInfo(invoice.payment_status);
            return (
              <div 
                key={invoice.invoice_id}
                onClick={() => setSelectedInvoice(invoice)}
                className="bg-white rounded-2xl p-4 border cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-500">{invoice.client_info?.name || 'Клієнт'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {formatDate(invoice.invoice_date)}
                  </div>
                  <p className="text-lg font-bold text-green-600">${invoice.total_amount}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSend={loadInvoices}
        />
      )}
    </div>
  );
}

// Invoice Creation Modal
export function InvoiceCreateModal({ isOpen, onClose, bookings, onCreated }) {
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalDescription, setAdditionalDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!selectedBooking) {
      alert('Виберіть бронювання');
      return;
    }

    setLoading(true);
    try {
      await api.createProviderInvoice({
        booking_id: selectedBooking.booking_id,
        additional_charges: additionalCharges,
        additional_charges_description: additionalDescription,
        notes: notes
      });
      if (onCreated) onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert(error.response?.data?.detail || 'Помилка створення інвойсу');
    } finally {
      setLoading(false);
    }
  };

  const completedBookings = bookings.filter(b => 
    b.status === 'completed' || b.status === 'completed_pending_payment'
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Створити інвойс
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Select Booking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Виберіть виконане замовлення
            </label>
            {completedBookings.length === 0 ? (
              <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-xl">
                Немає завершених замовлень для виставлення рахунку
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {completedBookings.map(booking => (
                  <button
                    key={booking.booking_id}
                    onClick={() => setSelectedBooking(booking)}
                    className={`w-full p-3 rounded-xl border text-left transition-colors ${
                      selectedBooking?.booking_id === booking.booking_id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{booking.title || 'Замовлення'}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-500">{booking.date}</p>
                      <p className="text-sm font-medium text-green-600">${booking.total_price}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Additional Charges */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Додаткові витрати (опціонально)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={additionalCharges}
                  onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            {additionalCharges > 0 && (
              <input
                type="text"
                value={additionalDescription}
                onChange={(e) => setAdditionalDescription(e.target.value)}
                className="w-full mt-2 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Опис додаткових витрат (матеріали, транспорт тощо)"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Примітки для клієнта
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 h-20"
              placeholder="Додаткові деталі виконаної роботи..."
            />
          </div>

          {/* Preview */}
          {selectedBooking && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Попередній перегляд</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Базова вартість</span>
                  <span className="font-medium">${selectedBooking.total_price}</span>
                </div>
                {additionalCharges > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Додаткові витрати</span>
                    <span className="font-medium">${additionalCharges}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium text-gray-900">Всього</span>
                  <span className="font-bold text-green-600">
                    ${(selectedBooking.total_price + additionalCharges).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
          >
            Скасувати
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !selectedBooking}
            className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Створити
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Invoice Detail Modal
export function InvoiceDetailModal({ invoice, onClose, onSend }) {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await api.sendInvoice(invoice.invoice_id);
      alert('Інвойс відправлено клієнту');
      if (onSend) onSend();
      onClose();
    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Помилка відправки');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100">Інвойс</p>
              <h3 className="font-bold text-lg">{invoice.invoice_number}</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client Info */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Клієнт</p>
              <p className="font-medium text-gray-900">{invoice.client_info?.name || 'Клієнт'}</p>
              {invoice.client_info?.email && (
                <p className="text-sm text-gray-500">{invoice.client_info.email}</p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Дата створення</p>
              <p className="font-medium text-gray-900">{formatDate(invoice.invoice_date)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Термін оплати</p>
              <p className="font-medium text-gray-900">
                {invoice.due_date ? formatDate(invoice.due_date) : '-'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Деталі</h4>
            <div className="bg-gray-50 rounded-xl divide-y">
              {invoice.line_items?.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.description}</p>
                    <p className="text-sm text-gray-500">x{item.quantity}</p>
                  </div>
                  <p className="font-medium text-gray-900">${item.total}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Підсумок</span>
              <span className="font-medium">${invoice.subtotal || invoice.base_price}</span>
            </div>
            {invoice.service_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Сервісний збір</span>
                <span className="font-medium">${invoice.service_fee}</span>
              </div>
            )}
            {invoice.tip_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Чайові</span>
                <span className="font-medium">${invoice.tip_amount}</span>
              </div>
            )}
            <div className="border-t border-green-200 pt-2 flex justify-between">
              <span className="font-bold text-gray-900">Всього до сплати</span>
              <span className="font-bold text-green-600 text-lg">${invoice.total_amount}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Примітки</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Завантажити
          </button>
          {invoice.payment_status === 'pending' && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Відправити
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProviderInvoiceList;
