import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Lock, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Key, 
  Copy, 
  Check, 
  ShieldCheck, 
  LogOut, 
  Users,
  Code,
  Download,
  Printer,
  UserPlus,
  Trash2,
  Eye,
  ExternalLink,
  MessageCircle,
  Filter,
  Calendar,
  Activity,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Award
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { APP_CONFIG } from '../config';

export interface Registration {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  correo_electronico: string;
  fecha_nacimiento: string;
  categoria?: string;
  edad?: number;
  telefono?: string;
  estado?: 'pendiente' | 'confirmado' | 'rechazado';
  created_at?: string;
  updated_at?: string;
  bibNumber?: number | string;
}

interface AdminRegistrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminRegistrationsModal({ isOpen, onClose }: AdminRegistrationsModalProps) {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('admin_bearer_token') || null;
  });
  const [authEmail, setAuthEmail] = useState<string>(() => {
    return localStorage.getItem('admin_user_email') || '';
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Registrations state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('local');
  const [activeTab, setActiveTab] = useState<'runners' | 'sql'>('runners');
  const [copiedSql, setCopiedSql] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'confirmado' | 'rechazado'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Updating registration state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<Registration | null>(null);

  // New runner manual registration modal state
  const [showAddRunnerModal, setShowAddRunnerModal] = useState(false);
  const [newRunnerForm, setNewRunnerForm] = useState({
    nombre: '',
    apellido: '',
    cedula: '',
    correo_electronico: '',
    fecha_nacimiento: '',
    telefono: '',
    estado: 'confirmado' as 'pendiente' | 'confirmado' | 'rechazado',
  });
  const [isAddingRunner, setIsAddingRunner] = useState(false);
  const [addRunnerError, setAddRunnerError] = useState<string | null>(null);

  const sqlSchemaText = `-- ==========================================================
-- SUPABASE SQL SCHEMA: INSCRIPCIONES DE CARRERA
-- Desafío El Volcán
-- ==========================================================

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  cedula text not null,
  correo_electronico text not null,
  fecha_nacimiento date not null,
  categoria text,
  edad integer,
  telefono text,
  estado text default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Habilitar Row Level Security (RLS)
alter table public.registrations enable row level security;

-- 1. PÚBLICO: Permitir crear registros sin login
create policy "Permitir crear registro publicamente"
on public.registrations
for insert to anon, authenticated
with check (true);

-- 2. PRIVADO: Solo usuarios autenticados con Supabase Auth pueden leer
create policy "Solo usuarios autenticados pueden leer registros"
on public.registrations
for select to authenticated
using (true);

-- 3. PRIVADO: Solo usuarios autenticados pueden actualizar registros
create policy "Solo usuarios autenticados pueden actualizar registros"
on public.registrations
for update to authenticated
using (true)
with check (true);`;

  // Fetch private registrations from API
  const fetchPrivateRegistrations = async (token: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/registrations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}: Acceso no autorizado`);
      }

      const data = await res.json();
      setRegistrations(data.registrations || []);
      setDataSource(data.source || 'local');
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      setFetchError(err.message || 'Error al obtener registros privados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && authToken) {
      fetchPrivateRegistrations(authToken);
    }
  }, [isOpen, authToken]);

  // Handle Login via Supabase Auth or Admin Key
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      // 1. Try Supabase Auth if credentials provided and configured
      if (loginEmail && loginPassword && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data.session?.access_token) {
          const token = data.session.access_token;
          const email = data.user?.email || loginEmail;
          setAuthToken(token);
          setAuthEmail(email);
          localStorage.setItem('admin_bearer_token', token);
          localStorage.setItem('admin_user_email', email);
          fetchPrivateRegistrations(token);
          return;
        }
      }

      // 2. Direct Admin Key verification
      const keyToTest = adminKeyInput.trim() || loginPassword.trim();
      if (!keyToTest) {
        throw new Error('Por favor ingresa la clave de administrador o tus credenciales de Supabase');
      }

      // Test key against the private endpoint
      const res = await fetch('/api/registrations', {
        headers: {
          Authorization: `Bearer ${keyToTest}`,
        },
      });

      if (!res.ok) {
        throw new Error('Clave administrativa incorrecta. Verifica la contraseña.');
      }

      const data = await res.json();
      setAuthToken(keyToTest);
      const email = 'admin@desafioelvolcan.com';
      setAuthEmail(email);
      localStorage.setItem('admin_bearer_token', keyToTest);
      localStorage.setItem('admin_user_email', email);
      setRegistrations(data.registrations || []);
      setDataSource(data.source || 'local');
    } catch (err: any) {
      setLoginError(err.message || 'Error de autenticación');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthEmail('');
    setRegistrations([]);
    localStorage.removeItem('admin_bearer_token');
    localStorage.removeItem('admin_user_email');
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  // Update registration status (Private endpoint PUT /api/registrations/:id)
  const handleUpdateStatus = async (id: string, newStatus: 'pendiente' | 'confirmado' | 'rechazado') => {
    if (!authToken) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ estado: newStatus }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al actualizar registro');
      }

      // Update in local state
      setRegistrations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, estado: newStatus } : item))
      );
      if (selectedRunner?.id === id) {
        setSelectedRunner((prev) => (prev ? { ...prev, estado: newStatus } : null));
      }
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete runner registration (Private endpoint DELETE /api/registrations/:id)
  const handleDeleteRunner = async (id: string, name: string) => {
    if (!authToken) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el registro de ${name}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al eliminar el registro');
      }

      setRegistrations((prev) => prev.filter((item) => item.id !== id));
      if (selectedRunner?.id === id) {
        setSelectedRunner(null);
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Add runner manually
  const handleAddRunner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingRunner(true);
    setAddRunnerError(null);

    try {
      if (!newRunnerForm.nombre.trim() || !newRunnerForm.apellido.trim() || !newRunnerForm.cedula.trim() || !newRunnerForm.correo_electronico.trim() || !newRunnerForm.fecha_nacimiento) {
        throw new Error('Por favor completa todos los campos requeridos (*)');
      }

      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRunnerForm),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al crear corredor');
      }

      const data = await res.json();
      if (data.registration) {
        setRegistrations((prev) => [data.registration, ...prev]);
      }
      setShowAddRunnerModal(false);
      setNewRunnerForm({
        nombre: '',
        apellido: '',
        cedula: '',
        correo_electronico: '',
        fecha_nacimiento: '',
        telefono: '',
        estado: 'confirmado',
      });
      // Refresh list from server
      if (authToken) {
        fetchPrivateRegistrations(authToken);
      }
    } catch (err: any) {
      setAddRunnerError(err.message || 'Error al crear corredor');
    } finally {
      setIsAddingRunner(false);
    }
  };

  // Export to CSV function (with Excel-friendly BOM and UTF-8 encoding)
  const handleExportCSV = () => {
    if (registrations.length === 0) {
      alert('No hay corredores registrados para exportar.');
      return;
    }

    const headers = [
      'N°',
      'Nombre',
      'Apellido',
      'Cédula',
      'Correo Electrónico',
      'Fecha Nacimiento',
      'Edad',
      'Categoría',
      'Teléfono',
      'Estado',
      'Fecha Registro'
    ];

    const rows = filteredRegistrations.map((r, index) => [
      index + 1,
      `"${(r.nombre || '').replace(/"/g, '""')}"`,
      `"${(r.apellido || '').replace(/"/g, '""')}"`,
      `"${r.cedula || ''}"`,
      `"${r.correo_electronico || ''}"`,
      `"${r.fecha_nacimiento || ''}"`,
      r.edad ?? '',
      `"${r.categoria || 'General'}"`,
      `"${r.telefono || ''}"`,
      `"${r.estado || 'pendiente'}"`,
      `"${r.created_at ? new Date(r.created_at).toLocaleString('es-VE') : ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `corredores_desafio_el_volcan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print runner list
  const handlePrintList = () => {
    window.print();
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Analytics Metrics
  const stats = useMemo(() => {
    const total = registrations.length;
    const confirmados = registrations.filter(r => r.estado === 'confirmado').length;
    const pendientes = registrations.filter(r => r.estado === 'pendiente' || !r.estado).length;
    const rechazados = registrations.filter(r => r.estado === 'rechazado').length;
    
    // Age average
    const ages = registrations.map(r => r.edad).filter((a): a is number => typeof a === 'number' && !isNaN(a));
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((sum, a) => sum + a, 0) / ages.length) : 0;

    // Categories breakdown
    const categoryCounts: Record<string, number> = {};
    registrations.forEach(r => {
      const cat = r.categoria || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    let topCategory = 'N/A';
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > topCategoryCount) {
        topCategory = cat;
        topCategoryCount = count;
      }
    });

    return {
      total,
      confirmados,
      pendientes,
      rechazados,
      avgAge,
      topCategory,
      confirmPercent: total > 0 ? Math.round((confirmados / total) * 100) : 0,
      uniqueCategories: Object.keys(categoryCounts)
    };
  }, [registrations]);

  // Filtered registrations
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        (r.apellido && r.apellido.toLowerCase().includes(q)) ||
        (r.cedula && r.cedula.toLowerCase().includes(q)) ||
        (r.correo_electronico && r.correo_electronico.toLowerCase().includes(q)) ||
        (r.categoria && r.categoria.toLowerCase().includes(q)) ||
        (r.telefono && r.telefono.includes(q))
      );

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'pendiente' && (r.estado === 'pendiente' || !r.estado)) ||
        r.estado === statusFilter;

      const matchesCategory = categoryFilter === 'all' || r.categoria === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [registrations, searchQuery, statusFilter, categoryFilter]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
      >
        <motion.div
          initial={{ scale: 0.96, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 15 }}
          className={`bg-white rounded-3xl w-full flex flex-col shadow-2xl overflow-hidden border border-gray-100 transition-all ${
            isFullscreen ? 'h-full max-h-[98vh] max-w-[98vw]' : 'max-w-6xl max-h-[92vh]'
          }`}
        >
          {/* HEADER */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-orange-600 to-amber-500 text-white rounded-2xl shadow-md">
                <Users size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg leading-tight tracking-tight">
                    Panel de Control de Corredores
                  </h3>
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                    {APP_CONFIG.raceName}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  Gestión integral de inscritos, verificación de pagos y control de participantes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Restaurar tamaño" : "Pantalla completa"}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {!authToken ? (
              /* LOGIN SCREEN FOR PROTECTED CONTROL PANEL ACCESS */
              <div className="max-w-md mx-auto my-6 sm:my-12 p-6 sm:p-8 bg-gray-50 border border-gray-200/80 rounded-3xl text-left space-y-5 shadow-lg">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Lock size={26} />
                  </div>
                  <h4 className="font-black text-gray-900 text-xl tracking-tight">Acceso al Panel de Control</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Ingresa con la contraseña de administrador para consultar la base de datos de inscritos y gestionar los corredores.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-600 mb-1.5 flex items-center justify-between">
                      <span>Contraseña de Administrador</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={adminKeyInput}
                        onChange={(e) => setAdminKeyInput(e.target.value)}
                        placeholder="Ingresa la contraseña del panel"
                        className="w-full bg-white border border-gray-200 rounded-2xl pl-4 pr-12 py-3 text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold p-1"
                      >
                        {showPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isLoggingIn ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    <span>Entrar al Panel de Control</span>
                  </button>

                  <div className="pt-2 text-center text-[11px] text-gray-400 font-medium">
                    🔒 <em>Acceso exclusivo para los organizadores de {APP_CONFIG.raceName}.</em>
                  </div>
                </form>
              </div>
            ) : (
              /* AUTHENTICATED CONTROL PANEL */
              <div className="space-y-6">
                {/* TOP STATUS BAR & SESSION INFO */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-gray-50 to-orange-50/40 p-3 sm:p-4 rounded-2xl border border-gray-200/80 text-xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Sesión de Administrador
                    </span>
                    <span className="text-gray-400 hidden sm:inline">•</span>
                    <span className="font-semibold text-gray-600">
                      Fuente de datos: <strong className="text-gray-900">{dataSource === 'supabase' ? 'Supabase Database' : 'Almacenamiento Local'}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchPrivateRegistrations(authToken)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center gap-1.5 border border-gray-200 transition-colors shadow-sm"
                      title="Sincronizar y recargar inscritos"
                    >
                      <RefreshCw size={13} className={isLoading ? 'animate-spin text-orange-500' : ''} />
                      <span className="hidden sm:inline">Sincronizar</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold flex items-center gap-1.5 border border-red-200 transition-colors"
                      title="Cerrar sesión del panel"
                    >
                      <LogOut size={13} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>

                {/* KPI METRIC CARDS (RESUMEN EJECUTIVO) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* TOTAL RUNNERS */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 sm:p-5 rounded-3xl shadow-sm border border-gray-800 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Total Corredores</span>
                      <div className="p-2 bg-white/10 rounded-xl">
                        <Users size={16} className="text-orange-400" />
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight">{stats.total}</div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                      <span>Registros en la base de datos</span>
                    </div>
                  </div>

                  {/* CONFIRMED */}
                  <div className="bg-emerald-50 border border-emerald-100 p-4 sm:p-5 rounded-3xl shadow-sm text-emerald-950">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Confirmados</span>
                      <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                        <CheckCircle size={16} />
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-900">{stats.confirmados}</div>
                    <div className="text-[11px] text-emerald-700 mt-1 font-bold">
                      {stats.confirmPercent}% del total verificado
                    </div>
                  </div>

                  {/* PENDING WHATSAPP */}
                  <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-3xl shadow-sm text-rose-950">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">Pendiente WhatsApp</span>
                      <div className="p-2 bg-rose-600 text-white rounded-xl shadow-sm">
                        <Clock size={16} />
                      </div>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black tracking-tight text-rose-900">{stats.pendientes}</div>
                    <div className="text-[11px] text-rose-700 mt-1 font-bold">
                      Requieren escribir al WhatsApp
                    </div>
                  </div>

                  {/* CATEGORIES & AGE */}
                  <div className="bg-amber-50 border border-amber-100 p-4 sm:p-5 rounded-3xl shadow-sm text-amber-950">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">Categoría Líder</span>
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
                        <Award size={16} />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black tracking-tight text-amber-900 truncate">
                      {stats.topCategory}
                    </div>
                    <div className="text-[11px] text-amber-800 mt-1 font-bold">
                      Promedio de edad: {stats.avgAge > 0 ? `${stats.avgAge} años` : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* NAVIGATION TABS */}
                <div className="flex items-center justify-between border-b border-gray-200">
                  <div className="flex text-xs font-bold gap-2">
                    <button
                      onClick={() => setActiveTab('runners')}
                      className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all ${
                        activeTab === 'runners'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Users size={16} />
                      <span>Lista de Corredores ({filteredRegistrations.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('sql')}
                      className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-all ${
                        activeTab === 'sql'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      <Code size={16} />
                      <span>Configuración SQL & RLS Supabase</span>
                    </button>
                  </div>

                  {activeTab === 'runners' && (
                    <div className="flex items-center gap-2 pb-2">
                      <button
                        onClick={() => setShowAddRunnerModal(true)}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <UserPlus size={14} />
                        <span className="hidden sm:inline">Nuevo Corredor</span>
                      </button>

                      <button
                        onClick={handleExportCSV}
                        title="Exportar a archivo Excel / CSV"
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Download size={14} />
                        <span className="hidden sm:inline">Exportar CSV</span>
                      </button>

                      <button
                        onClick={handlePrintList}
                        title="Imprimir lista oficial para el día del evento"
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Printer size={14} />
                        <span className="hidden sm:inline">Imprimir</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* TAB 1: RUNNERS LIST */}
                {activeTab === 'runners' && (
                  <div className="space-y-4">
                    {/* SEARCH & FILTERS BAR */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* SEARCH INPUT */}
                      <div className="sm:col-span-6 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar por nombre, apellido, cédula, correo o teléfono..."
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* STATUS FILTER */}
                      <div className="sm:col-span-3">
                        <select
                          value={statusFilter}
                          onChange={(e: any) => setStatusFilter(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                          <option value="all">Todos los estados</option>
                          <option value="confirmado">✓ Solo Confirmados</option>
                          <option value="pendiente">⏳ Solo Pendientes</option>
                          <option value="rechazado">✕ Solo Rechazados</option>
                        </select>
                      </div>

                      {/* CATEGORY FILTER */}
                      <div className="sm:col-span-3">
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                          <option value="all">Todas las categorías</option>
                          {stats.uniqueCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {fetchError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>{fetchError}</span>
                      </div>
                    )}

                    {isLoading ? (
                      <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                        <RefreshCw size={28} className="animate-spin text-orange-500" />
                        <span className="text-xs font-bold text-gray-600">Consultando base de datos de corredores...</span>
                      </div>
                    ) : filteredRegistrations.length === 0 ? (
                      <div className="py-16 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200 p-8">
                        <Users size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm font-black text-gray-700">No se encontraron corredores</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                          {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                            ? 'Prueba modificando tus filtros o término de búsqueda.'
                            : 'Los participantes que completen el formulario en la página web aparecerán aquí al instante.'}
                        </p>
                      </div>
                    ) : (
                      /* RUNNERS TABLE */
                      <div className="overflow-x-auto rounded-3xl border border-gray-200 shadow-sm bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50/80 text-gray-600 font-black uppercase tracking-wider text-[10px] border-b border-gray-200">
                            <tr>
                              <th className="p-3.5 pl-4">#</th>
                              <th className="p-3.5">Corredor</th>
                              <th className="p-3.5">Cédula</th>
                              <th className="p-3.5">Contacto</th>
                              <th className="p-3.5">F. Nacimiento / Edad</th>
                              <th className="p-3.5">Categoría</th>
                              <th className="p-3.5">Estado</th>
                              <th className="p-3.5 text-right pr-4">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {filteredRegistrations.map((reg, idx) => (
                              <tr key={reg.id} className="hover:bg-orange-50/30 transition-colors group">
                                <td className="p-3.5 pl-4 font-mono font-bold text-gray-400 text-[11px]">
                                  {idx + 1}
                                </td>

                                <td className="p-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                                      {reg.nombre?.charAt(0) || 'C'}
                                    </div>
                                    <div>
                                      <div className="font-black text-gray-900 text-xs sm:text-sm">
                                        {reg.nombre} {reg.apellido}
                                      </div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        ID: {reg.id.slice(0, 8)}...
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                                    {reg.cedula}
                                  </span>
                                </td>

                                <td className="p-3.5">
                                  <div className="text-gray-700 truncate max-w-[160px]">{reg.correo_electronico}</div>
                                  {reg.telefono ? (
                                    <a
                                      href={`https://wa.me/${reg.telefono.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold mt-0.5"
                                    >
                                      <MessageCircle size={11} />
                                      <span>{reg.telefono}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-gray-400">Sin teléfono</span>
                                  )}
                                </td>

                                <td className="p-3.5 text-gray-700">
                                  <div className="font-semibold">{reg.fecha_nacimiento}</div>
                                  {reg.edad !== undefined && (
                                    <div className="text-[10px] text-gray-500 font-bold">{reg.edad} años</div>
                                  )}
                                </td>

                                <td className="p-3.5">
                                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-black text-[10px] rounded-lg border border-amber-200 inline-block">
                                    {reg.categoria || 'General'}
                                  </span>
                                </td>

                                <td className="p-3.5">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-xs ${
                                      reg.estado === 'confirmado'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : reg.estado === 'rechazado'
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}
                                  >
                                    {reg.estado === 'confirmado' ? '✓ Confirmado' : reg.estado === 'rechazado' ? '✕ Rechazado' : '⏳ Pendiente'}
                                  </span>
                                </td>

                                <td className="p-3.5 text-right pr-4">
                                  <div className="inline-flex items-center gap-1.5">
                                    {/* STATUS SWITCH BUTTONS */}
                                    {reg.estado !== 'confirmado' && (
                                      <button
                                        disabled={updatingId === reg.id}
                                        onClick={() => handleUpdateStatus(reg.id, 'confirmado')}
                                        title="Confirmar inscripción"
                                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black border border-emerald-200 transition-colors"
                                      >
                                        ✓
                                      </button>
                                    )}

                                    {reg.estado !== 'pendiente' && (
                                      <button
                                        disabled={updatingId === reg.id}
                                        onClick={() => handleUpdateStatus(reg.id, 'pendiente')}
                                        title="Marcar como pendiente"
                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black border border-amber-200 transition-colors"
                                      >
                                        ⏳
                                      </button>
                                    )}

                                    {/* VIEW DETAILS */}
                                    <button
                                      onClick={() => setSelectedRunner(reg)}
                                      title="Ver ficha completa"
                                      className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition-colors"
                                    >
                                      <Eye size={13} />
                                    </button>

                                    {/* DELETE BUTTON */}
                                    <button
                                      disabled={deletingId === reg.id}
                                      onClick={() => handleDeleteRunner(reg.id, `${reg.nombre} ${reg.apellido}`)}
                                      title="Eliminar registro"
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: SQL SCHEMA & SUPABASE CONFIG */}
                {activeTab === 'sql' && (
                  <div className="space-y-4 text-left">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-xs text-orange-950 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <Database size={15} className="text-orange-600" />
                        <span>Tabla `public.registrations` con Políticas RLS en Supabase</span>
                      </p>
                      <p className="text-[11px] text-orange-800">
                        Copia este script y ejecútalo en el <strong>SQL Editor de tu proyecto en Supabase</strong> para habilitar las políticas de seguridad:
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        onClick={copySqlToClipboard}
                        className="absolute top-3 right-3 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                      >
                        {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                      </button>

                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto leading-relaxed border border-gray-800 max-h-72">
                        {sqlSchemaText}
                      </pre>
                    </div>

                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-2">
                      <p className="font-bold text-gray-800">Variables de Entorno necesarias en `.env`:</p>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-200 font-mono text-[11px] space-y-1 text-gray-700">
                        <p>SUPABASE_URL=https://xyzcompany.supabase.co</p>
                        <p>SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...</p>
                        <p>ADMIN_SECRET=Megustalapasta11.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* MODAL: RUNNER DETAILS DRAWER */}
        <AnimatePresence>
          {selectedRunner && (
            <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 text-left space-y-4"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white font-black flex items-center justify-center text-sm shadow-md">
                      {selectedRunner.nombre?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-base leading-tight">
                        {selectedRunner.nombre} {selectedRunner.apellido}
                      </h4>
                      <p className="text-xs text-gray-400 font-mono">Cédula: {selectedRunner.cedula}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRunner(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">Correo Electrónico</span>
                    <span className="font-bold text-gray-800 break-all">{selectedRunner.correo_electronico}</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">Teléfono</span>
                    <span className="font-bold text-gray-800">{selectedRunner.telefono || 'No registrado'}</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">Fecha de Nacimiento</span>
                    <span className="font-bold text-gray-800">{selectedRunner.fecha_nacimiento}</span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-2xl">
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">Edad & Categoría</span>
                    <span className="font-bold text-gray-800">
                      {selectedRunner.edad ? `${selectedRunner.edad} años • ` : ''}
                      {selectedRunner.categoria || 'General'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 block">
                      Estado Actual
                    </span>
                    <span className="font-black text-sm text-gray-900 capitalize">
                      {selectedRunner.estado || 'pendiente'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUpdateStatus(selectedRunner.id, 'confirmado')}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRunner.id, 'pendiente')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
                    >
                      Pendiente
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRunner.id, 'rechazado')}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>

                {selectedRunner.telefono && (
                  <a
                    href={`https://wa.me/${selectedRunner.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `¡Hola ${selectedRunner.nombre}! Te escribimos de la organización de ${APP_CONFIG.raceName}. Tu inscripción se encuentra ${selectedRunner.estado === 'confirmado' ? 'CONFIRMADA' : 'en proceso'}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <MessageCircle size={16} />
                    <span>Contactar por WhatsApp al Corredor</span>
                  </a>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: ADD RUNNER MANUALLY */}
        <AnimatePresence>
          {showAddRunnerModal && (
            <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 text-left space-y-4"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus size={18} className="text-orange-500" />
                    <h4 className="font-black text-gray-900 text-base">Inscribir Corredor Manualmente</h4>
                  </div>
                  <button
                    onClick={() => setShowAddRunnerModal(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {addRunnerError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                    {addRunnerError}
                  </div>
                )}

                <form onSubmit={handleAddRunner} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">Nombre *</label>
                      <input
                        type="text"
                        required
                        value={newRunnerForm.nombre}
                        onChange={(e) => setNewRunnerForm({ ...newRunnerForm, nombre: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Ej. Carlos"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">Apellido *</label>
                      <input
                        type="text"
                        required
                        value={newRunnerForm.apellido}
                        onChange={(e) => setNewRunnerForm({ ...newRunnerForm, apellido: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Ej. Pérez"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">Cédula *</label>
                      <input
                        type="text"
                        required
                        value={newRunnerForm.cedula}
                        onChange={(e) => setNewRunnerForm({ ...newRunnerForm, cedula: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="V-12345678"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">F. Nacimiento (AAAA-MM-DD) *</label>
                      <input
                        type="date"
                        required
                        value={newRunnerForm.fecha_nacimiento}
                        onChange={(e) => setNewRunnerForm({ ...newRunnerForm, fecha_nacimiento: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-600 mb-1">Correo Electrónico *</label>
                    <input
                      type="email"
                      required
                      value={newRunnerForm.correo_electronico}
                      onChange={(e) => setNewRunnerForm({ ...newRunnerForm, correo_electronico: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="atleta@correo.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">Teléfono (WhatsApp)</label>
                      <input
                        type="tel"
                        value={newRunnerForm.telefono}
                        onChange={(e) => setNewRunnerForm({ ...newRunnerForm, telefono: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0414-0000000"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-600 mb-1">Estado de Inscripción</label>
                      <select
                        value={newRunnerForm.estado}
                        onChange={(e: any) => setNewRunnerForm({ ...newRunnerForm, estado: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="confirmado">Confirmado</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="rechazado">Rechazado</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRunnerModal(false)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingRunner}
                      className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                    >
                      {isAddingRunner && <RefreshCw size={14} className="animate-spin" />}
                      <span>Guardar Corredor</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
