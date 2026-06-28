import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Lang = 'en' | 'uk';

// Translation dictionaries. Migrate screens gradually using t('key', 'fallback').
// EN is the primary (US) language; UA kept for the language switcher.
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.add': 'Add',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.loading': 'Loading…',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.logout': 'Log out',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.language_en': 'English (US)',
    'settings.language_uk': 'Ukrainian',
    'profile.title': 'My Profile',
    'profile.no_reviews': 'No reviews yet',
    'profile.add_card': 'Add card',
    'profile.card_number': 'Card number',
    'profile.expiry': 'Expiry date',
    'profile.card_holder': 'Cardholder name',
    'profile.no_cards': 'No saved cards',
    'profile.add_card_hint': 'Add a card for quick checkout',
    'pay.title': 'Pay for task',
    'pay.method': 'Payment method',
    'pay.amount_due': 'Amount due',
    'pay.confirm': 'Confirm payment',
  },
  uk: {
    'common.cancel': 'Скасувати',
    'common.save': 'Зберегти',
    'common.add': 'Додати',
    'common.delete': 'Видалити',
    'common.edit': 'Редагувати',
    'common.close': 'Закрити',
    'common.confirm': 'Підтвердити',
    'common.back': 'Назад',
    'common.loading': 'Завантаження…',
    'common.error': 'Помилка',
    'common.success': 'Успіх',
    'common.logout': 'Вийти',
    'settings.title': 'Налаштування',
    'settings.language': 'Мова',
    'settings.language_en': 'Англійська (США)',
    'settings.language_uk': 'Українська',
    'profile.title': 'Мій профіль',
    'profile.no_reviews': 'Ще немає відгуків',
    'profile.add_card': 'Додати картку',
    'profile.card_number': 'Номер картки',
    'profile.expiry': 'Термін дії',
    'profile.card_holder': "Ім'я власника",
    'profile.no_cards': 'Немає збережених карток',
    'profile.add_card_hint': 'Додайте картку для швидкої оплати',
    'pay.title': 'Оплата завдання',
    'pay.method': 'Спосіб оплати',
    'pay.amount_due': 'Сума до оплати',
    'pay.confirm': 'Підтвердити оплату',
  },
};

const STORAGE_KEY = 'app_lang';
const DEFAULT_LANG: Lang = 'en';

async function persistLang(lang: Lang) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

function readLang(): Lang {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'uk' || v === 'en' ? v : DEFAULT_LANG;
    }
  } catch {}
  return DEFAULT_LANG;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, fallback?: string) => string };
const LangContext = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k, f) => f || k });

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => { setLangState(readLang()); }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    persistLang(l);
  }, []);

  const t = useCallback((key: string, fallback?: string) => {
    return DICT[lang][key] ?? DICT.en[key] ?? fallback ?? key;
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
};

export const useT = () => useContext(LangContext);
