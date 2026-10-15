import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Info,
  Facebook,
  Twitter,
  MessageCircle,
  Share2,
  LogOut,
  MapPin,
  Map,
  Mail,
  CreditCard,
  Camera,
  Sparkles,
  Maximize2,
  X,
  Users,
  Printer,
  Download,
  Send,
  ExternalLink,
  FileText,
  Settings,
  Database,
  Search
} from 'lucide-react';
import { APP_CONFIG } from './config';
import { AboutGallery } from './components/AboutGallery';
import { AdminRegistrationsModal } from './components/AdminRegistrationsModal';
import { PublicRunnerSearchModal } from './components/PublicRunnerSearchModal';
import { createSupabaseRegistration, isSupabaseConfigured } from './lib/supabase';
import { auth, db } from './lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// --------------------------------------------------------------------------------
// UTILS & HELPERS
// --------------------------------------------------------------------------------

export const getAge = (day: string, month: string, year: string): number | null => {
  if (!day || !month || !year) return null;
  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const getCategoryByAge = (age: number | null): string => {
  if (age === null || isNaN(age)) return '';
  if (age < 5) return `Menor de 5 años (${age} años)`;
  if (age <= 11) return `Infantil / Semillero (5-11 años)`;
  if (age <= 15) return `Juvenil (12-15 años)`;
  if (age <= 29) return `Libre (16-29 años)`;
  if (age <= 39) return `Sub-Master (30-39 años)`;
  if (age <= 49) return `Master A (40-49 años)`;
  if (age <= 59) return `Master B (50-59 años)`;
  return `Master C (60+ años)`;
};

// --------------------------------------------------------------------------------
// VALIDATION SCHEMA (A PARTIR DE 5 AÑOS)
// --------------------------------------------------------------------------------

const registrationSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido (mínimo 2 letras)'),
  apellido: z.string().min(2, 'El apellido es requerido (mínimo 2 letras)'),
  email: z.string().email('Debe ser un correo electrónico válido'),
  cedula: z.string().min(6, 'Cédula requerida (mínimo 6 caracteres)'),
  birthDay: z.string().min(1, 'Día requerido'),
  birthMonth: z.string().min(1, 'Mes requerido'),
  birthYear: z.string().min(4, 'Año requerido'),
}).refine((data) => {
  if (!data.birthDay || !data.birthMonth || !data.birthYear) return true;
  const age = getAge(data.birthDay, data.birthMonth, data.birthYear);
  if (age === null) return true;
  return age >= 5;
}, {
  message: "La edad mínima requerida para registrarse es de 5 años",
  path: ["birthYear"]
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

// --------------------------------------------------------------------------------
// DATES CONSTANTS
// --------------------------------------------------------------------------------

const months = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 95 }, (_, i) => (currentYear - i).toString());

// --------------------------------------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------------------------------------

export default function App() {
  const [session, setSession] = useState<{ fullName: string; idNumber: string } | null>(() => {
    const saved = localStorage.getItem('race_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPublicSearchModal, setShowPublicSearchModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ fullName: '', idNumber: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<{
    fullName: string;
    email: string;
    cedula: string;
    category: string;
    age: number;
    birthDay?: string;
    birthMonth?: string;
    birthYear?: string;
  } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'register' | 'about' | 'contact' | 'history'>('register');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userRegistrations, setUserRegistrations] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; caption: string; tag: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema)
  });

  const watchDay = watch('birthDay');
  const watchMonth = watch('birthMonth');
  const watchYear = watch('birthYear');

  const currentCalculatedAge = getAge(watchDay, watchMonth, watchYear);
  const currentCategory = getCategoryByAge(currentCalculatedAge);

  // Fetch History by ID Number
  const fetchHistory = async (idNumber: string) => {
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'registrations'), 
        where('idNumber', '==', idNumber.trim())
      );
      const querySnapshot = await getDocs(q);
      const regs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Safe client-side sorting
      regs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
        return timeB - timeA;
      });
      setUserRegistrations(regs);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Calculate days based on month and year
  const getDaysInMonth = (month: string, year: string) => {
    if (!month) return 31;
    const m = parseInt(month);
    const y = year ? parseInt(year) : 2000;
    return new Date(y, m, 0).getDate();
  };

  const dynamicDaysCount = getDaysInMonth(watchMonth, watchYear);
  const dynamicDays = Array.from({ length: dynamicDaysCount }, (_, i) => (i + 1).toString());

  // Update effect to use session
  useEffect(() => {
    if (session) {
      const parts = (session.fullName || '').trim().split(' ');
      setValue('nombre', parts[0] || '');
      setValue('apellido', parts.slice(1).join(' ') || '');
      setValue('cedula', session.idNumber);
      fetchHistory(session.idNumber);
    }
  }, [session, setValue]);

  const handleSimpleLogin = () => {
    if (loginForm.fullName && loginForm.idNumber) {
      const newSession = { fullName: loginForm.fullName.trim(), idNumber: loginForm.idNumber.trim() };
      setSession(newSession);
      localStorage.setItem('race_session', JSON.stringify(newSession));
      setShowLoginModal(false);
      setLoginForm({ fullName: '', idNumber: '' });
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('race_session');
    setUserRegistrations([]);
    reset();
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      const calculatedAge = getAge(data.birthDay, data.birthMonth, data.birthYear) || 0;
      const category = getCategoryByAge(calculatedAge);
      const fullName = `${data.nombre.trim()} ${data.apellido.trim()}`;
      const fechaNacimiento = `${data.birthYear}-${data.birthMonth.padStart(2, '0')}-${data.birthDay.padStart(2, '0')}`;

      // 1.0 Save to browser local storage for instant search & offline access
      try {
        const localRaw = localStorage.getItem('race_local_registrations');
        const localList = localRaw ? JSON.parse(localRaw) : [];
        const newLocalRecord = {
          id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          fullName,
          cedula: data.cedula.trim(),
          correo_electronico: data.email.trim().toLowerCase(),
          fecha_nacimiento: fechaNacimiento,
          categoria: category,
          edad: calculatedAge,
          estado: 'confirmado',
          created_at: new Date().toISOString(),
        };
        const filtered = localList.filter((r: any) => r.cedula !== data.cedula.trim());
        filtered.unshift(newLocalRecord);
        localStorage.setItem('race_local_registrations', JSON.stringify(filtered));
      } catch (lsErr) {
        console.warn('LocalStorage save note:', lsErr);
      }

      // 1. PUBLIC ENDPOINT: Call POST /api/registrations (saves to Supabase & local persistent database)
      let serverAdminEmailSent = false;
      try {
        const apiRes = await fetch('/api/registrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nombre: data.nombre.trim(),
            apellido: data.apellido.trim(),
            fullName,
            cedula: data.cedula.trim(),
            correo_electronico: data.email.trim().toLowerCase(),
            email: data.email.trim().toLowerCase(),
            fecha_nacimiento: fechaNacimiento,
            birthDay: data.birthDay,
            birthMonth: data.birthMonth,
            birthYear: data.birthYear,
            categoria: category,
            edad: calculatedAge,
            estado: 'confirmado',
          }),
        });
        if (apiRes.ok) {
          const apiJson = await apiRes.json().catch(() => null);
          serverAdminEmailSent = Boolean(apiJson?.emailDetails?.adminSent);
        }
      } catch (apiError) {
        console.warn('API /api/registrations background call note:', apiError);
      }

      // 1.1 Direct notification dispatch: Ensures johnnyaldanac@gmail.com ALWAYS gets the registration email even on static or serverless hosting
      if (!serverAdminEmailSent) {
        try {
          await fetch('https://formsubmit.co/ajax/johnnyaldanac@gmail.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              _subject: `🚨 Nueva Inscripción: ${fullName} (${category}) - Desafío El Volcán`,
              _template: 'table',
              _captcha: 'false',
              'Atleta': fullName,
              'Cédula / Documento': data.cedula.trim(),
              'Correo del Atleta': data.email.trim().toLowerCase(),
              'Fecha de Nacimiento': `${data.birthDay.padStart(2, '0')}/${data.birthMonth.padStart(2, '0')}/${data.birthYear}`,
              'Edad': `${calculatedAge} años`,
              'Categoría': category,
              'Fecha y Hora': new Date().toLocaleString('es-VE'),
              'Sitio Web': window.location.href,
            }),
          });
        } catch (clientMailErr) {
          console.warn('Client direct email dispatch note:', clientMailErr);
        }
      }

      // 2. Client-side Supabase write if configured directly in browser
      if (isSupabaseConfigured()) {
        try {
          await createSupabaseRegistration({
            nombre: data.nombre.trim(),
            apellido: data.apellido.trim(),
            cedula: data.cedula.trim(),
            correo_electronico: data.email.trim().toLowerCase(),
            fecha_nacimiento: fechaNacimiento,
            categoria: category,
            edad: calculatedAge,
          });
        } catch (sbErr) {
          console.warn('Client Supabase direct insert note:', sbErr);
        }
      }

      // 3. Save to Firestore for real-time app persistence
      try {
        await addDoc(collection(db, 'registrations'), {
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          fullName,
          email: data.email.trim().toLowerCase(),
          idNumber: data.cedula.trim(),
          cedula: data.cedula.trim(),
          birthDay: data.birthDay,
          birthMonth: data.birthMonth,
          birthYear: data.birthYear,
          fechaNacimiento,
          age: calculatedAge,
          category,
          userId: session?.idNumber || 'anonymous',
          createdAt: serverTimestamp(),
          status: 'registered'
        });
      } catch (fsError) {
        console.warn('Firestore write note:', fsError);
      }

      // Also keep local offline copy for participant safety
      try {
        const backupKey = 'desafio_local_registrations';
        const existing = JSON.parse(localStorage.getItem(backupKey) || '[]');
        existing.unshift({
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          fullName,
          cedula: data.cedula.trim(),
          email: data.email.trim().toLowerCase(),
          birthDay: data.birthDay,
          birthMonth: data.birthMonth,
          birthYear: data.birthYear,
          fechaNacimiento,
          category,
          age: calculatedAge,
          createdAt: new Date().toISOString(),
          id: `reg_${Date.now()}`
        });
        localStorage.setItem(backupKey, JSON.stringify(existing.slice(0, 50)));
      } catch (storageErr) {
        console.warn('Local backup note:', storageErr);
      }

      setLastRegistered({
        fullName,
        email: data.email.trim().toLowerCase(),
        cedula: data.cedula.trim(),
        category,
        age: calculatedAge,
        birthDay: data.birthDay,
        birthMonth: data.birthMonth,
        birthYear: data.birthYear,
      });

      setIsSubmitted(true);
      reset();
      if (session) fetchHistory(session.idNumber);
    } catch (error) {
      console.error('Registration Error:', error);
      setSubmissionError('Ocurrió un inconveniente al procesar la inscripción. Por favor verifica tus datos e inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const NavMenu = () => (
    <div className="fixed top-4 sm:top-6 right-4 sm:right-6 z-50 flex items-center gap-2 sm:gap-2.5">
      {/* PUBLIC RUNNER SEARCH BUTTON (OPEN FOR EVERYONE) */}
      <button
        onClick={() => setShowPublicSearchModal(true)}
        className="flex items-center gap-2 bg-white hover:bg-orange-50 text-gray-800 hover:text-orange-600 px-3 sm:px-3.5 py-2.5 sm:py-3 rounded-2xl shadow-xl border border-gray-200/90 transition-all active:scale-95 group"
        title="Buscar corredores inscritos por cédula o nombre (público para todos)"
      >
        <div className="p-1 bg-orange-100 text-orange-600 rounded-lg group-hover:scale-110 transition-transform">
          <Search size={14} className="stroke-[2.5]" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-black tracking-tight leading-none">Buscar Corredor</span>
          <span className="text-[9px] text-gray-500 font-bold leading-none mt-0.5 hidden xs:inline">Cédula o Nombre</span>
        </div>
      </button>

      {/* DIRECT CONTROL PANEL BUTTON */}
      <button
        onClick={() => setShowAdminModal(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-xl border border-gray-700/60 transition-all active:scale-95 group"
        title="Abrir Panel de Control de Corredores (Administración)"
      >
        <div className="p-1 bg-orange-500 rounded-lg text-white group-hover:scale-110 transition-transform">
          <Users size={14} className="stroke-[2.5]" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-black tracking-tight leading-none">Panel de Control</span>
          <span className="text-[9px] text-orange-400 font-bold leading-none mt-0.5">Admin</span>
        </div>
      </button>

      {/* HAMBURGER MENU BUTTON */}
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="bg-white p-3 sm:p-3.5 rounded-2xl shadow-xl border border-gray-100 hover:bg-gray-50 transition-all group"
        title="Menú"
      >
        <div className="space-y-1.5">
          <motion.div 
            animate={isMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
            className="w-6 h-0.5 bg-gray-900 rounded-full" 
          />
          <motion.div 
            animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
            className="w-6 h-0.5 bg-gray-900 rounded-full" 
          />
          <motion.div 
            animate={isMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
            className="w-6 h-0.5 bg-gray-900 rounded-full" 
          />
        </div>
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-16 right-0 w-64 bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-4 ring-1 ring-black/5"
          >
            <nav className="flex flex-col space-y-2">
              {[
                { id: 'register', label: 'Inscríbete', icon: Trophy },
                { id: 'history', label: 'Mis Inscripciones', icon: Calendar, needsAuth: true },
                { id: 'about', label: '¿Quiénes somos?', icon: Info },
                { id: 'contact', label: 'Contacto', icon: UserIcon }
              ].map((item) => (
                (!item.needsAuth || session) && (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id as any);
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center space-x-3 p-3.5 rounded-2xl font-bold transition-all ${
                      currentView === item.id 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                )
              ))}

              <div className="pt-3 mt-3 border-t border-gray-100">
                {session ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3 px-4 py-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold text-xs">
                        {session.fullName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-900 truncate max-w-[120px]">{session.fullName}</span>
                        <span className="text-[8px] text-gray-500 truncate max-w-[120px]">ID: {session.idNumber}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 p-3.5 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all"
                    >
                      <LogOut size={18} />
                      <span>Salir</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowLoginModal(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-3 p-3.5 rounded-2xl font-bold text-gray-900 hover:bg-gray-50 transition-all"
                  >
                    <UserIcon size={18} />
                    <span>Acceder / Historial</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowPublicSearchModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 rounded-2xl font-black text-orange-700 bg-orange-50 hover:bg-orange-100 transition-all text-left mt-2 border border-orange-200/80 shadow-xs"
                >
                  <div className="p-1.5 bg-orange-500 text-white rounded-xl">
                    <Search size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black">Buscar Corredor</span>
                    <span className="text-[9px] text-orange-600 font-bold">Consultar por Cédula o Nombre</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowAdminModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 rounded-2xl font-black text-white bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 transition-all text-left mt-2 shadow-md border border-gray-800"
                >
                  <div className="p-1.5 bg-orange-500 text-white rounded-xl">
                    <Users size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black">Panel de Control</span>
                    <span className="text-[9px] text-orange-300 font-medium">Ver Corredores Inscritos</span>
                  </div>
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-[#1a1a1a] p-4 md:p-8 relative">
      <NavMenu />
      
      {currentView === 'about' ? (
        /* FULL-PAGE VIEW FOR ¿QUIÉNES SOMOS? */
        <motion.div
          key="about-full-page"
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.99 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto mb-12"
        >
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 md:p-12 shadow-2xl shadow-gray-200/50 border border-gray-50 flex flex-col space-y-8 text-left">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                  <Trophy size={14} />
                  <span>Historia & Legado</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-[#1a1a1a] tracking-tight">
                  ¿Quiénes somos?
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className="self-start sm:self-center flex items-center space-x-2 px-5 py-3 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-2xl text-xs transition-all active:scale-95 shadow-sm"
              >
                <span>Ir al Registro</span>
                <ChevronRight size={16} />
              </button>
            </div>

            {/* STORY CONTENT & HISTORICAL GALLERY */}
            <div className="space-y-8 text-gray-600 font-medium text-base md:text-lg leading-relaxed">
              <p>
                El <strong className="text-gray-900 font-black">Desafío al Volcán</strong> nació como una propuesta innovadora gracias al impulso de sus pilares fundadores: <span className="font-bold text-gray-800">Ricardo Sanguino, Manuel Rojas, Carmen Contreras, Reyes Aldana</span> y las marcas que decidieron apostar por el proyecto desde el primer momento. En sus inicios, comenzó exclusivamente como una competencia de ciclismo y, con el tiempo, incorporó la modalidad de trail running.
              </p>

              {/* RUTAS ORIGINALES TEXT BOX */}
              <div className="bg-orange-50/70 p-6 md:p-8 rounded-3xl border border-orange-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-orange-600 flex items-center gap-2">
                  <Map size={18} /> Las rutas originales
                </h4>
                
                <ul className="space-y-4 text-sm md:text-base text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                    <span><strong className="text-gray-900 font-bold">Ciclismo:</strong> Inicia desde Las Mercedes y culminaba en la Hacienda Topito, ascendiendo al volcán por la vía de asfalto.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-2 shrink-0" />
                    <span><strong className="text-gray-900 font-bold">Trail Running:</strong> Iniciaba desde el Polideportivo de La Trinidad, pero adentrándose por los senderos de la montaña del volcán hasta llegar a la misma hacienda.</span>
                  </li>
                </ul>
              </div>

              {/* DYNAMIC HISTORICAL PHOTO GALLERY */}
              <AboutGallery onSelectImage={setSelectedImage} />

              <p>
                Hoy comienza una <strong className="text-gray-900 font-black">nueva era para el Desafío al Volcán</strong>. Este renacimiento está liderado por <span className="font-bold text-gray-800">Reyes Aldana y Carmen Contreras</span> (dos de sus figuras históricas más importantes) junto a la incorporación de <span className="font-bold text-gray-800">Johnny Aldana</span>.
              </p>

              <div className="p-6 md:p-8 bg-gray-50 rounded-3xl border border-gray-100 text-gray-700 text-sm md:text-base leading-relaxed">
                <p>
                  Este proyecto busca marcar un punto de partida y rescatar aquellas emblemáticas carreras que con los años se han perdido, honrando el esfuerzo y el sacrificio de los organizadores que abrieron camino. <span className="font-black text-orange-600">¡Venimos con todo y con muchos proyectos más por delante!</span>
                </p>
              </div>
            </div>

            {/* FOOTER CALL TO ACTION */}
            <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                Desafío El Volcán — New Era
              </p>
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-orange-200 transition-all flex items-center justify-center space-x-2 text-sm"
              >
                <span>Volver e Inscribirse</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        
        {/* LEFT COLUMN: INFO & HEADER */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-5 flex flex-col justify-start space-y-8"
        >
          <header>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Trophy size={14} />
              <span>Inscripciones Abiertas</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-[#1a1a1a] leading-[0.9] tracking-tighter mb-2">
              {APP_CONFIG.raceName.split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </h1>
            <p className="text-sm font-bold text-orange-500 uppercase tracking-[0.2em] mb-4">
              new era
            </p>
            <p className="text-gray-500 font-medium max-w-sm">
              Únete a la gran fiesta de running y trail en Caracas. Vive la pasión por la montaña y el deporte.
            </p>
          </header>

          {/* EVENT DETAILS BOX */}
          <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50" />
            <h3 className="text-lg font-bold flex items-center space-x-2 mb-4 relative z-10">
              <Trophy className="text-orange-500" />
              <span>Información del Evento</span>
            </h3>
            <div className="space-y-4 relative z-10">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
                  <MapPin size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Ubicación</span>
                  <span className="text-sm font-bold text-gray-800">{APP_CONFIG.eventInfo.location}</span>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
                  <Trophy size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Modalidad</span>
                  <span className="text-sm font-bold text-gray-800">{APP_CONFIG.eventInfo.distance}</span>
                </div>
              </div>
            </div>
          </section>

          <footer className="hidden lg:block pt-4 text-left">
            <div className="flex items-center space-x-4 opacity-30 grayscale hover:grayscale-0 transition-all">
              <div className="h-[1px] flex-1 bg-gray-300" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Desafío El Volcán</span>
            </div>
          </footer>
        </motion.div>

        {/* RIGHT COLUMN: CONTENT AREAS */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-7"
        >
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-gray-200/50 border border-gray-50 min-h-[500px] flex flex-col">
            <AnimatePresence mode="wait">
              {currentView === 'register' && !isSubmitted && (
                <motion.form 
                  key="registration-form"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-6 text-left"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">Formulario de Registro</h2>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">Completa los datos del participante para asegurar su cupo.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPublicSearchModal(true)}
                          className="flex items-center space-x-1.5 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/80 rounded-xl text-xs font-black transition-all shadow-xs"
                          title="Buscar corredores inscritos en tiempo real"
                        >
                          <Search size={13} className="text-orange-600 stroke-[2.5]" />
                          <span>Buscar Corredor</span>
                        </button>
                        {!session && (
                          <button
                            type="button"
                            onClick={() => setShowLoginModal(true)}
                            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-xs"
                          >
                            <UserIcon size={12} />
                            <span>Acceso Rápido</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* NOMBRE Y APELLIDO (SEPARADOS) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                          <UserIcon size={12} /> Nombre
                        </label>
                        <input
                          {...register('nombre')}
                          className={`w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all ${errors.nombre ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
                          placeholder="Ej. Johnny"
                        />
                        {errors.nombre && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.nombre.message}</p>}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                          <UserIcon size={12} /> Apellido
                        </label>
                        <input
                          {...register('apellido')}
                          className={`w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all ${errors.apellido ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
                          placeholder="Ej. Aldana"
                        />
                        {errors.apellido && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.apellido.message}</p>}
                      </div>
                    </div>

                    {/* EMAIL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                        <Mail size={12} /> Correo Electrónico (Para confirmación)
                      </label>
                      <input
                        {...register('email')}
                        type="email"
                        className={`w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all ${errors.email ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
                        placeholder="tu@correo.com"
                      />
                      {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.email.message}</p>}
                    </div>

                    {/* CEDULA */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                        <CreditCard size={12} /> Cédula o Documento de Identidad
                      </label>
                      <input
                        {...register('cedula')}
                        className={`w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 transition-all ${errors.cedula ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
                        placeholder="V-25667889"
                      />
                      {errors.cedula && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.cedula.message}</p>}
                    </div>

                    {/* BIRTH DATE */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1 flex items-center gap-2">
                        <Calendar size={12} /> Fecha de Nacimiento
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          {...register('birthMonth')}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 appearance-none"
                        >
                          <option value="">Mes</option>
                          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select
                          {...register('birthDay')}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 appearance-none"
                        >
                          <option value="">Día</option>
                          {dynamicDays.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                          {...register('birthYear')}
                          className="bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500 appearance-none"
                        >
                          <option value="">Año</option>
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>

                      {(errors.birthDay || errors.birthMonth || errors.birthYear) && (
                        <p className="text-[10px] text-red-500 font-bold ml-1">
                          {errors.birthYear?.message || errors.birthDay?.message || errors.birthMonth?.message || "Fecha incompleta"}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-orange-200 transition-all flex items-center justify-center space-x-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        <span>PROCESANDO INSCRIPCIÓN...</span>
                      </>
                    ) : (
                      <>
                        <span>REGISTRAR INSCRIPCIÓN</span>
                        <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                  
                  {submissionError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-left">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-red-700 font-bold">
                        {submissionError}
                      </p>
                    </div>
                  )}

                  {Object.keys(errors).length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-2">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={14} />
                      <p className="text-[10px] text-red-600 font-bold">
                        Hay errores en el formulario. Por favor revisa los campos marcados en rojo.
                      </p>
                    </div>
                  )}
                </motion.form>
              )}

              {currentView === 'register' && isSubmitted && (
                <motion.div 
                  key="success-message"
                  initial={{ opacity: 0, scale: 0.95, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center justify-center flex-1 text-center space-y-6 py-6"
                >
                  {/* SUCCESS CELEBRATION ICON */}
                  <div className="relative">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-100">
                      <CheckCircle2 size={46} className="text-emerald-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white p-1.5 rounded-full shadow-md">
                      <Trophy size={14} />
                    </div>
                  </div>

                  <div className="w-full max-w-lg">
                    {/* STATUS BADGE */}
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider mb-3 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Inscripción Exitosa</span>
                    </div>

                    {/* MAIN CONFIRMATION MESSAGE */}
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-2 leading-tight">
                      ¡Ya estás inscrito, te esperamos!
                    </h2>

                    <p className="text-gray-600 font-medium max-w-md mx-auto mb-6 text-sm sm:text-base leading-relaxed">
                      Tu registro en el <strong className="text-gray-900">Desafío El Volcán 2026</strong> ha quedado confirmado. ¡Prepárate para la montaña!
                    </p>

                    {/* REGISTRATION VOUCHER SUMMARY */}
                    {lastRegistered && (
                      <div 
                        id="registration-voucher"
                        className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-0.5 rounded-[2rem] shadow-xl text-left mb-6 overflow-hidden"
                      >
                        <div className="bg-white rounded-[1.9rem] p-6 space-y-4">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <div>
                              <span className="text-[11px] font-black tracking-widest text-orange-600 uppercase block">Desafío El Volcán • New Era</span>
                              <span className="text-xs font-bold text-gray-400">Comprobante de Inscripción</span>
                            </div>
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-black text-[11px] uppercase rounded-full border border-emerald-200 flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-emerald-500" />
                              <span>Cupo Confirmado</span>
                            </span>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                              <span className="font-bold text-gray-400 text-xs">Atleta:</span>
                              <span className="font-black text-gray-900 text-sm sm:text-base">{lastRegistered.fullName}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                              <span className="font-bold text-gray-400 text-xs">Cédula / Documento:</span>
                              <span className="font-bold text-gray-800 text-xs sm:text-sm">{lastRegistered.cedula}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                              <span className="font-bold text-gray-400 text-xs">Correo Electrónico:</span>
                              <span className="font-medium text-gray-700 text-xs sm:text-sm">{lastRegistered.email}</span>
                            </div>
                            {lastRegistered.birthDay && lastRegistered.birthMonth && lastRegistered.birthYear && (
                              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                                <span className="font-bold text-gray-400 text-xs">Fecha de Nacimiento:</span>
                                <span className="font-semibold text-gray-800 text-xs sm:text-sm">
                                  {lastRegistered.birthDay.padStart(2, '0')}/{lastRegistered.birthMonth.padStart(2, '0')}/{lastRegistered.birthYear} ({lastRegistered.age} años)
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-1 border-b border-gray-50">
                              <span className="font-bold text-gray-400 text-xs">Categoría Asignada:</span>
                              <span className="font-black text-orange-600 text-xs sm:text-sm bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">{lastRegistered.category}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="font-bold text-gray-400 text-xs">Modalidad & Ruta:</span>
                              <span className="font-bold text-gray-800 text-xs sm:text-sm">El Volcán, Caracas • 3KM Trail</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* EVENT INFO NOTICE */}
                    <div className="p-4 bg-orange-50/70 border border-orange-100 rounded-2xl text-left mb-6 flex items-start gap-3">
                      <div className="p-2 bg-orange-500 text-white rounded-xl shrink-0 mt-0.5">
                        <Trophy size={16} />
                      </div>
                      <div className="text-xs text-orange-950 space-y-1">
                        <p className="font-black text-sm text-orange-900">
                          ¡Nos vemos en la meta!
                        </p>
                        <p className="text-orange-800/90 leading-relaxed font-medium">
                          Guarda o imprime este comprobante. El día del evento te recomendamos presentarte con 45 minutos de anticipación para el chequeo y entrega de tu número de corredor.
                        </p>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-2 p-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl text-xs font-black transition-all shadow-md active:scale-[0.98]"
                      >
                        <Printer size={16} />
                        <span>Imprimir / Guardar Comprobante</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setShowPublicSearchModal(true)}
                        className="flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-orange-500/20 active:scale-[0.98]"
                      >
                        <Search size={16} />
                        <span>Ver Lista de Corredores Inscritos</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          setIsSubmitted(false);
                          reset();
                        }}
                        className="sm:col-span-2 flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl text-xs font-bold transition-all border border-gray-200 active:scale-[0.98]"
                      >
                        <span>Inscribir a otro participante</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentView === 'history' && (
                <motion.div
                  key="history-view"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6 py-4 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-gray-900">Mis Inscripciones</h2>
                      <p className="text-xs text-gray-500 font-medium">Registros asociados al documento {session?.idNumber}</p>
                    </div>
                    <button 
                      onClick={() => session && fetchHistory(session.idNumber)} 
                      disabled={isLoadingHistory}
                      className="p-2 text-orange-500 hover:bg-orange-50 rounded-xl transition-all active:scale-95"
                    >
                      <motion.div animate={isLoadingHistory ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1 }}>
                        <Calendar size={20} />
                      </motion.div>
                    </button>
                  </div>

                  {isLoadingHistory ? (
                     <div className="py-20 flex flex-col items-center space-y-4 opacity-50">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Cargando...</p>
                     </div>
                  ) : userRegistrations.length > 0 ? (
                    <div className="space-y-4">
                      {userRegistrations.map((reg) => (
                        <div key={reg.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 relative overflow-hidden group">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-600 px-3 py-1 rounded-full">
                                {reg.category || 'Atleta Confirmado'}
                              </span>
                              <h3 className="text-lg font-black text-gray-900 mt-2">{reg.fullName}</h3>
                              <p className="text-xs text-gray-500 font-bold mt-0.5">Cédula: {reg.idNumber}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                Inscrito
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3.5 rounded-2xl text-gray-600">
                            <div>
                              <span className="text-[9px] font-bold uppercase text-gray-400 block">Nacimiento</span>
                              <span className="font-black text-gray-800">{reg.birthDay}/{reg.birthMonth}/{reg.birthYear}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase text-gray-400 block">Correo</span>
                              <span className="font-semibold text-gray-800 truncate block">{reg.email}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border border-gray-100 p-8">
                      <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Trophy size={24} />
                      </div>
                      <h4 className="text-base font-black text-gray-900">No hay inscripciones registradas</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                        Aún no tienes registros vinculados a esta cédula.
                      </p>
                      <button
                        onClick={() => setCurrentView('register')}
                        className="mt-4 px-5 py-2.5 bg-orange-500 text-white font-bold rounded-xl text-xs hover:bg-orange-600 transition-all shadow-md"
                      >
                        Inscribirse Ahora
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {currentView === 'contact' && (
                <motion.div
                  key="contact-view"
                  initial={{ opacity: 0, y: 14, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-6 py-4 text-left"
                >
                  <div className="mb-4">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">Contacto & Organización</h2>
                    <p className="text-xs text-gray-500 font-medium">Estamos a tu disposición para cualquier información</p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-4">
                      <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        <MessageCircle size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">WhatsApp de Atención</h4>
                        <p className="text-xs text-emerald-800 mt-0.5">Consultas de atletas, grupos e inscripciones:</p>
                        <a 
                          href="https://wa.me/584142525647" 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block mt-2 font-black text-sm text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-sm"
                        >
                          +58 414-2525647
                        </a>
                      </div>
                    </div>

                    <div className="p-5 bg-orange-50 rounded-2xl border border-orange-200 flex items-start gap-4">
                      <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md">
                        <Mail size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-orange-950">Correo Oficial</h4>
                        <p className="text-xs text-orange-800 mt-0.5">Contacto institucional y marcas aliadas:</p>
                        <a 
                          href={`mailto:${APP_CONFIG.adminEmail}`}
                          className="inline-block mt-2 font-bold text-xs text-orange-700 bg-white px-3 py-1.5 rounded-lg border border-orange-300 shadow-sm"
                        >
                          {APP_CONFIG.adminEmail}
                        </a>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentView('register')}
                    className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl text-xs hover:bg-black transition-all"
                  >
                    Volver al Formulario
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      )}

      {/* FOOTER WITH QUICK CONTROL PANEL ACCESS */}
      <footer className="max-w-4xl mx-auto mt-12 pt-8 pb-10 border-t border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="font-black text-gray-800">{APP_CONFIG.raceName}</span>
          <span>•</span>
          <span>{APP_CONFIG.eventInfo.location}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdminModal(true)}
            className="flex items-center gap-1.5 font-black text-gray-700 hover:text-orange-600 bg-white px-3.5 py-1.5 rounded-xl border border-gray-200/80 shadow-xs transition-all hover:border-orange-200"
          >
            <Users size={14} className="text-orange-500" />
            <span>Panel de Control (Administrador)</span>
          </button>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 text-left"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900">Acceso Rápido</h3>
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Nombre Completo</label>
                  <input
                    value={loginForm.fullName}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                    placeholder="Ej. Johnny Aldana"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Cédula de Identidad</label>
                  <input
                    value={loginForm.idNumber}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, idNumber: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange-500"
                    placeholder="Ej. V-25667889"
                  />
                </div>
              </div>

              <button
                onClick={handleSimpleLogin}
                className="w-full py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 transition-all text-xs uppercase tracking-wider shadow-lg shadow-orange-200"
              >
                Continuar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN IMAGE LIGHTBOX */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 sm:top-4 sm:right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-sm transition-all z-10"
              >
                <X size={20} />
              </button>

              <div className="w-full max-h-[75vh] flex items-center justify-center overflow-hidden rounded-3xl bg-black">
                <img
                  src={selectedImage.src}
                  alt={selectedImage.caption}
                  referrerPolicy="no-referrer"
                  className="max-h-[75vh] w-auto object-contain rounded-2xl"
                />
              </div>

              <div className="w-full bg-black/60 backdrop-blur-md p-4 mt-3 rounded-2xl text-white text-center">
                <span className="inline-block px-2.5 py-0.5 bg-orange-500 text-white text-[10px] font-black uppercase rounded-full mb-1">
                  {selectedImage.tag}
                </span>
                <p className="text-sm font-bold text-gray-200">
                  {selectedImage.caption}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PUBLIC RUNNER SEARCH MODAL (FOR EVERYONE) */}
      <PublicRunnerSearchModal
        isOpen={showPublicSearchModal}
        onClose={() => setShowPublicSearchModal(false)}
        onGoToRegister={() => {
          setCurrentView('register');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* ADMIN / SUPABASE REGISTRATIONS MODAL */}
      <AdminRegistrationsModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
    </div>
  );
}
