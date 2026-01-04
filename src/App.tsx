import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  FileArchive, Upload, Download, CheckCircle, AlertCircle, FileText, Copy, Trash2, 
  RefreshCcw, Zap, Languages, Crown, PlayCircle, CreditCard, Lock, Settings, 
  PieChart, ListFilter, FileCode, CheckSquare, Square, ChevronRight, Github, 
  ArrowLeftRight, Trees, CloudDownload, Info, Heart, X, HelpCircle, Mail, Shield, Code
} from 'lucide-react';
import { AppStatus, ProcessingResult, Language, ProcessedFile, OutputFormat, AITemplate, AppMode } from './types';
import { loadZipFiles, generateBundle, reverseBundle, fetchGithubRepo } from './utils/archiveProcessor';

const translations = {
  en: {
    title: "Code Bundler Pro",
    subtitle: "Compress your codebase with intelligence. Filters, AI templates, and smart formatting.",
    upload: "Click to upload or drag & drop",
    uploadSubtitle: "ZIP archives containing source code",
    analyzing: "Analyzing Archive...",
    largeProjectWarning: "Large projects may take longer...",
    reading: "Reading:",
    ready: "Bundle Ready",
    processed: "files processed",
    copy: "Copy to Clipboard",
    copied: "Copied!",
    download: "Download",
    preview: "Bundle Preview",
    included: "Files Configuration",
    errorTitle: "Error Processing File",
    errorZip: "Currently only .zip files are supported.",
    errorGeneric: "Failed to process archive.",
    tryAgain: "Try Another File",
    limitReached: "Free Limit Reached",
    limitDesc: "You have used your 3 free conversions. Sign in and upgrade to Premium for unlimited access.",
    options: "Bundle Options",
    format: "Output Format",
    template: "AI Template",
    stats: "Project Stats",
    generate: "Generate Bundle",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    modeBundle: "Bundle ZIP",
    modeReverse: "Reverse (TXT to ZIP)",
    modeGithub: "GitHub Import",
    githubPlaceholder: "https://github.com/user/repo",
    import: "Import Repo",
    reversePlaceholder: "Paste your bundle text here...",
    reverseAction: "Reconstruct ZIP",
    tree: "Structure Tree",
    reverseSuccess: "ZIP structure recreated successfully!",
    premium: "Premium",
    upgradePremium: "Upgrade to Premium",
    premiumFeatures: "Unlimited conversions, Priority support, API access",
    donateTitle: "Support CodeBundler Pro",
    donateDesc: "Your support helps us keep this tool free and add amazing new features. Every donation makes a difference!",
    donateAmount: "Any amount helps • 100% goes to development",
    close: "Close",
    privacyPolicy: "Privacy Policy",
    support: "Support & FAQ",
    documentation: "Documentation",
    apiAccess: "API Access",
    apiTitle: "API Access for Developers",
    apiDesc: "Integrate CodeBundler into your workflows with our REST API.",
    apiPricing: "$9/month - 1,000 conversions/month",
    contact: "Contact Us",
    activateCode: "Activate Premium Code",
    enterCode: "Enter your premium code",
    activate: "Activate",
    codeSuccess: "Premium activated successfully!",
    codeInvalid: "Invalid or expired code",
    haveCode: "I have a premium code"
  },
  es: {
    title: "Code Bundler Pro",
    subtitle: "Comprime tu código con inteligencia. Filtros, plantillas IA y formato inteligente.",
    upload: "Haz clic para subir o arrastra y suelta",
    uploadSubtitle: "Archivos ZIP con código fuente",
    analyzing: "Analizando Archivo...",
    largeProjectWarning: "Proyectos grandes pueden tardar más...",
    reading: "Leyendo:",
    ready: "Paquete Listo",
    processed: "archivos procesados",
    copy: "Copiar al Portapapeles",
    copied: "¡Copiado!",
    download: "Descargar",
    preview: "Vista Previa",
    included: "Configuración de Archivos",
    errorTitle: "Error al Procesar Archivo",
    errorZip: "Actualmente solo se admiten archivos .zip.",
    errorGeneric: "No se pudo procesar el archivo.",
    tryAgain: "Intentar con otro archivo",
    limitReached: "Límite Gratuito Alcanzado",
    limitDesc: "Has usado tus 3 conversiones gratuitas. Inicia sesión y actualiza a Premium para acceso ilimitado.",
    options: "Opciones del Paquete",
    format: "Formato de Salida",
    template: "Plantilla IA",
    stats: "Estadísticas",
    generate: "Generar Paquete",
    selectAll: "Seleccionar Todo",
    deselectAll: "Deseleccionar Todo",
    modeBundle: "Comprimir ZIP",
    modeReverse: "Inverso (TXT a ZIP)",
    modeGithub: "Importar GitHub",
    githubPlaceholder: "https://github.com/usuario/repo",
    import: "Importar Repo",
    reversePlaceholder: "Pega el texto de tu paquete aquí...",
    reverseAction: "Reconstruir ZIP",
    tree: "Árbol de Estructura",
    reverseSuccess: "¡Estructura ZIP recreada con éxito!",
    premium: "Premium",
    upgradePremium: "Actualizar a Premium",
    premiumFeatures: "Conversiones ilimitadas, Soporte prioritario, Acceso API",
    donateTitle: "Apoya CodeBundler Pro",
    donateDesc: "Tu apoyo nos ayuda a mantener esta herramienta gratuita y agregar nuevas funciones increíbles. ¡Cada donación hace la diferencia!",
    donateAmount: "Cualquier monto ayuda • 100% va al desarrollo",
    close: "Cerrar",
    privacyPolicy: "Política de Privacidad",
    support: "Soporte y FAQ",
    documentation: "Documentación",
    apiAccess: "Acceso API",
    apiTitle: "Acceso API para Desarrolladores",
    apiDesc: "Integra CodeBundler en tus flujos de trabajo con nuestra API REST.",
    apiPricing: "$9/mes - 1,000 conversiones/mes",
    contact: "Contáctanos",
    activateCode: "Activar Código Premium",
    enterCode: "Ingresa tu código premium",
    activate: "Activar",
    codeSuccess: "¡Premium activado exitosamente!",
    codeInvalid: "Código inválido o expirado",
    haveCode: "Tengo un código premium"
  }
};

// Función para obtener un identificador único del navegador
const getBrowserFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
  }
  const dataURL = canvas.toDataURL();
  let hash = 0;
  for (let i = 0; i < dataURL.length; i++) {
    const char = dataURL.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
};

// Códigos Premium válidos (puedes agregar más)
const PREMIUM_CODES = [
  'PREMIUM2026',
  'FOUNDER2026',
  'EARLY2026',
  'BETA2026'
];

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('cbp_lang') as Language) || 'en');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [mode, setMode] = useState<AppMode>('bundle');
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('md');
  const [aiTemplate, setAiTemplate] = useState<AITemplate>('none');
  const [archiveName, setArchiveName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [reverseText, setReverseText] = useState("");
  const [currentFile, setCurrentFile] = useState("");
  
  // Estados de Firebase
  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [premiumCode, setPremiumCode] = useState("");
  const [codeError, setCodeError] = useState("");
  
  // Sistema de límites por fingerprint
  const fingerprint = useMemo(() => getBrowserFingerprint(), []);
  const [attempts, setAttempts] = useState<number>(() => {
    const stored = localStorage.getItem(`cbp_attempts_${fingerprint}`);
    return stored ? parseInt(stored, 10) : 0;
  });

  // Estados para modales
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const t = translations[lang];

  useEffect(() => localStorage.setItem('cbp_lang', lang), [lang]);
  useEffect(() => localStorage.setItem(`cbp_attempts_${fingerprint}`, attempts.toString()), [attempts, fingerprint]);
  
  // Escuchar cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userDoc.data();
          setIsPremium(userData?.isPremium || false);
        } catch (error) {
          console.error('Error loading user data:', error);
          setIsPremium(false);
        }
      } else {
        setIsPremium(false);
      }
      
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Login con Google
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isPremium: false,
          conversionsUsed: 0,
          createdAt: new Date().toISOString()
        });
      }
      
      setShowLoginModal(false);
    } catch (error) {
      console.error('Error signing in:', error);
      alert(lang === 'es' ? 'Error al iniciar sesión. Intenta de nuevo.' : 'Error signing in. Please try again.');
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);

      // Reset session + limits to default state
      setUser(null);
      setIsPremium(false);
      setAttempts(0);
      localStorage.setItem(`cbp_attempts_${fingerprint}`, '0');

      setStatus(AppStatus.IDLE);
      setResult(null);
      setFiles([]);
      setReverseText('');
      setGithubUrl('');
      setArchiveName('');
      setCurrentFile('');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Activar código Premium
  const handleActivateCode = async () => {
    if (!user) {
      alert(lang === 'es' ? 'Debes iniciar sesión primero' : 'You must sign in first');
      setShowCodeModal(false);
      setShowLoginModal(true);
      return;
    }

    const code = premiumCode.trim().toUpperCase();
    
    if (PREMIUM_CODES.includes(code)) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          isPremium: true,
          premiumActivatedAt: new Date().toISOString(),
          premiumCode: code
        });
        
        setIsPremium(true);
        setShowCodeModal(false);
        setPremiumCode("");
        setCodeError("");
        alert(t.codeSuccess);
      } catch (error) {
        console.error('Error activating premium:', error);
        setCodeError(lang === 'es' ? 'Error al activar. Intenta de nuevo.' : 'Error activating. Try again.');
      }
    } else {
      setCodeError(t.codeInvalid);
    }
  };

  const toggleFile = (path: string) => {
    setFiles(prev => prev.map(f => f.path === path ? { ...f, selected: !f.selected } : f));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPremium && attempts >= 3) return setStatus(AppStatus.LIMIT_REACHED);
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) return (setError(t.errorZip), setStatus(AppStatus.ERROR));

    setCurrentFile("");
    setArchiveName(file.name);
    setStatus(AppStatus.PROCESSING);
    
    try {
      const loaded = await loadZipFiles(file);
      setFiles(loaded);
      setCurrentFile("");
      setStatus(AppStatus.LOADED);
    } catch (err) {
      setError(t.errorGeneric);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGithubImport = async () => {
    if (!isPremium && attempts >= 3) return setStatus(AppStatus.LIMIT_REACHED);
    if (!githubUrl) return;
    
    setArchiveName("");
    setCurrentFile("");
    setStatus(AppStatus.PROCESSING);
    
    try {
      const repoName = githubUrl.split('/').pop() || "github_repo";
      setArchiveName(repoName);
      
      const blob = await fetchGithubRepo(githubUrl);
      const loaded = await loadZipFiles(blob);
      
      setFiles(loaded);
      setCurrentFile("");
      setStatus(AppStatus.LOADED);
    } catch (err: any) {
      setError(err.message || t.errorGeneric);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleReverse = async () => {
    if (!isPremium && attempts >= 3) return setStatus(AppStatus.LIMIT_REACHED);
    if (!reverseText) return;
    setStatus(AppStatus.PROCESSING);
    try {
      const blob = await reverseBundle(reverseText);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconstructed_project_${Date.now()}.zip`;
      a.click();
      setStatus(AppStatus.IDLE);
      alert(t.reverseSuccess);
      setAttempts(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || t.errorGeneric);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerate = () => {
    const res = generateBundle(files, outputFormat, aiTemplate, archiveName);
    setResult(res);
    setStatus(AppStatus.COMPLETED);
    setAttempts(prev => prev + 1);
  };

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.bundleText);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }, [result]);

  const reset = () => {
    setStatus(!isPremium && attempts >= 3 ? AppStatus.LIMIT_REACHED : AppStatus.IDLE);
    setResult(null);
    setFiles([]);
    setReverseText("");
    setGithubUrl("");
    setArchiveName("");
    setCurrentFile("");
  };

  const stats = useMemo(() => {
    const selected = files.filter(f => f.selected);
    const languages: Record<string, number> = {};
    selected.forEach(f => languages[f.language] = (languages[f.language] || 0) + 1);
    return {
      count: selected.length,
      lines: selected.reduce((acc, f) => acc + f.lines, 0),
      languages
    };
  }, [files]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col items-center p-4 md:p-8 selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="w-full max-w-6xl flex flex-wrap justify-between items-center gap-4 mb-12 bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">CodeBundler<span className="text-indigo-400">Pro</span></h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {user ? (
            <>
<div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
                <img src={user.photoURL || ''} alt="" className="w-5 h-5 rounded-full" />
                <span className="hidden sm:inline text-xs font-bold text-white truncate max-w-[140px]">{user.displayName?.split(' ')[0]}</span>
                {isPremium && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
              </div>
              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold transition-all"
              >
                {lang === 'es' ? 'Salir' : 'Logout'}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all text-xs font-bold shadow-lg"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'es' ? 'Iniciar Sesión' : 'Login'}</span>
            </button>
          )}

          <button 
            onClick={() => setShowDonateModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 rounded-lg transition-all text-xs font-bold shadow-lg shadow-pink-500/20"
          >
            <Heart className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">{lang === 'es' ? 'Apoyar' : 'Support'}</span>
          </button>
          
          {!isPremium && (
          <button 
            onClick={() => setShowPremiumModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-lg transition-all text-xs font-bold shadow-lg shadow-yellow-500/20"
          >
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">{t.premium}</span>
          </button>
          )}
<button onClick={() => setLang(l => l === 'en' ? 'es' : 'en')} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all text-xs font-bold">
            <Languages className="w-4 h-4" />
            {lang.toUpperCase()}
          </button>
        </div>
      </nav>

      <main className="w-full max-w-6xl space-y-8">
        {status === AppStatus.IDLE && (
          <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{t.title}</h2>
            <p className="text-slate-400 text-lg mb-6 max-w-2xl mx-auto leading-relaxed">{t.subtitle}</p>
            <div className="flex justify-center mb-10">
              <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
          {(['bundle', 'reverse', 'github'] as AppMode[]).map(m => (
            <button 
              key={m} 
              onClick={() => { setMode(m); reset(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${mode === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              {m === 'bundle' && <FileArchive className="w-3.5 h-3.5" />}
              {m === 'reverse' && <ArrowLeftRight className="w-3.5 h-3.5" />}
              {m === 'github' && <Github className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{m === 'bundle' ? t.modeBundle : m === 'reverse' ? t.modeReverse : t.modeGithub}</span>
            </button>
          ))}
        </div>
            </div>

            
            {mode === 'bundle' && (
              <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-700 rounded-[3rem] cursor-pointer bg-slate-900/30 hover:bg-slate-900/50 transition-all hover:border-indigo-500/50 group shadow-2xl">
                <div className="p-8 bg-slate-800 rounded-full mb-6 group-hover:scale-110 transition-transform shadow-xl border border-slate-700">
                  <Upload className="w-12 h-12 text-indigo-400" />
                </div>
                <span className="text-2xl font-bold text-white mb-2">{t.upload}</span>
                <span className="text-slate-500">{t.uploadSubtitle}</span>
                <input type="file" className="hidden" accept=".zip" onChange={handleFileUpload} />
              </label>
            )}

            {mode === 'reverse' && (
              <div className="w-full space-y-4">
                <textarea 
                  value={reverseText}
                  onChange={(e) => setReverseText(e.target.value)}
                  placeholder={t.reversePlaceholder}
                  className="w-full h-96 bg-slate-900/50 border-2 border-slate-800 rounded-[2rem] p-6 text-slate-300 mono text-sm focus:border-indigo-500 outline-none transition-all scrollbar-thin scrollbar-thumb-slate-700"
                />
                <button 
                  onClick={handleReverse}
                  disabled={!reverseText}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-3 mx-auto"
                >
                  <RefreshCcw className="w-6 h-6" />
                  {t.reverseAction}
                </button>
              </div>
            )}

            {mode === 'github' && (
              <div className="max-w-xl mx-auto space-y-6 bg-slate-900/50 p-10 rounded-[2.5rem] border border-slate-800">
                <Github className="w-16 h-16 text-white mx-auto mb-4" />
                <div className="relative">
                  <input 
                    type="text" 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder={t.githubPlaceholder}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl py-4 px-6 text-white focus:border-indigo-500 outline-none transition-all pr-32"
                  />
                  <button 
                    onClick={handleGithubImport}
                    className="absolute right-2 top-2 bottom-2 bg-indigo-600 hover:bg-indigo-500 px-4 rounded-xl text-sm font-bold transition-all"
                  >
                    {t.import}
                  </button>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2 justify-center italic">
                  <Info className="w-3 h-3" /> Only public repositories are supported browser-side.
                </p>
              </div>
            )}
          </div>
        )}

        {status === AppStatus.PROCESSING && (
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-16 flex flex-col items-center text-center shadow-2xl max-w-2xl mx-auto">
            <div className="relative w-24 h-24 mb-8">
              <RefreshCcw className="w-24 h-24 text-indigo-500 animate-spin absolute inset-0" />
              <Zap className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-3">{t.analyzing}</h2>
            <p className="text-slate-400 mono text-sm mb-6">{archiveName}</p>
            
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700 mb-4">
              <Info className="w-4 h-4 text-indigo-400" />
              <p className="text-xs text-slate-400">{t.largeProjectWarning}</p>
            </div>
            
            {currentFile && (
              <div className="mt-4 bg-indigo-500/10 border border-indigo-500/30 px-6 py-3 rounded-xl max-w-md">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t.reading}</p>
                <p className="text-sm text-white font-mono truncate">{currentFile}</p>
              </div>
            )}
          </div>
        )}

        {status === AppStatus.LOADED && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <ListFilter className="w-6 h-6 text-indigo-400" />
                    {t.included}
                  </h3>
                  <div className="flex bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => setFiles(f => f.map(x => ({ ...x, selected: true })))} className="px-4 py-1.5 text-xs font-bold text-indigo-400 hover:bg-slate-700 rounded-lg transition-all">{t.selectAll}</button>
                    <button onClick={() => setFiles(f => f.map(x => ({ ...x, selected: false })))} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-700 rounded-lg transition-all">{t.deselectAll}</button>
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto space-y-2 pr-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {files.map(f => (
                    <div 
                      key={f.path} 
                      onClick={() => toggleFile(f.path)} 
                      className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${f.selected ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-slate-800/20 border-slate-800 hover:bg-slate-800/40'}`}
                    >
                      <div className={`p-2 rounded-lg transition-colors ${f.selected ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                        {f.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-white">{f.path}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">{f.language}</span>
                          <span className="text-[10px] text-slate-500 font-bold">{f.lines.toLocaleString()} lines</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${f.selected ? 'text-indigo-400 opacity-100' : 'text-slate-700 opacity-0 group-hover:opacity-100'}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-3"><Settings className="w-5 h-5 text-indigo-400" />{t.options}</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-[0.2em]">{t.format}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['txt', 'md', 'json'] as OutputFormat[]).map(f => (
                        <button 
                          key={f} 
                          onClick={() => setOutputFormat(f)} 
                          className={`py-3 rounded-xl text-xs font-black uppercase transition-all ${outputFormat === f ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-[0.2em]">{t.template}</label>
                    <select 
                      value={aiTemplate} 
                      onChange={e => setAiTemplate(e.target.value as AITemplate)} 
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl py-3 px-4 text-sm font-bold text-white focus:border-indigo-500 outline-none appearance-none"
                    >
                      <option value="none">Standard Plain Text</option>
                      <option value="claude">Claude Optimized (XML)</option>
                      <option value="chatgpt">ChatGPT Optimized</option>
                      <option value="gemini">Gemini Native Instructions</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-3"><PieChart className="w-5 h-5 text-indigo-400" />{t.stats}</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-slate-800/50">
                    <span className="text-xs font-bold text-slate-500 uppercase">Files</span>
                    <span className="text-lg font-black text-white">{stats.count}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-slate-800/50">
                    <span className="text-xs font-bold text-slate-500 uppercase">Total Lines</span>
                    <span className="text-lg font-black text-white">{stats.lines.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats.languages).map(([l, c]) => (
                        <div key={l} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                          <span className="text-[10px] text-white font-black uppercase">{l}</span>
                          <span className="text-[10px] text-indigo-400 font-bold">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleGenerate} 
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-[1.5rem] font-black text-lg shadow-2xl shadow-indigo-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
              >
                <Zap className="w-6 h-6" /> {t.generate.toUpperCase()}
              </button>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner">
                  <CheckCircle className="w-12 h-12 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-tight">{t.ready}</h2>
                  <p className="text-slate-400 font-medium">
                    <span className="text-white font-bold">{result.totalFiles}</span> {t.processed} 
                    <span className="mx-2 text-slate-700">•</span> 
                    <span className="text-indigo-400 font-bold">{(result.totalSize / 1024).toFixed(1)} KB</span> total
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={handleCopy} 
                  className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all ${copying ? 'bg-emerald-600 text-white scale-95 shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-white shadow-xl'}`}
                >
                  {copying ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copying ? t.copied.toUpperCase() : t.copy.toUpperCase()}
                </button>
                <button 
                  onClick={() => {
                    const blob = new Blob([result.bundleText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; 
                    a.download = `bundle_${archiveName}.${outputFormat === 'json' ? 'json' : outputFormat === 'md' ? 'md' : 'txt'}`;
                    a.click();
                  }} 
                  className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-2xl shadow-indigo-600/30 transition-all hover:scale-[1.05]"
                >
                  <Download className="w-5 h-5" /> {t.download.toUpperCase()}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]"><FileText className="w-4 h-4 text-indigo-400" /> {t.preview}</div>
                  <button onClick={reset} className="p-2 text-slate-600 hover:text-red-400 transition-all hover:rotate-90"><Trash2 className="w-5 h-5" /></button>
                </div>
                <div className="relative bg-[#050b18]">
                  <pre className="p-8 h-[500px] overflow-auto mono text-[11px] leading-relaxed text-slate-400 scrollbar-thin scrollbar-thumb-slate-800">
                    {result.bundleText}
                  </pre>
                  <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#050b18] to-transparent pointer-events-none" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center gap-3">
                  <Trees className="w-4 h-4 text-indigo-400" />
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{t.tree}</span>
                </div>
                <div className="relative bg-[#050b18]">
                  <pre className="p-8 h-[500px] overflow-auto mono text-[11px] leading-relaxed text-indigo-400/80 scrollbar-thin scrollbar-thumb-slate-800 font-bold">
                    {result.tree}
                  </pre>
                  <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#050b18] to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="w-full bg-red-950/10 border border-red-500/30 rounded-[3rem] p-16 text-center animate-in shake duration-500 shadow-2xl">
            <div className="p-6 bg-red-500/20 rounded-full w-fit mx-auto mb-8 shadow-xl">
              <AlertCircle className="w-16 h-16 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-3 uppercase tracking-tight">{t.errorTitle}</h2>
            <p className="text-red-400/80 text-lg mb-10 max-w-lg mx-auto font-medium">{error}</p>
            <button 
              onClick={reset}
              className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black shadow-xl transition-all hover:scale-[1.05]"
            >
              {t.tryAgain.toUpperCase()}
            </button>
          </div>
        )}

        {status === AppStatus.LIMIT_REACHED && (
          <div className="bg-slate-900 border-2 border-indigo-500/30 rounded-[3rem] p-12 md:p-16 text-center max-w-3xl mx-auto shadow-[0_0_100px_-20px_rgba(79,70,229,0.3)] relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-[100px]" />
            
            <div className="relative z-10">
              <div className="p-6 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 rounded-[2rem] w-fit mx-auto mb-10 border border-indigo-500/20 shadow-2xl">
                <Crown className="w-16 h-16 text-indigo-400" />
              </div>

              <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">{t.limitReached}</h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed max-w-xl mx-auto font-medium">
                {t.limitDesc}
              </p>

              <div className="space-y-4 mb-8">
                {!user && (
                  <button 
                    onClick={() => {
                      setStatus(AppStatus.IDLE);
                      setShowLoginModal(true);
                    }}
                    className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-2xl shadow-indigo-600/30 transition-all hover:scale-[1.05]"
                  >
                    {lang === 'es' ? 'INICIAR SESIÓN PARA PREMIUM' : 'LOGIN FOR PREMIUM'}
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    setStatus(AppStatus.IDLE);
                    setShowCodeModal(true);
                  }}
                  className="px-10 py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-2xl font-black shadow-2xl shadow-yellow-600/30 transition-all hover:scale-[1.05]"
                >
                  {t.haveCode.toUpperCase()}
                </button>
                
                <button 
                  onClick={() => {
                    setStatus(AppStatus.IDLE);
                    setShowPremiumModal(true);
                  }}
                  className="px-10 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-2xl font-black shadow-2xl transition-all hover:scale-[1.05]"
                >
                  {t.upgradePremium.toUpperCase()}
                </button>
              </div>

              <button 
                onClick={() => setStatus(AppStatus.IDLE)}
                className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black shadow-xl transition-all hover:scale-[1.05]"
              >
                {t.close.toUpperCase()}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 pb-16 text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] flex flex-col items-center gap-4">
        <div className="flex flex-wrap gap-6 justify-center">
          <button onClick={() => setShowPrivacyModal(true)} className="hover:text-indigo-400 cursor-pointer transition-colors">{t.privacyPolicy}</button>
          <button onClick={() => setShowSupportModal(true)} className="hover:text-indigo-400 cursor-pointer transition-colors">{t.support}</button>
          <button onClick={() => setShowApiModal(true)} className="hover:text-indigo-400 cursor-pointer transition-colors">{t.apiAccess}</button>
        </div>
        <div className="text-slate-700">Made with ❤️ by Developers</div>
      </footer>

      {/* MODAL DE LOGIN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowLoginModal(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-indigo-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-20px_rgba(99,102,241,0.5)] animate-in zoom-in duration-500">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 rounded-full mb-6">
                <Lock className="w-16 h-16 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{lang === 'es' ? 'Iniciar Sesión' : 'Sign In'}</h2>
              <p className="text-slate-400 leading-relaxed">{lang === 'es' ? 'Inicia sesión para desbloquear funciones Premium' : 'Sign in to unlock Premium features'}</p>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold shadow-xl transition-all hover:scale-[1.02]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {lang === 'es' ? 'Continuar con Google' : 'Continue with Google'}
            </button>

            <p className="text-center text-xs text-slate-500 mt-6">
              {lang === 'es' ? 'Al iniciar sesión, aceptas nuestros términos de servicio' : 'By signing in, you agree to our terms of service'}
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE CÓDIGO PREMIUM */}
      {showCodeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowCodeModal(false)} />
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-yellow-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-20px_rgba(234,179,8,0.5)] animate-in zoom-in duration-500">
            <button onClick={() => setShowCodeModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-yellow-500/20 to-orange-500/20 rounded-full mb-6">
                <Crown className="w-16 h-16 text-yellow-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{t.activateCode}</h2>
              <p className="text-slate-400 leading-relaxed">{t.enterCode}</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                value={premiumCode}
                onChange={(e) => {
                  setPremiumCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                placeholder="PREMIUM2026"
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl py-4 px-6 text-white text-center text-lg font-bold uppercase focus:border-yellow-500 outline-none transition-all"
              />
              
              {codeError && (
                <p className="text-red-400 text-sm text-center">{codeError}</p>
              )}

              <button 
                onClick={handleActivateCode}
                disabled={!premiumCode.trim()}
                className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xl transition-all"
              >
                {t.activate}
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 mt-6">
              {lang === 'es' ? '¿No tienes un código? Compra Premium arriba.' : "Don't have a code? Purchase Premium above."}
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE DONAR */}
      {showDonateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowDonateModal(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-pink-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-20px_rgba(236,72,153,0.5)] animate-in zoom-in duration-500">
            <button onClick={() => setShowDonateModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-pink-500/20 to-red-500/20 rounded-full mb-6 animate-pulse">
                <Heart className="w-16 h-16 text-pink-500 fill-pink-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{t.donateTitle}</h2>
              <p className="text-slate-400 leading-relaxed max-w-md mx-auto">{t.donateDesc}</p>
            </div>

            <div className="space-y-4 mb-6">
              <a 
                href="https://paypal.me/CodeBundlerPro" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-xl transition-all hover:scale-[1.02]"
              >
                <CreditCard className="w-5 h-5" />
                {lang === 'es' ? 'Donar con PayPal' : 'Donate with PayPal'}
              </a>

              <a 
                href="https://www.buymeacoffee.com/codebundler" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold shadow-xl transition-all hover:scale-[1.02]"
              >
                <span className="text-xl">☕</span>
                {lang === 'es' ? 'Invítame un Café' : 'Buy Me a Coffee'}
              </a>
            </div>

            <p className="text-center text-xs text-slate-500 mb-8">{t.donateAmount}</p>

            <button 
              onClick={() => setShowDonateModal(false)}
              className="w-full py-3 text-slate-500 hover:text-white font-bold transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL PREMIUM */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowPremiumModal(false)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-yellow-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-20px_rgba(234,179,8,0.5)] animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <button onClick={() => setShowPremiumModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-yellow-500/20 to-orange-500/20 rounded-full mb-6">
                <Crown className="w-16 h-16 text-yellow-400" />
              </div>
              <h2 className="text-4xl font-black text-white mb-3">{t.upgradePremium}</h2>
              <p className="text-slate-400 leading-relaxed max-w-md mx-auto">{t.premiumFeatures}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-indigo-500/50 transition-all">
                <h3 className="text-xl font-bold text-white mb-2">Premium Monthly</h3>
                <p className="text-3xl font-black text-indigo-400 mb-4">$4.99<span className="text-sm text-slate-500">/month</span></p>
                <ul className="space-y-2 text-sm text-slate-300 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Unlimited conversions</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Priority support</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> No ads</li>
                </ul>
                <button 
                  onClick={() => alert(lang === 'es' ? 'Contacta a support@codebundler.com para obtener Premium' : 'Contact support@codebundler.com to get Premium')}
                  className="block w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-center transition-all"
                >
                  {lang === 'es' ? 'Obtener Mensual' : 'Get Monthly'}
                </button>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-6 border-2 border-yellow-500/50 hover:border-yellow-500 transition-all relative">
                <div className="absolute -top-3 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-black">
                  {lang === 'es' ? 'AHORRA 18%' : 'SAVE 18%'}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Premium Annual</h3>
                <p className="text-3xl font-black text-yellow-400 mb-4">$49<span className="text-sm text-slate-500">/year</span></p>
                <ul className="space-y-2 text-sm text-slate-300 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Everything in Monthly</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-yellow-400" /> Save $10.88/year</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-yellow-400" /> Early access to features</li>
                </ul>
                <button 
                  onClick={() => alert(lang === 'es' ? 'Contacta a support@codebundler.com para obtener Premium' : 'Contact support@codebundler.com to get Premium')}
                  className="block w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold text-center transition-all"
                >
                  {lang === 'es' ? 'Obtener Anual' : 'Get Annual'}
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-2xl p-6 border border-cyan-500/30 mb-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                {t.apiTitle}
              </h3>
              <p className="text-sm text-slate-400 mb-4">{t.apiDesc}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-cyan-400">{t.apiPricing}</span>
                <button 
                  onClick={() => {
                    setShowPremiumModal(false);
                    setShowApiModal(true);
                  }}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-all"
                >
                  {lang === 'es' ? 'Más info' : 'Learn More'}
                </button>
              </div>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-300 text-center">
                {lang === 'es' ? '¿Ya tienes un código premium?' : 'Already have a premium code?'}
                <button 
                  onClick={() => {
                    setShowPremiumModal(false);
                    setShowCodeModal(true);
                  }}
                  className="ml-2 text-yellow-400 font-bold hover:underline"
                >
                  {lang === 'es' ? 'Activar aquí' : 'Activate here'}
                </button>
              </p>
            </div>

            <button 
              onClick={() => setShowPremiumModal(false)}
              className="w-full py-3 text-slate-500 hover:text-white font-bold transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE PRIVACY */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowPrivacyModal(false)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 md:p-10 shadow-2xl animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <button onClick={() => setShowPrivacyModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-slate-500/20 to-slate-700/20 rounded-full mb-6">
                <Shield className="w-16 h-16 text-slate-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{t.privacyPolicy}</h2>
            </div>

            <div className="space-y-6 text-slate-300 text-sm">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? 'Recopilación de Datos' : 'Data Collection'}</h3>
                <p>{lang === 'es' ? 'CodeBundler Pro procesa todos los archivos localmente en tu navegador. No almacenamos tu código en nuestros servidores.' : 'CodeBundler Pro processes all files locally in your browser. We do not store your code on our servers.'}</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? 'Autenticación' : 'Authentication'}</h3>
                <p>{lang === 'es' ? 'Usamos Firebase Authentication para gestionar cuentas de usuario de forma segura.' : 'We use Firebase Authentication to manage user accounts securely.'}</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? 'Cookies' : 'Cookies'}</h3>
                <p>{lang === 'es' ? 'Usamos cookies solo para mantener tu sesión activa y preferencias de idioma.' : 'We use cookies only to maintain your session and language preferences.'}</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? 'Seguridad' : 'Security'}</h3>
                <p>{lang === 'es' ? 'Todos los datos se transmiten usando HTTPS. Tu código nunca sale de tu dispositivo excepto cuando usas importación de GitHub (que es pública).' : 'All data is transmitted using HTTPS. Your code never leaves your device except when using GitHub import (which is public).'}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowPrivacyModal(false)}
              className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE SUPPORT */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowSupportModal(false)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 md:p-10 shadow-2xl animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <button onClick={() => setShowSupportModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 rounded-full mb-6">
                <HelpCircle className="w-16 h-16 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{t.support}</h2>
            </div>

            <div className="space-y-6 text-slate-300">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? '¿Cómo funciona?' : 'How does it work?'}</h3>
                <p className="text-sm">{lang === 'es' ? 'Sube tu archivo ZIP, selecciona los archivos que quieres incluir, elige un formato y genera tu bundle listo para copiar o descargar.' : 'Upload your ZIP file, select which files to include, choose a format, and generate your bundle ready to copy or download.'}</p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? '¿Es seguro?' : 'Is it safe?'}</h3>
                <p className="text-sm">{lang === 'es' ? 'Sí, todo el procesamiento se hace localmente en tu navegador. Tu código nunca sale de tu dispositivo.' : 'Yes, all processing is done locally in your browser. Your code never leaves your device.'}</p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? '¿Qué formatos soporta?' : 'What formats are supported?'}</h3>
                <p className="text-sm">{lang === 'es' ? 'TXT, Markdown y JSON. Además tenemos plantillas optimizadas para Claude, ChatGPT y Gemini.' : 'TXT, Markdown, and JSON. We also have templates optimized for Claude, ChatGPT, and Gemini.'}</p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-2">{lang === 'es' ? 'Contacto' : 'Contact'}</h3>
                <a href="mailto:support@codebundler.com" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  support@codebundler.com
                </a>
              </div>
            </div>

            <button 
              onClick={() => setShowSupportModal(false)}
              className="w-full mt-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE API */}
      {showApiModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setShowApiModal(false)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-cyan-500/30 rounded-3xl p-8 md:p-10 shadow-[0_0_100px_-20px_rgba(6,182,212,0.5)] animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <button onClick={() => setShowApiModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90">
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-5 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-full mb-6">
                <Code className="w-16 h-16 text-cyan-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">{t.apiTitle}</h2>
              <p className="text-slate-400 leading-relaxed">{t.apiDesc}</p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">{lang === 'es' ? 'Ejemplo de uso' : 'Usage Example'}</h3>
              <pre className="bg-slate-900 p-4 rounded-lg text-xs text-cyan-400 overflow-x-auto">
{`curl -X POST https://api.codebundler.com/v1/bundle \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@project.zip" \\
  -F "format=md"`}
              </pre>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-xl">
                <span className="text-white font-bold">{lang === 'es' ? 'Precio' : 'Price'}</span>
                <span className="text-cyan-400 text-xl font-black">{t.apiPricing}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-xl">
                <span className="text-white font-bold">{lang === 'es' ? 'Límite' : 'Rate Limit'}</span>
                <span className="text-slate-300">1,000 {lang === 'es' ? 'llamadas/mes' : 'calls/month'}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-xl">
                <span className="text-white font-bold">{lang === 'es' ? 'Tiempo de respuesta' : 'Response Time'}</span>
                <span className="text-slate-300">&lt; 2s {lang === 'es' ? 'promedio' : 'average'}</span>
              </div>
            </div>

            <a 
              href="mailto:api@codebundler.com?subject=API Access Request"
              className="block w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-center transition-all"
            >
              {lang === 'es' ? 'Solicitar Acceso API' : 'Request API Access'}
            </a>

            <button 
              onClick={() => setShowApiModal(false)}
              className="w-full mt-4 py-3 text-slate-500 hover:text-white font-bold transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-red-500/30 rounded-3xl p-8 shadow-[0_0_80px_-20px_rgba(239,68,68,0.45)] animate-in zoom-in duration-300">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-all hover:rotate-90"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center">
              <div className="inline-flex p-5 bg-red-500/10 rounded-full mb-6">
                <AlertCircle className="w-14 h-14 text-red-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">
                {lang === 'es' ? '¿Cerrar sesión?' : 'Log out?'}
              </h2>
              <p className="text-slate-400 mb-8">
                {lang === 'es'
                  ? '¿Seguro que quieres cerrar sesión?'
                  : 'Are you sure you want to log out?'}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                >
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all"
                >
                  {lang === 'es' ? 'Salir' : 'Logout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

