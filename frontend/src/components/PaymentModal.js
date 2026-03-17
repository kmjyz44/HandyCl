import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  CreditCard, DollarSign, X, Check, AlertCircle, Copy
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

// Payment Modal for Clients
export function PaymentModal({ isOpen, onClose, booking, onPaymentComplete }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPaymentSettings();
    }
  }, [isOpen]);

  const loadPaymentSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getPublicSettings();
      setPaymentSettings(res.data || res);
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStripePayment = async () => {
    setProcessing(true);
    try {
      const res = await api.createCheckoutSession(booking.booking_id);
      const { checkout_url } = res.data || res;
      if (checkout_url) {
        window.location.href = checkout_url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Error initiating payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleManualPaymentConfirm = () => {
    // In a real app, this would mark the payment as pending verification
    alert(t('payment_instructions') + ' - ' + (selectedMethod === 'zelle' ? 'Zelle' : 'Venmo'));
    if (onPaymentComplete) onPaymentComplete();
    onClose();
  };

  if (!isOpen) return null;

  const enabledMethods = [];
  if (paymentSettings?.payment_methods?.stripe) enabledMethods.push('stripe');
  if (paymentSettings?.payment_methods?.zelle) enabledMethods.push('zelle');
  if (paymentSettings?.payment_methods?.venmo) enabledMethods.push('venmo');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" />
            {t('payment')}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : enabledMethods.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No payment methods available</p>
            </div>
          ) : (
            <>
              {/* Booking Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">{t('total')}</p>
                <p className="text-2xl font-bold text-green-600">
                  ${booking?.total_price || 0}
                </p>
              </div>

              {/* Payment Method Selection */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {t('select_payment_method')}
                </p>
                <div className="space-y-3">
                  {/* Stripe */}
                  {paymentSettings?.payment_methods?.stripe && (
                    <button
                      onClick={() => setSelectedMethod('stripe')}
                      className={`w-full p-4 rounded-xl border text-left transition-colors ${
                        selectedMethod === 'stripe'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{t('pay_with_card')}</p>
                          <p className="text-sm text-gray-500">Stripe secure checkout</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Zelle */}
                  {paymentSettings?.payment_methods?.zelle && (
                    <button
                      onClick={() => setSelectedMethod('zelle')}
                      className={`w-full p-4 rounded-xl border text-left transition-colors ${
                        selectedMethod === 'zelle'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Zelle</p>
                          <p className="text-sm text-gray-500">Bank transfer</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Venmo */}
                  {paymentSettings?.payment_methods?.venmo && (
                    <button
                      onClick={() => setSelectedMethod('venmo')}
                      className={`w-full p-4 rounded-xl border text-left transition-colors ${
                        selectedMethod === 'venmo'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Venmo</p>
                          <p className="text-sm text-gray-500">Mobile payment</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Instructions */}
              {selectedMethod === 'zelle' && paymentSettings?.zelle_instructions && (
                <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-purple-900">{t('payment_instructions')}</p>
                    <button
                      onClick={() => handleCopy(paymentSettings.zelle_instructions)}
                      className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">
                    {paymentSettings.zelle_instructions}
                  </p>
                </div>
              )}

              {selectedMethod === 'venmo' && paymentSettings?.venmo_instructions && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-blue-900">{t('payment_instructions')}</p>
                    <button
                      onClick={() => handleCopy(paymentSettings.venmo_instructions)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">
                    {paymentSettings.venmo_instructions}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {selectedMethod && (
          <div className="p-4 border-t">
            {selectedMethod === 'stripe' ? (
              <button
                onClick={handleStripePayment}
                disabled={processing}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {t('pay_now')} - ${booking?.total_price || 0}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleManualPaymentConfirm}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                I've Made the Payment
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;
