import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  Globe, CreditCard, Bell, Save, Check, AlertCircle,
  Eye, EyeOff, DollarSign
} from 'lucide-react';
import { LANGUAGES } from '../i18n/LanguageContext';

export function AdvancedSettingsPanel() {
  const [activeTab, setActiveTab] = useState('language');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showFirebaseKey, setShowFirebaseKey] = useState(false);
  
  const [settings, setSettings] = useState({
    // Language
    default_language: 'en',
    available_languages: ['en', 'es', 'uk'],
    enable_geolocation_language: false,
    
    // Payment Methods
    payment_methods_enabled: {
      stripe: false,
      zelle: false,
      venmo: false
    },
    stripe_public_key: '',
    stripe_secret_key: '',
    zelle_instructions: '',
    venmo_instructions: '',
    
    // Firebase
    firebase_server_key: '',
    firebase_project_id: '',
    send_push_notifications: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminSettings();
      const data = res.data || res;
      
      setSettings(prev => ({
        ...prev,
        default_language: data.default_language || 'en',
        available_languages: data.available_languages || ['en', 'es', 'uk'],
        enable_geolocation_language: data.enable_geolocation_language || false,
        payment_methods_enabled: data.payment_methods_enabled || { stripe: false, zelle: false, venmo: false },
        stripe_public_key: data.stripe_public_key || '',
        stripe_secret_key: data.stripe_secret_key || '',
        zelle_instructions: data.zelle_instructions || '',
        venmo_instructions: data.venmo_instructions || '',
        firebase_server_key: data.firebase_server_key || '',
        firebase_project_id: data.firebase_project_id || '',
        send_push_notifications: data.send_push_notifications || false
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updatePaymentMethod = (method, enabled) => {
    setSettings(prev => ({
      ...prev,
      payment_methods_enabled: {
        ...prev.payment_methods_enabled,
        [method]: enabled
      }
    }));
  };

  const toggleLanguage = (lang) => {
    setSettings(prev => {
      const langs = [...prev.available_languages];
      const index = langs.indexOf(lang);
      if (index >= 0) {
        // Don't allow removing all languages
        if (langs.length > 1) {
          langs.splice(index, 1);
        }
      } else {
        langs.push(lang);
      }
      return { ...prev, available_languages: langs };
    });
  };

  const tabs = [
    { id: 'language', icon: Globe, label: 'Language' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'notifications', icon: Bell, label: 'Push Notifications' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Language Settings */}
      {activeTab === 'language' && (
        <div className="bg-white rounded-2xl border p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Language Settings</h3>
            <p className="text-sm text-gray-500">Configure available languages and auto-detection</p>
          </div>

          {/* Default Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Language
            </label>
            <select
              value={settings.default_language}
              onChange={(e) => updateSetting('default_language', e.target.value)}
              className="w-full max-w-xs px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {Object.values(LANGUAGES).map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Available Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Languages
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Select which languages will be available for users
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.values(LANGUAGES).map(lang => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${
                    settings.available_languages.includes(lang.code)
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                  {settings.available_languages.includes(lang.code) && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Geolocation Language */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">Auto-detect language by location</p>
              <p className="text-sm text-gray-500">
                Automatically set language based on user's geolocation
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enable_geolocation_language}
                onChange={(e) => updateSetting('enable_geolocation_language', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>
      )}

      {/* Payment Settings */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Stripe */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Stripe Payments</h3>
                  <p className="text-sm text-gray-500">Accept credit/debit card payments</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payment_methods_enabled.stripe}
                  onChange={(e) => updatePaymentMethod('stripe', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {settings.payment_methods_enabled.stripe && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stripe Public Key
                  </label>
                  <input
                    type="text"
                    value={settings.stripe_public_key}
                    onChange={(e) => updateSetting('stripe_public_key', e.target.value)}
                    placeholder="pk_live_..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stripe Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showStripeSecret ? 'text' : 'password'}
                      value={settings.stripe_secret_key}
                      onChange={(e) => updateSetting('stripe_secret_key', e.target.value)}
                      placeholder="sk_live_..."
                      className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeSecret(!showStripeSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showStripeSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Get your keys from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Stripe Dashboard</a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Zelle */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Zelle</h3>
                  <p className="text-sm text-gray-500">Accept Zelle payments</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payment_methods_enabled.zelle}
                  onChange={(e) => updatePaymentMethod('zelle', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {settings.payment_methods_enabled.zelle && (
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zelle Payment Instructions
                </label>
                <textarea
                  value={settings.zelle_instructions}
                  onChange={(e) => updateSetting('zelle_instructions', e.target.value)}
                  placeholder="Enter instructions for clients on how to pay via Zelle (e.g., email address, phone number, business name...)"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 h-24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text will be shown to clients when they select Zelle as payment method
                </p>
              </div>
            )}
          </div>

          {/* Venmo */}
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Venmo</h3>
                  <p className="text-sm text-gray-500">Accept Venmo payments</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.payment_methods_enabled.venmo}
                  onChange={(e) => updatePaymentMethod('venmo', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {settings.payment_methods_enabled.venmo && (
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venmo Payment Instructions
                </label>
                <textarea
                  value={settings.venmo_instructions}
                  onChange={(e) => updateSetting('venmo_instructions', e.target.value)}
                  placeholder="Enter instructions for clients on how to pay via Venmo (e.g., @username, QR code instructions...)"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 h-24"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text will be shown to clients when they select Venmo as payment method
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push Notifications Settings */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Push Notification Settings</h3>
            <p className="text-sm text-gray-500">Configure Firebase Cloud Messaging for push notifications</p>
          </div>

          {/* Enable Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">Enable Push Notifications</p>
              <p className="text-sm text-gray-500">
                Send push notifications to mobile devices
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.send_push_notifications}
                onChange={(e) => updateSetting('send_push_notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {settings.send_push_notifications && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Firebase Setup Required</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    You need a Firebase project to enable push notifications. 
                    <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                      Go to Firebase Console
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firebase Project ID
                </label>
                <input
                  type="text"
                  value={settings.firebase_project_id}
                  onChange={(e) => updateSetting('firebase_project_id', e.target.value)}
                  placeholder="my-app-12345"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firebase Server Key
                </label>
                <div className="relative">
                  <input
                    type={showFirebaseKey ? 'text' : 'password'}
                    value={settings.firebase_server_key}
                    onChange={(e) => updateSetting('firebase_server_key', e.target.value)}
                    placeholder="AAAA..."
                    className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirebaseKey(!showFirebaseKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showFirebaseKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Find this in Firebase Console → Project Settings → Cloud Messaging
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          } disabled:opacity-50`}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-5 h-5" />
              Settings Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default AdvancedSettingsPanel;
