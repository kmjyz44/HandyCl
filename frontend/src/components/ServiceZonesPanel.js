import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import { 
  MapPin, Plus, Edit, Trash2, X, Users, DollarSign, 
  Navigation, Check, AlertCircle, Map
} from 'lucide-react';

// Service Zones Management Panel
export function ServiceZonesPanel() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const res = await api.adminGetServiceZones();
      setZones(Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (error) {
      console.error('Error loading zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (zoneId) => {
    if (!window.confirm('Видалити цю зону обслуговування?')) return;
    
    try {
      await api.adminDeleteServiceZone(zoneId);
      loadZones();
    } catch (error) {
      console.error('Error deleting zone:', error);
      alert('Помилка видалення');
    }
  };

  const handleToggleActive = async (zone) => {
    try {
      await api.adminUpdateServiceZone(zone.zone_id, {
        is_active: !zone.is_active
      });
      loadZones();
    } catch (error) {
      console.error('Error updating zone:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Зони обслуговування</h2>
          <p className="text-gray-500 mt-1">Управління географічними зонами для виконавців</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Додати зону
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Map className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{zones.length}</p>
              <p className="text-sm text-gray-500">Всього зон</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {zones.filter(z => z.is_active).length}
              </p>
              <p className="text-sm text-gray-500">Активних</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {zones.reduce((sum, z) => sum + (z.active_taskers || 0), 0)}
              </p>
              <p className="text-sm text-gray-500">Виконавців</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Navigation className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(zones.reduce((sum, z) => sum + (z.max_distance_km || 0), 0) / (zones.length || 1))} км
              </p>
              <p className="text-sm text-gray-500">Сер. радіус</p>
            </div>
          </div>
        </div>
      </div>

      {/* Zones List */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">Немає зон обслуговування</p>
          <p className="text-sm text-gray-400 mt-1">Створіть першу зону для налаштування географічного охоплення</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map(zone => (
            <div 
              key={zone.zone_id} 
              className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-lg ${
                !zone.is_active ? 'opacity-60' : ''
              }`}
            >
              {/* Zone Header with Color */}
              <div 
                className="h-3" 
                style={{ backgroundColor: zone.color || '#22c55e' }}
              />
              
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                    {zone.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{zone.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    zone.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {zone.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </div>

                {/* Zone Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{zone.active_taskers || 0}</p>
                    <p className="text-xs text-gray-500">Виконавців</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{zone.max_distance_km}</p>
                    <p className="text-xs text-gray-500">км радіус</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">x{zone.service_fee_multiplier}</p>
                    <p className="text-xs text-gray-500">Множник</p>
                  </div>
                </div>

                {/* Zone Settings */}
                <div className="text-sm text-gray-600 mb-4 space-y-1">
                  {zone.min_order_amount > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span>Мін. замовлення: ${zone.min_order_amount}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>Центр: {zone.center_lat?.toFixed(4)}, {zone.center_lng?.toFixed(4)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(zone)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      zone.is_active
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {zone.is_active ? 'Деактивувати' : 'Активувати'}
                  </button>
                  <button
                    onClick={() => setEditingZone(zone)}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(zone.zone_id)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingZone) && (
        <ServiceZoneModal
          zone={editingZone}
          onClose={() => {
            setShowCreateModal(false);
            setEditingZone(null);
          }}
          onSaved={loadZones}
        />
      )}
    </div>
  );
}

// Create/Edit Zone Modal
function ServiceZoneModal({ zone, onClose, onSaved }) {
  const isEditing = !!zone;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: zone?.name || '',
    description: zone?.description || '',
    center_lat: zone?.center_lat || 50.4501,
    center_lng: zone?.center_lng || 30.5234,
    max_distance_km: zone?.max_distance_km || 50,
    service_fee_multiplier: zone?.service_fee_multiplier || 1.0,
    min_order_amount: zone?.min_order_amount || 0,
    color: zone?.color || '#22c55e',
    coordinates: zone?.coordinates || []
  });

  // Predefined Ukrainian cities
  const cities = [
    { name: 'Київ', lat: 50.4501, lng: 30.5234 },
    { name: 'Харків', lat: 49.9935, lng: 36.2304 },
    { name: 'Одеса', lat: 46.4825, lng: 30.7233 },
    { name: 'Дніпро', lat: 48.4647, lng: 35.0462 },
    { name: 'Львів', lat: 49.8397, lng: 24.0297 },
    { name: 'Запоріжжя', lat: 47.8388, lng: 35.1396 },
    { name: 'Вінниця', lat: 49.2331, lng: 28.4682 }
  ];

  const handleCitySelect = (city) => {
    setFormData(prev => ({
      ...prev,
      name: city.name,
      center_lat: city.lat,
      center_lng: city.lng,
      coordinates: generateCircleCoordinates(city.lat, city.lng, formData.max_distance_km)
    }));
  };

  const generateCircleCoordinates = (lat, lng, radiusKm) => {
    const points = [];
    const numPoints = 32;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const dx = radiusKm * Math.cos(angle) / 111; // Approx km to degrees
      const dy = radiusKm * Math.sin(angle) / (111 * Math.cos(lat * Math.PI / 180));
      points.push([lat + dx, lng + dy]);
    }
    return points;
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Введіть назву зони');
      return;
    }

    // Generate coordinates if not set
    let coordinates = formData.coordinates;
    if (coordinates.length === 0) {
      coordinates = generateCircleCoordinates(
        formData.center_lat,
        formData.center_lng,
        formData.max_distance_km
      );
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        coordinates
      };

      if (isEditing) {
        await api.adminUpdateServiceZone(zone.zone_id, payload);
      } else {
        await api.adminCreateServiceZone(payload);
      }
      
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving zone:', error);
      alert(error.response?.data?.detail || 'Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            {isEditing ? 'Редагувати зону' : 'Нова зона обслуговування'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick City Select */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Швидкий вибір міста
              </label>
              <div className="flex flex-wrap gap-2">
                {cities.map(city => (
                  <button
                    key={city.name}
                    onClick={() => handleCitySelect(city)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.name === city.name
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Назва зони *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="напр. Київ центр"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Опис
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 h-20"
              placeholder="Опис зони обслуговування..."
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Широта (Lat)
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.center_lat}
                onChange={(e) => setFormData(prev => ({ ...prev, center_lat: parseFloat(e.target.value) }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Довгота (Lng)
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.center_lng}
                onChange={(e) => setFormData(prev => ({ ...prev, center_lng: parseFloat(e.target.value) }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Радіус обслуговування (км)
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={formData.max_distance_km}
              onChange={(e) => setFormData(prev => ({ ...prev, max_distance_km: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Fee Multiplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Множник ціни
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="3"
                value={formData.service_fee_multiplier}
                onChange={(e) => setFormData(prev => ({ ...prev, service_fee_multiplier: parseFloat(e.target.value) }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">1.0 = звичайна ціна, 1.5 = +50%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Мін. замовлення ($)
              </label>
              <input
                type="number"
                min="0"
                value={formData.min_order_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, min_order_amount: parseFloat(e.target.value) }))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Колір на карті
            </label>
            <div className="flex gap-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formData.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
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
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                {isEditing ? 'Зберегти' : 'Створити'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceZonesPanel;
