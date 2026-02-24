import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';

const LANGUAGE_KEY = 'assistlink_language';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
] as const;

export type LanguageCode = 'en' | 'hi';

export async function getStoredLanguage(): Promise<LanguageCode> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored === 'en' || stored === 'hi') return stored;
  } catch {
    // ignore
  }
  return 'en';
}

export async function setStoredLanguage(code: LanguageCode): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
  } catch (e) {
    console.warn('Failed to save language preference', e);
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
