import React, { useState, useEffect } from 'react';
import { PanelLeftOpen, CloudUpload, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { MobileTopBar } from './components/MobileTopBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Sidebar, ViewType } from './components/Sidebar';
import { HomeView } from './components/HomeView';
import { CyclePredictionView } from './components/CyclePredictionView';
import { HistoryView } from './components/HistoryView';
import { AuthModal } from './components/AuthModal';
import {
  SaltRecord,
  SilicaRecord,
  CyclePredictionRecord,
  subscribeSaltRecords,
  subscribeSilicaRecords,
  subscribeCyclePredictions,
  addCyclePrediction,
  deleteSaltRecord,
  deleteSilicaRecord,
  deleteCyclePrediction,
} from './services/dataService';

const LOCAL_SALT_KEY = 'mb_toolkit_salt_local_v2';
const LOCAL_SILICA_KEY = 'mb_toolkit_silica_local_v2';
const LOCAL_CYCLE_KEY = 'mb_toolkit_cycle_local_v2';

function MainApp() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mb_toolkit_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    return localStorage.getItem('mb_toolkit_sidebar_hidden') === 'true';
  });
  const [batchToLoadInCycleView, setBatchToLoadInCycleView] = useState<CyclePredictionRecord | null>(null);
  const [isSyncingLocalToCloud, setIsSyncingLocalToCloud] = useState(false);
  const [isLocalSyncBannerDismissed, setIsLocalSyncBannerDismissed] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<string | null>(null);

  const toggleSidebarHidden = () => {
    setIsSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem('mb_toolkit_sidebar_hidden', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarHidden();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cloud/Firestore records
  const [cloudSaltRecords, setCloudSaltRecords] = useState<SaltRecord[]>([]);
  const [cloudSilicaRecords, setCloudSilicaRecords] = useState<SilicaRecord[]>([]);
  const [cloudCycleRecords, setCloudCycleRecords] = useState<CyclePredictionRecord[]>([]);

  // Local state for guest/offline fallback
  const [localSaltRecords, setLocalSaltRecords] = useState<SaltRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SALT_KEY);
      if (!raw) return [];
      const parsed: SaltRecord[] = JSON.parse(raw);
      return parsed.filter((r) => !r.id.startsWith('sample_'));
    } catch {
      return [];
    }
  });

  const [localSilicaRecords, setLocalSilicaRecords] = useState<SilicaRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SILICA_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [localCycleRecords, setLocalCycleRecords] = useState<CyclePredictionRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_CYCLE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Theme application (sync both data-theme and .dark class for Tailwind v4)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('mb_toolkit_theme', theme);
  }, [theme]);

  // Sync to local storage for guests
  useEffect(() => {
    if (!user) {
      localStorage.setItem(LOCAL_SALT_KEY, JSON.stringify(localSaltRecords));
    }
  }, [localSaltRecords, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(LOCAL_SILICA_KEY, JSON.stringify(localSilicaRecords));
    }
  }, [localSilicaRecords, user]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(LOCAL_CYCLE_KEY, JSON.stringify(localCycleRecords));
    }
  }, [localCycleRecords, user]);

  // Realtime Firestore listeners when user is authenticated
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setCloudSaltRecords([]);
      setCloudSilicaRecords([]);
      setCloudCycleRecords([]);
      return;
    }

    const unsubSalt = subscribeSaltRecords(uid, (records) => {
      setCloudSaltRecords(records);
    });

    const unsubSilica = subscribeSilicaRecords(uid, (records) => {
      setCloudSilicaRecords(records);
    });

    const unsubCycle = subscribeCyclePredictions(uid, (records) => {
      setCloudCycleRecords(records);
    });

    return () => {
      unsubSalt();
      unsubSilica();
      unsubCycle();
    };
  }, [user?.uid]);

  // Active records: prioritize cloud if logged in
  const activeSaltRecords = user ? cloudSaltRecords : localSaltRecords;
  const activeSilicaRecords = user ? cloudSilicaRecords : localSilicaRecords;
  const activeCycleRecords = user ? cloudCycleRecords : localCycleRecords;

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleDeleteLocalSalt = (id: string) => {
    setLocalSaltRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteLocalSilica = (id: string) => {
    setLocalSilicaRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddLocalCycle = (data: Omit<CyclePredictionRecord, 'id' | 'userId' | 'createdAt'>): string => {
    const newId = `local_pred_${Date.now()}`;
    const newRecord: CyclePredictionRecord = {
      ...data,
      id: newId,
      userId: 'local_user',
      createdAt: new Date().toISOString(),
    };
    setLocalCycleRecords((prev) => [newRecord, ...prev]);
    return newId;
  };

  const handleDeleteLocalCycle = (id: string) => {
    setLocalCycleRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateLocalSalt = (id: string, updated: Partial<SaltRecord>) => {
    setLocalSaltRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const handleUpdateLocalSilica = (id: string, updated: Partial<SilicaRecord>) => {
    setLocalSilicaRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const handleUpdateLocalCycle = (id: string, updated: Partial<CyclePredictionRecord>) => {
    setLocalCycleRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const handleClearAll = async () => {
    if (user) {
      await Promise.all([
        ...activeSaltRecords.filter((r) => Boolean(r.id)).map((r) => deleteSaltRecord(r.id!)),
        ...activeSilicaRecords.filter((r) => Boolean(r.id)).map((r) => deleteSilicaRecord(r.id!)),
        ...activeCycleRecords.filter((r) => Boolean(r.id)).map((r) => deleteCyclePrediction(r.id!)),
      ]);
    } else {
      setLocalSaltRecords([]);
      setLocalSilicaRecords([]);
      setLocalCycleRecords([]);
    }
  };

  const handleSyncLocalBatchesToCloud = async () => {
    if (!user || localCycleRecords.length === 0 || isSyncingLocalToCloud) return;
    setIsSyncingLocalToCloud(true);
    try {
      const count = localCycleRecords.length;
      for (const rec of localCycleRecords) {
        const { id: _id, userId: _uid, createdAt, ...payload } = rec;
        await addCyclePrediction(payload, createdAt || new Date().toISOString());
      }
      setLocalCycleRecords([]);
      localStorage.removeItem(LOCAL_CYCLE_KEY);
      setSyncSuccessToast(
        language === 'th'
          ? `ซิงค์ชุดข้อมูลจากเครื่องขึ้น Cloud เรียบร้อยแล้ว (${count} ชุด)`
          : `Successfully synced ${count} local batch(es) to Cloud.`
      );
      setTimeout(() => setSyncSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to sync local records to cloud:', err);
    } finally {
      setIsSyncingLocalToCloud(false);
    }
  };

  const activeNormalizedView =
    currentView === 'salt' || currentView === 'silica' ? 'cycle' : currentView;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)] text-[var(--ink)] antialiased selection:bg-sky-500/20">
      {/* Mobile Top Bar */}
      <MobileTopBar
        onOpenSidebar={() => setIsMobileSidebarOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Floating Button to re-open Sidebar when hidden on desktop */}
      <AnimatePresence>
        {isSidebarHidden && (
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={toggleSidebarHidden}
            className="hidden md:flex items-center gap-2 fixed top-4 left-4 z-40 px-3.5 py-2 rounded-xl bg-[var(--panel)] text-[var(--ink)] shadow-sm hover:shadow-md border border-[var(--line)] backdrop-blur-md cursor-pointer group"
            title={`${language === 'th' ? 'แสดงแถบเมนู' : 'Show sidebar'} (Ctrl+B)`}
            aria-label="Show sidebar"
          >
            <PanelLeftOpen className="w-4 h-4 text-[var(--accent)] group-hover:translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold text-[var(--ink)] whitespace-nowrap">
              {language === 'th' ? 'แสดงเมนู' : 'Menu'}
            </span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--ink-soft)]">
              Ctrl+B
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={activeNormalizedView}
        onSelectView={(v) => {
          setCurrentView(v);
          setIsMobileSidebarOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        recordCounts={{
          salt: activeSaltRecords.length,
          silica: activeSilicaRecords.length,
          cycle: activeCycleRecords.length,
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isCollapsed={isSidebarHidden}
        onToggleCollapse={toggleSidebarHidden}
      />

      {/* Main Content Viewport - Responsive across Mobile, Tablet, and Desktop */}
      <main
        className={`flex-1 min-w-0 overflow-x-hidden px-3.5 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 pb-24 md:pb-12 transition-[padding] duration-200 ${
          isSidebarHidden ? 'md:pt-16' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Local-to-Cloud Sync Prompt Banner when signed in and local guest batches exist */}
          <AnimatePresence>
            {user && localCycleRecords.length > 0 && !isLocalSyncBannerDismissed && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 text-[var(--ink)]">
                  <CloudUpload className="w-4 h-4 text-sky-500 shrink-0" />
                  <span>
                    {language === 'th'
                      ? `พบชุดข้อมูลที่บันทึกไว้ในเครื่อง (โหมดผู้เยี่ยมชม) จำนวน ${localCycleRecords.length} ชุด ต้องการโอนย้ายขึ้นบัญชี Cloud ของคุณหรือไม่?`
                      : `Found ${localCycleRecords.length} batch(es) saved locally on this device. Sync them to your Cloud account?`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncLocalBatchesToCloud}
                    disabled={isSyncingLocalToCloud}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>
                      {isSyncingLocalToCloud
                        ? language === 'th'
                          ? 'กำลังซิงค์...'
                          : 'Syncing...'
                        : language === 'th'
                        ? `ซิงค์ขึ้น Cloud (${localCycleRecords.length} ชุด)`
                        : `Sync to Cloud (${localCycleRecords.length})`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLocalSyncBannerDismissed(true)}
                    className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--panel)] cursor-pointer"
                    title={language === 'th' ? 'ซ่อนข้อความนี้' : 'Dismiss'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {syncSuccessToast && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{syncSuccessToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncSuccessToast(null)}
                  className="p-1 rounded hover:bg-emerald-500/10 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeNormalizedView === 'home' && (
              <motion.div
                key="view-home"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <HomeView
                  onNavigate={(v) => {
                    setCurrentView(v);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  saltRecords={activeSaltRecords}
                  silicaRecords={activeSilicaRecords}
                  cycleRecords={activeCycleRecords}
                />
              </motion.div>
            )}

            {activeNormalizedView === 'cycle' && (
              <motion.div
                key="view-cycle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <CyclePredictionView
                  records={activeCycleRecords}
                  allRecordsCount={{
                    salt: activeSaltRecords.length,
                    silica: activeSilicaRecords.length,
                    cycle: activeCycleRecords.length,
                    total: activeCycleRecords.length,
                  }}
                  onAddLocalRecord={handleAddLocalCycle}
                  onUpdateLocalRecord={handleUpdateLocalCycle}
                  onDeleteLocalRecord={handleDeleteLocalCycle}
                  onClearAllLocal={() => setLocalCycleRecords([])}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  externalBatchToLoad={batchToLoadInCycleView}
                  onClearExternalBatch={() => setBatchToLoadInCycleView(null)}
                />
              </motion.div>
            )}

            {activeNormalizedView === 'history' && (
              <motion.div
                key="view-history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <HistoryView
                  saltRecords={activeSaltRecords}
                  silicaRecords={activeSilicaRecords}
                  cycleRecords={activeCycleRecords}
                  onDeleteLocalSalt={handleDeleteLocalSalt}
                  onDeleteLocalSilica={handleDeleteLocalSilica}
                  onDeleteLocalCycle={handleDeleteLocalCycle}
                  onUpdateLocalSalt={handleUpdateLocalSalt}
                  onUpdateLocalSilica={handleUpdateLocalSilica}
                  onUpdateLocalCycle={handleUpdateLocalCycle}
                  onClearAll={handleClearAll}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onNavigateToCalc={(type) => {
                    setCurrentView(type);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onLoadCycleBatchToEdit={(batch) => {
                    setBatchToLoadInCycleView(batch);
                    setCurrentView('cycle');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation Dock */}
      <MobileBottomNav
        currentView={activeNormalizedView}
        onSelectView={(v) => {
          setCurrentView(v);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        recordCounts={{
          salt: activeSaltRecords.length,
          silica: activeSilicaRecords.length,
          cycle: activeCycleRecords.length,
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <MainApp />
      </LanguageProvider>
    </AuthProvider>
  );
}
