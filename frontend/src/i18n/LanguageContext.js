import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from './translations';
import { api } from '../api/apiClient';

const LanguageContext = createContext();

export const LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '🇺🇸' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  uk: { code: 'uk', name: 'Українська', flag: '🇺🇦' }
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const [availableLanguages, setAvailableLanguages] = useState(['en', 'es', 'uk']);
  const [geoLanguageEnabled, setGeoLanguageEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeLanguage();
  }, []);

  const initializeLanguage = async () => {
    try {
      // Load settings from server
      const res = await api.getPublicSettings();
      const settings = res.data || res;
      
      if (settings.available_languages) {
        setAvailableLanguages(settings.available_languages);
      }
      
      setGeoLanguageEnabled(settings.enable_geolocation_language || false);
      
      // Check saved language preference
      const savedLang = localStorage.getItem('handyhub_language');
      
      if (savedLang && availableLanguages.includes(savedLang)) {
        setLanguage(savedLang);
      } else if (settings.enable_geolocation_language) {
        // Try to detect language from geolocation
        detectLanguageByLocation();
      } else if (settings.default_language) {
        setLanguage(settings.default_language);
      }
    } catch (error) {
      console.error('Error loading language settings:', error);
      // Fall back to browser language or English
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang && translations[browserLang]) {
        setLanguage(browserLang);
      }
    } finally {
      setLoading(false);
    }
  };

  const detectLanguageByLocation = async () => {
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            // Simple country detection based on coordinates
            // This is a simplified version - production would use a geocoding API
            
            // Ukraine approximate bounds
            if (latitude >= 44 && latitude <= 52 && longitude >= 22 && longitude <= 40) {
              setLanguage('uk');
              return;
            }
            
            // Spain approximate bounds
            if (latitude >= 36 && latitude <= 43 && longitude >= -9 && longitude <= 3) {
              setLanguage('es');
              return;
            }
            
            // Latin America approximate bounds
            if (latitude >= -55 && latitude <= 32 && longitude >= -120 && longitude <= -35) {
              setLanguage('es');
              return;
            }
            
            // Default to English
            setLanguage('en');
          },
          () => {
            // Geolocation failed, use default
            console.log('Geolocation not available');
          }
        );
      }
    } catch (error) {
      console.error('Error detecting location:', error);
    }
  };

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('handyhub_language', lang);
    }
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const value = {
    language,
    setLanguage: changeLanguage,
    availableLanguages,
    geoLanguageEnabled,
    t,
    loading,
    LANGUAGES
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Language Selector Component
export function LanguageSelector({ className = '' }) {
  const { language, setLanguage, availableLanguages, LANGUAGES } = useLanguage();

  return (
    <div className={`relative ${className}`}>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="appearance-none bg-white border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
      >
        {availableLanguages.map(lang => (
          <option key={lang} value={lang}>
            {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default LanguageContext;
