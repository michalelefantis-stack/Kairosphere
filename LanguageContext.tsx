import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'fr' | 'es' | 'de' | 'ja';

interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export const translations: Translations = {
  // NavDashboard
  map: { en: 'Map', fr: 'Carte', es: 'Mapa', de: 'Karte', ja: 'マップ' },
  liveMap: { en: 'Live Map', fr: 'Carte en direct', es: 'Mapa en vivo', de: 'Live-Karte', ja: 'ライブマップ' },
  calendar: { en: 'Calendar', fr: 'Calendrier', es: 'Calendario', de: 'Kalender', ja: 'カレンダー' },
  itinerary: { en: 'Itinerary', fr: 'Itinéraire', es: 'Itinerario', de: 'Reiseroute', ja: '旅程' },
  signals: { en: 'Signals', fr: 'Signaux', es: 'Señales', de: 'Signale', ja: 'シグナル' },
  library: { en: 'Library', fr: 'Bibliothèque', es: 'Biblioteca', de: 'Bibliothek', ja: 'ライブラリ' },
  
  // AccountMenu
  account: { en: 'Account', fr: 'Compte', es: 'Cuenta', de: 'Konto', ja: 'アカウント' },
  settings: { en: 'Settings', fr: 'Paramètres', es: 'Ajustes', de: 'Einstellungen', ja: '設定' },
  themeMode: { en: 'Theme Mode', fr: 'Mode Thème', es: 'Modo de Tema', de: 'Themenmodus', ja: 'テーマモード' },
  lightMode: { en: 'Light Mode', fr: 'Mode Clair', es: 'Modo Claro', de: 'Heller Modus', ja: 'ライトモード' },
  darkMode: { en: 'Dark Mode', fr: 'Mode Sombre', es: 'Modo Oscuro', de: 'Dunkler Modus', ja: 'ダークモード' },
  language: { en: 'Language', fr: 'Langue', es: 'Idioma', de: 'Sprache', ja: '言語' },
  appInterface: { en: 'App Interface', fr: 'Interface de l\'application', es: 'Interfaz de la App', de: 'App-Schnittstelle', ja: 'アプリのインターフェース' },
  signInTo: { en: 'Sign in to Kairosphere', fr: 'Connectez-vous à Kairosphere', es: 'Inicia sesión en Kairosphere', de: 'Melden Sie sich bei Kairosphere an', ja: 'Kairosphereにサインイン' },
  saveFavorites: { en: 'Save your favorite cultural events, create itineraries, and sync across devices.', fr: 'Enregistrez vos événements culturels préférés, créez des itinéraires et synchronisez-les sur tous vos appareils.', es: 'Guarda tus eventos culturales favoritos, crea itinerarios y sincroniza entre dispositivos.', de: 'Speichern Sie Ihre bevorzugten kulturellen Veranstaltungen, erstellen Sie Reiserouten und synchronisieren Sie sie geräteübergreifend.', ja: 'お気に入りの文化イベントを保存し、旅程を作成して、デバイス間で同期します。' },
  continueWithApple: { en: 'Continue with Apple', fr: 'Continuer avec Apple', es: 'Continuar con Apple', de: 'Weiter mit Apple', ja: 'Appleで続ける' },
  continueWithGoogle: { en: 'Continue with Google', fr: 'Continuer avec Google', es: 'Continuar con Google', de: 'Weiter mit Google', ja: 'Googleで続ける' },
  continueWithEmail: { en: 'Continue with Email', fr: 'Continuer avec Email', es: 'Continuar con Email', de: 'Weiter mit E-Mail', ja: 'メールで続ける' },
  signOut: { en: 'Sign Out', fr: 'Se déconnecter', es: 'Cerrar sesión', de: 'Abmelden', ja: 'サインアウト' },
  termsOfService: { en: 'Terms of Service', fr: 'Conditions d\'utilisation', es: 'Términos de servicio', de: 'Nutzungsbedingungen', ja: '利用規約' },
  privacyPolicy: { en: 'Privacy Policy', fr: 'Politique de confidentialité', es: 'Política de privacidad', de: 'プライバシーポリシー', ja: 'プライバシーポリシー' },
  byContinuing: { en: 'By continuing, you agree to our', fr: 'En continuant, vous acceptez nos', es: 'Al continuar, aceptas nuestros', de: 'Indem Sie fortfahren, stimmen Sie unseren zu', ja: '続行することで、以下に同意したことになります' },
  and: { en: 'and', fr: 'et', es: 'y', de: 'und', ja: 'および' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('kairos_language') as Language;
    if (savedLang && ['en', 'fr', 'es', 'de', 'ja'].includes(savedLang)) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('kairos_language', lang);
  };

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key; // Fallback to key if translation missing
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
