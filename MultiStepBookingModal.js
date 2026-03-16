import React, { useState } from 'react';
import { api } from '../api/apiClient';
import { useLanguage } from '../i18n/LanguageContext';
import { SelectTaskerModal } from './SelectTaskerModal';
import { 
  X, ChevronRight, ChevronLeft, Calendar, Clock, MapPin, 
  FileText, Camera, DollarSign, Check, User, Home, AlertCircle,
  Briefcase, Phone, Users
} from 'lucide-react';

// Multi-Step Booking Form with full i18n support
export function MultiStepBookingModal({ isOpen, onClose, service, onBooked }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showTaskerSelect, setShowTaskerSelect] = useState(false);
  const [selectedTasker, setSelectedTasker] = useState(null);
  const [formData, setFormData] = useState({
    title: service?.name || service?.title || '',
    description: '',
    problem_type: '',
    urgency: 'normal',
    address: '',
    apartment: '',
    city: '',
    notes_for_location: '',
    latitude: null,
    longitude: null,
    date: '',
    time: '',
    flexible_date: false,
    preferred_time_range: 'morning',
    photos: [],
    special_instructions: '',
    tools_needed: false,
    estimated_hours: 1,
    total_price: service?.price || 0,
    promo_code: ''
  });

  const totalSteps = 6;

  const problemTypes = [
    { id: 'repair', labelKey: 'task_type_repair', icon: '🔧' },
    { id: 'cleaning', labelKey: 'task_type_cleaning', icon: '🧹' },
    { id: 'installation', labelKey: 'task_type_installation', icon: '⚙️' },
    { id: 'moving', labelKey: 'task_type_moving', icon: '📦' },
    { id: 'delivery', labelKey: 'task_type_delivery', icon: '🚚' },
    { id: 'other', labelKey: 'task_type_other', icon: '❓' }
  ];

  const urgencyOptions = [
    { id: 'low', labelKey: 'urgency_low', descKey: 'urgency_low_desc', multiplier: 0.9 },
    { id: 'normal', labelKey: 'urgency_normal', descKey: 'urgency_normal_desc', multiplier: 1.0 },
    { id: 'urgent', labelKey: 'urgency_urgent', descKey: 'urgency_urgent_desc', multiplier: 1.3 },
    { id: 'emergency', labelKey: 'urgency_emergency', descKey: 'urgency_emergency_desc', multiplier: 1.5 }
  ];

  const timeRanges = [
    { id: 'morning', labelKey: 'time_morning', time: '08:00 - 12:00' },
    { id: 'afternoon', labelKey: 'time_afternoon', time: '12:00 - 17:00' },
    { id: 'evening', labelKey: 'time_evening', time: '17:00 - 21:00' },
    { id: 'any', labelKey: 'time_any', time: '' }
  ];

  const stepLabels = ['step_details', 'step_address', 'step_time', 'step_additional', 'step_confirm', 'step_tasker'];

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-geocode when city or address changes
  const geocodeAddress = async (city, address) => {
    if (!city) return;
    try {
      const query = address ? `${address}, ${city}` : city;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data && data[0]) {
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }));
      }
    } catch (e) {
      // silently fail — city name alone is still used for filtering
    }
  };

  const handleCityChange = (value) => {
    updateFormData('city', value);
    // Debounced geocode
    clearTimeout(window._geocodeTimer);
    window._geocodeTimer = setTimeout(() => {
      geocodeAddress(value, formData.address);
    }, 800);
  };

  const handleAddressChange = (value) => {
    updateFormData('address', value);
    clearTimeout(window._geocodeTimer2);
    window._geocodeTimer2 = setTimeout(() => {
      geocodeAddress(formData.city, value);
    }, 800);
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFormData(prev => ({
            ...prev,
            photos: [...prev.photos, event.target.result]
          }));
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const calculatePrice = () => {
    const basePrice = service?.price || 50;
    const urgencyMultiplier = urgencyOptions.find(u => u.id === formData.urgency)?.multiplier || 1;
    const hoursMultiplier = formData.estimated_hours;
    return Math.round(basePrice * urgencyMultiplier * hoursMultiplier);
  };

  const handleNext = () => {
    if (step === 5) {
      // Open full-screen tasker selector
      setShowTaskerSelect(true);
      return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const bookingData = {
        service_id: service?.service_id,
        title: formData.title || service?.name || service?.title || 'Service Request',
        description: formData.description,
        address: `${formData.address}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}`,
        date: formData.date,
        time: formData.time,
        total_price: calculatePrice(),
        notes: formData.special_instructions,
        problem_type: formData.problem_type,
        problem_photos: formData.photos,
        urgency: formData.urgency,
        estimated_hours: formData.estimated_hours,
        flexible_date: formData.flexible_date,
        preferred_time_range: formData.preferred_time_range,
        tools_needed: formData.tools_needed,
        latitude: formData.latitude,
        longitude: formData.longitude,
        // Tasker selection
        provider_id: selectedTasker?.user_id || null,
        provider_hourly_rate: selectedTasker?.final_hourly_rate || null,
      };

      await api.createBooking(bookingData);
      if (onBooked) onBooked();
      onClose();
    } catch (error) {
      console.error('Error creating booking:', error);
      const errorMessage = error.response?.data?.detail;
      if (typeof errorMessage === 'string') {
        alert(errorMessage);
      } else if (errorMessage && typeof errorMessage === 'object') {
        alert(JSON.stringify(errorMessage));
      } else {
        alert(t('error_saving') || 'Error saving booking');
      }
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.description.length > 10;
      case 2: return formData.address && formData.city;
      case 3: return formData.date && (formData.time || formData.flexible_date);
      case 6: return true; // Tasker selection is optional
      default: return true;
    }
  };

  if (!isOpen) return null;

  // When tasker select is open, render it full-screen over the modal
  if (showTaskerSelect) {
    return (
      <SelectTaskerModal
        isOpen={true}
        onClose={() => setShowTaskerSelect(false)}
        serviceName={service?.name || service?.title || ''}
        city={formData.city}
        lat={formData.latitude}
        lng={formData.longitude}
        onTaskerSelected={(tasker) => {
          setSelectedTasker(tasker);
          setShowTaskerSelect(false);
          setStep(6);
        }}
        onBack={() => setShowTaskerSelect(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {service?.name || service?.title || t('new_booking')}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div key={s} className="flex-1">
                <div className={`h-2 rounded-full transition-colors ${s <= step ? 'bg-green-600' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            {stepLabels.map((key, i) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Task Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                {t('describe_task')}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('task_type')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {problemTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => updateFormData('problem_type', type.id)}
                      className={`p-3 rounded-xl border text-center transition-colors ${
                        formData.problem_type === type.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <p className="text-sm mt-1">{t(type.labelKey)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('detailed_description')} *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 h-32"
                  placeholder={t('description_hint')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('description_hint')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('urgency')}</label>
                <div className="space-y-2">
                  {urgencyOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => updateFormData('urgency', option.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-colors ${
                        formData.urgency === option.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{t(option.labelKey)}</p>
                          <p className="text-sm text-gray-500">{t(option.descKey)}</p>
                        </div>
                        {option.multiplier !== 1 && (
                          <span className={`text-sm font-medium ${option.multiplier > 1 ? 'text-orange-600' : 'text-green-600'}`}>
                            {option.multiplier > 1 ? '+' : ''}{Math.round((option.multiplier - 1) * 100)}%
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                {t('address_title')}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('city')} *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('street_address')} *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('apartment')}</label>
                <input
                  type="text"
                  value={formData.apartment}
                  onChange={(e) => updateFormData('apartment', e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('notes_for_tasker')}</label>
                <textarea
                  value={formData.notes_for_location}
                  onChange={(e) => updateFormData('notes_for_location', e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 h-20"
                  placeholder={t('notes_for_tasker_hint')}
                />
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                {t('select_date_time')}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('date')} *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateFormData('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
                />
              </div>

              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={formData.flexible_date}
                  onChange={(e) => updateFormData('flexible_date', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{t('flexible_date')}</span>
              </label>

              {!formData.flexible_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('exact_time')}</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => updateFormData('time', e.target.value)}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('preferred_time')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {timeRanges.map(range => (
                    <button
                      key={range.id}
                      onClick={() => updateFormData('preferred_time_range', range.id)}
                      className={`p-3 rounded-xl border text-center transition-colors ${
                        formData.preferred_time_range === range.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{t(range.labelKey)}</p>
                      {range.time && <p className="text-xs text-gray-500">{range.time}</p>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('estimated_duration')}</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={formData.estimated_hours}
                    onChange={(e) => updateFormData('estimated_hours', parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="font-medium text-gray-900 w-16 text-center">
                    {formData.estimated_hours} {t('hours')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Additional Info */}
          {step === 4 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-green-600" />
                {t('additional_info')}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('problem_photos')}</label>
                <input
                  type="file"
                  id="photo-upload"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <label 
                  htmlFor="photo-upload"
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors block"
                >
                  <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">{t('drag_photos')}</p>
                </label>
                {formData.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.photos.map((photo, index) => (
                      <div key={index} className="relative w-20 h-20">
                        <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('special_instructions')}</label>
                <textarea
                  value={formData.special_instructions}
                  onChange={(e) => updateFormData('special_instructions', e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 h-24"
                  placeholder={t('special_instructions_hint')}
                />
              </div>

              <label className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.tools_needed}
                  onChange={(e) => updateFormData('tools_needed', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <p className="font-medium text-gray-900">{t('tools_needed')}</p>
                  <p className="text-sm text-gray-500">{t('tools_needed_desc')}</p>
                </div>
              </label>
            </div>
          )}

          {/* Step 5: Review & Confirm */}
          {step === 5 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                {t('review_booking')}
              </h4>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('service')}</p>
                    <p className="font-medium text-gray-900">{service?.name || service?.title}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('description')}</p>
                    <p className="text-gray-900">{formData.description}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('address')}</p>
                    <p className="text-gray-900">
                      {formData.address}{formData.apartment && `, ${formData.apartment}`}, {formData.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('date_time')}</p>
                    <p className="text-gray-900">
                      {formData.date} {formData.time && formData.time}
                      {formData.flexible_date && ` (${t('flexible_date')})`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">{t('duration')}</p>
                    <p className="text-gray-900">~{formData.estimated_hours} {t('hours')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('base_price')}</span>
                  <span className="font-medium">${service?.price || 50}{t('per_hour')}</span>
                </div>
                {formData.urgency !== 'normal' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('urgency')} ({t(urgencyOptions.find(u => u.id === formData.urgency)?.labelKey)})</span>
                    <span className="font-medium">x{urgencyOptions.find(u => u.id === formData.urgency)?.multiplier}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('duration')}</span>
                  <span className="font-medium">{formData.estimated_hours} {t('hours')}</span>
                </div>
                <div className="border-t border-green-200 pt-2 flex justify-between">
                  <span className="font-bold text-gray-900">{t('estimated_cost')}</span>
                  <span className="font-bold text-green-600 text-xl">${calculatePrice()}</span>
                </div>
                <p className="text-xs text-gray-500">{t('final_price_note')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('promo_code')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.promo_code}
                    onChange={(e) => updateFormData('promo_code', e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-green-500"
                    placeholder="PROMO2024"
                  />
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">
                    {t('apply')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Tasker Confirmed */}
          {step === 6 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                {t('tasker_selected') || 'Tasker Selected'}
              </h4>

              {selectedTasker ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-700 flex-shrink-0">
                      {(selectedTasker.name || selectedTasker.full_name || 'T').charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-base">{selectedTasker.name || selectedTasker.full_name}</p>
                      {selectedTasker.average_rating > 0 && (
                        <p className="text-sm text-gray-600">⭐ {selectedTasker.average_rating?.toFixed(1)} · {selectedTasker.total_reviews} reviews</p>
                      )}
                      {selectedTasker.completed_tasks_count > 0 && (
                        <p className="text-sm text-gray-500">{selectedTasker.completed_tasks_count} tasks completed</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm border-t border-green-200 pt-3">
                    <span className="text-gray-600">Hourly rate</span>
                    <span className="font-bold text-green-700">${selectedTasker.final_hourly_rate?.toFixed(2)}/hr</span>
                  </div>
                  {selectedTasker.commission_percentage > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Includes {selectedTasker.commission_percentage}% platform fee</p>
                  )}
                  <button
                    onClick={() => setShowTaskerSelect(true)}
                    className="mt-3 w-full py-2 border border-green-600 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50"
                  >
                    Change Tasker
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-gray-500 text-sm mb-3">No tasker selected — we'll assign the best available one</p>
                  <button
                    onClick={() => setShowTaskerSelect(true)}
                    className="py-2 px-4 border border-green-600 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50"
                  >
                    Select a Tasker
                  </button>
                </div>
              )}

              {/* Final price summary */}
              <div className="bg-green-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('base_price')}</span>
                  <span className="font-medium">
                    ${selectedTasker?.final_hourly_rate || service?.price || 50}{t('per_hour')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('duration')}</span>
                  <span className="font-medium">{formData.estimated_hours} {t('hours')}</span>
                </div>
                <div className="border-t border-green-200 pt-2 flex justify-between">
                  <span className="font-bold text-gray-900">{t('estimated_cost')}</span>
                  <span className="font-bold text-green-600 text-xl">${calculatePrice()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
              {t('back')}
            </button>
          )}
          
          {step < 5 ? (
            <button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : step === 5 ? (
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700"
            >
              <Users className="w-4 h-4" />
              {t('select_tasker') || 'Select a Tasker'}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('confirm_booking')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MultiStepBookingModal;
