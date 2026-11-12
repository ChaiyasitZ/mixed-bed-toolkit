import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'th' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, { th: string; en: string }> = {
  // App brand & subtitles
  appTitle: { th: 'Mixed Bed Toolkit', en: 'Mixed Bed Toolkit' },
  appSubtitle: { th: 'โรงไฟฟ้าพระนครเหนือ ชุดที่ 1', en: 'North Bangkok Power Plant Block 1' },
  appVersion: { th: 'Mixed Bed v1.0', en: 'Mixed Bed v1.0' },
  
  // Navigation
  navHome: { th: 'หน้าหลัก', en: 'Home' },
  navSalt: { th: '%Salt Rejection', en: '%Salt Rejection' },
  navSilica: { th: '%Silica Rejection', en: '%Silica Rejection' },
  navCycle: { th: 'คาดการณ์ Cycle', en: 'Cycle Prediction' },
  navHistory: { th: 'ฐานข้อมูลประวัติ', en: 'History & Logs' },
  navToolsHeading: { th: 'เครื่องมือคำนวณและข้อมูล', en: 'Calculators & Data' },
  hideSidebar: { th: 'ซ่อนแถบเมนู', en: 'Hide sidebar' },
  showSidebar: { th: 'แสดงแถบเมนู', en: 'Show sidebar' },
  showMenu: { th: 'แสดงเมนู', en: 'Show menu' },

  // Themes & Language
  themeLight: { th: 'โหมดสว่าง', en: 'Light' },
  themeDark: { th: 'โหมดมืด', en: 'Dark' },
  switchToEnglish: { th: 'เปลี่ยนเป็นภาษาอังกฤษ (Switch to English)', en: 'Switch to English' },
  switchToThai: { th: 'Switch to Thai (เปลี่ยนเป็นภาษาไทย)', en: 'Switch to Thai' },

  // User & Auth
  loginGoogle: { th: 'เข้าสู่ระบบด้วย Google', en: 'Sign in with Google' },
  userGoogle: { th: 'ผู้ใช้งาน Google', en: 'Google User' },
  logout: { th: 'ออกจากระบบ', en: 'Sign out' },
  logoutShort: { th: 'ออก', en: 'Out' },
  privateSecurity: { th: 'สิทธิความปลอดภัยส่วนตัว', en: 'Private Cloud Storage' },

  // Home View
  chooseTopic: { th: 'เลือกหัวข้อที่ต้องการคำนวณ', en: 'Select a Calculation Tool' },
  homeDesc: {
    th: 'เครื่องมือช่วยคำนวณสำหรับระบบผลิตน้ำบริสุทธิ์ Reverse Osmosis และ Mixed Bed โรงไฟฟ้าพระนครเหนือ ชุดที่ 1',
    en: 'Calculation and prediction tools for Demineralized Water System (RO & Mixed Bed) at North Bangkok Power Plant Block 1',
  },
  totalRecords: { th: 'บันทึกทั้งหมด', en: 'Total Records' },
  latestSalt: { th: 'ล่าสุด %Salt Rejection', en: 'Latest %Salt Rejection' },
  latestSilica: { th: 'ล่าสุด %Silica Rejection', en: 'Latest %Silica Rejection' },
  latestCycle: { th: 'ล่าสุด คาดการณ์ Cycle', en: 'Latest Cycle Prediction' },
  itemsUnit: { th: 'รายการ', en: 'records' },
  enterCalc: { th: 'เข้าสู่การคำนวณ', en: 'Open Calculator' },
  viewAllHistory: { th: 'ดูประวัติทั้งหมด', en: 'View All History' },

  // Ion Load & Resin Capacity
  resinCapacityTitle: { th: 'การคำนวณ Ion Exchange Resin (Mixed Bed)', en: 'Ion Exchange Resin Calculation (Mixed Bed)' },
  step1Title: { th: 'ขั้นที่ 1: ระยะห่าง Cycle (m³)', en: 'Step 1: Cycle Distance (m³)' },
  step2Title: { th: 'ขั้นที่ 2: Concentration MB Inlet', en: 'Step 2: Concentration MB Inlet' },
  step3Title: { th: 'ขั้นที่ 3: Concentration MB Outlet', en: 'Step 3: Concentration MB Outlet' },
  step4Title: { th: 'ขั้นที่ 4: Ion Concentration ที่หายไป (mol)', en: 'Step 4: Ions Captured (mol)' },
  step5Title: { th: 'ขั้นที่ 5: Ion Load สะสม (mol)', en: 'Step 5: Cumulative Ion Load (mol)' },
  step6Title: { th: 'ขั้นที่ 6: Percent Load on Resin (%)', en: 'Step 6: Percent Load on Resin (%)' },
  cutoffThreshold: { th: 'เกณฑ์ตัดรอบหยุดผลิต (98%)', en: 'Cut-off Threshold (98%)' },
  recommendedCutoff: { th: 'จุดตัดรอบหยุดการผลิตที่แนะนำ', en: 'Recommended Production Cut-off' },
  resinStatusSafe: { th: 'ทำงานปกติ (Safe)', en: 'Normal Operation (Safe)' },
  resinStatusWatch: { th: 'เฝ้าระวัง (Watch)', en: 'Watch Period' },
  resinStatusCutoff: { th: 'ตัดรอบหยุดผลิต (Cut-off Required)', en: 'Cut-off Required' },
  resinStatusBreakthrough: { th: 'ทะลุทะลวงแล้ว (Breakthrough / Exhausted)', en: 'Breakthrough / Exhausted' },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'th',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('mb_toolkit_language');
    if (saved === 'th' || saved === 'en') return saved;
    return 'th';
  });

  useEffect(() => {
    localStorage.setItem('mb_toolkit_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'th' ? 'en' : 'th'));
  };

  const t = (key: string): string => {
    const item = translations[key];
    if (!item) return key;
    return item[language] || item.th || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
