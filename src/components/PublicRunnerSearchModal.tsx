import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Users,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Trophy,
  Calendar,
  IdCard,
  RefreshCw,
  ChevronRight,
  Printer,
  Sparkles,
  Download,
  Share2
} from 'lucide-react';
import { APP_CONFIG } from '../config';

export interface PublicRunner {
  id: string;
  nombre: string;
  apellido: string;
  fullName?: string;
  cedula: string;
  categoria: string;
  edad?: number | null;
  estado?: 'pendiente' | 'confirmado' | 'rechazado';
  created_at?: string;
}

interface PublicRunnerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToRegister?: () => void;
}

export const PublicRunnerSearchModal: React.FC<PublicRunnerSearchModalProps> = ({
  isOpen,
  onClose,
  onGoToRegister,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmado' | 'pendiente'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [runners, setRunners] = useState<PublicRunner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<PublicRunner | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Fetch runners from public endpoint and fallback to local browser cache
  const fetchRunners = async (query = '') => {
    setIsLoading(true);
    try {
      let fetchedList: PublicRunner[] = [];

      // 1. Public API Endpoint
      try {
        const url = query ? `/api/public/runners?q=${encodeURIComponent(query)}` : '/api/public/runners';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.runners) && data.runners.length > 0) {
            fetchedList = data.runners;
          }
        }
      } catch (apiErr) {
        console.warn('Nota de API pública (puede ser hosting estático):', apiErr);
      }

      // 2. Browser localStorage fallback (for static hosting or offline capability)
      const localRaw = localStorage.getItem('race_local_registrations');
      let localList: any[] = [];
      if (localRaw) {
        try {
          localList = JSON.parse(localRaw);
        } catch {
          localList = [];
        }
      }

      // Merge results by ID or Cedula to prevent duplicates
      const mergedMap = new Map<string, PublicRunner>();

      // First add fetched
      fetchedList.forEach((r) => {
        const key = r.id || r.cedula;
        mergedMap.set(key, {
          ...r,
          fullName: r.fullName || `${r.nombre} ${r.apellido}`.trim(),
        });
      });

      // Then supplement with local registrations
      localList.forEach((r) => {
        const key = r.id || r.cedula;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            id: r.id || `local_${Math.random()}`,
            nombre: r.nombre || '',
            apellido: r.apellido || '',
            fullName: `${r.nombre || ''} ${r.apellido || ''}`.trim(),
            cedula: r.cedula || '',
            categoria: r.categoria || 'General',
            edad: r.edad || null,
            estado: r.estado || 'confirmado',
            created_at: r.created_at || new Date().toISOString(),
          });
        }
      });

      let finalRunners = Array.from(mergedMap.values());

      // If a query was entered but the server couldn't filter (e.g. static site), filter locally
      if (query.trim()) {
        const cleanQuery = query.trim().toLowerCase();
        const cleanNoSpecial = cleanQuery.replace(/[^a-z0-9]/gi, '');
        finalRunners = finalRunners.filter((r) => {
          const name = (r.fullName || `${r.nombre} ${r.apellido}`).toLowerCase();
          const ced = (r.cedula || '').toLowerCase();
          const cedClean = ced.replace(/[^a-z0-9]/gi, '');
          return (
            name.includes(cleanQuery) ||
            ced.includes(cleanQuery) ||
            (cleanNoSpecial && cedClean.includes(cleanNoSpecial))
          );
        });
      }

      setRunners(finalRunners);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching public runners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRunners(searchQuery);
    }
  }, [isOpen]);

  // Debounced live search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchRunners(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    runners.forEach((r) => {
      if (r.categoria) set.add(r.categoria);
    });
    return Array.from(set).sort();
  }, [runners]);

  // Filtered runners list
  const filteredRunners = useMemo(() => {
    return runners.filter((r) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'confirmado' && (r.estado === 'confirmado' || !r.estado)) ||
        (statusFilter === 'pendiente' && r.estado === 'pendiente');

      const matchesCategory = categoryFilter === 'all' || r.categoria === categoryFilter;

      return matchesStatus && matchesCategory;
    });
  }, [runners, statusFilter, categoryFilter]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-white rounded-[2rem] sm:rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* HEADER */}
          <div className="px-5 py-4.5 sm:px-6 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-2xl shadow-md">
                <Search size={22} className="stroke-[2.5]" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg leading-tight tracking-tight text-white">
                    Buscador de Corredores Inscritos
                  </h3>
                  <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                    Público
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Consulta tu inscripción o verifica a cualquier participante por número de cédula o nombre
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Cerrar buscador"
            >
              <X size={20} />
            </button>
          </div>

          {/* MAIN SEARCH & FILTER CONTROLS */}
          <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100 space-y-3.5 shrink-0 text-left">
            {/* REAL-TIME SEARCH INPUT */}
            <div className="relative">
              <Search
                size={20}
                className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  searchQuery.trim() ? 'text-orange-500 stroke-[2.5]' : 'text-gray-400'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escribe tu número de cédula (ej. 33972674) o nombre completo..."
                className="w-full bg-white border-2 border-gray-200 focus:border-orange-500 rounded-2xl pl-12 pr-12 py-3.5 text-sm sm:text-base font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium focus:ring-4 focus:ring-orange-500/15 outline-none transition-all shadow-sm"
                autoFocus
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                  title="Borrar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* FILTERS & STATS BAR */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs font-bold text-gray-600">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter Buttons */}
                <span className="text-[11px] font-black uppercase text-gray-400 tracking-wider mr-1">
                  Filtrar:
                </span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusFilter === 'all'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Todos ({runners.length})
                </button>
                <button
                  onClick={() => setStatusFilter('confirmado')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    statusFilter === 'confirmado'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  Confirmados
                </button>
                <button
                  onClick={() => setStatusFilter('pendiente')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    statusFilter === 'pendiente'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Pendientes
                </button>

                {/* Category Dropdown */}
                {categories.length > 0 && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl font-bold outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="all">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Refresh & Results Count */}
              <div className="flex items-center gap-2 text-gray-500 font-medium">
                <span>
                  Mostrando <strong className="text-gray-900">{filteredRunners.length}</strong> de{' '}
                  <strong className="text-gray-900">{runners.length}</strong>
                </span>
                <button
                  onClick={() => fetchRunners(searchQuery)}
                  disabled={isLoading}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                  title="Actualizar lista en tiempo real"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin text-orange-500' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* RESULTS CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {isLoading && runners.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={32} className="animate-spin text-orange-500 mx-auto" />
                <p className="text-sm font-bold text-gray-500">Cargando lista de corredores inscritos...</p>
              </div>
            ) : filteredRunners.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left">
                {filteredRunners.map((runner) => {
                  const isConfirmado = runner.estado === 'confirmado' || !runner.estado;
                  const fullName = runner.fullName || `${runner.nombre} ${runner.apellido}`.trim();

                  return (
                    <motion.div
                      key={runner.id || runner.cedula}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-gray-200/80 hover:border-orange-300 rounded-2xl p-4 transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                            {runner.nombre ? runner.nombre.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 text-sm sm:text-base leading-tight">
                              {fullName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                Cédula: {runner.cedula}
                              </span>
                              {runner.edad && (
                                <span className="text-xs text-gray-400 font-medium">
                                  {runner.edad} años
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isConfirmado ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                              <CheckCircle2 size={13} className="stroke-[2.5]" />
                              <span>Inscrito</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                              <Clock size={13} className="stroke-[2.5]" />
                              <span>Pendiente</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Info of Runner Card */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Trophy size={13} className="text-orange-500" />
                          <span className="font-bold text-gray-700 text-[11px]">
                            {runner.categoria}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedRunner(runner)}
                          className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-xl transition-colors"
                        >
                          <IdCard size={13} />
                          <span>Ver Ficha</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="py-12 sm:py-16 text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 mx-auto flex items-center justify-center border border-orange-100 shadow-inner">
                  <Search size={28} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-black text-gray-900 text-lg">
                    {searchQuery ? 'No encontramos coincidencias' : 'Aún no hay corredores con este filtro'}
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {searchQuery ? (
                      <>
                        No se encontró ningún participante con el término{' '}
                        <strong className="text-gray-800">"{searchQuery}"</strong>. Verifica que la cédula o el nombre estén bien escritos.
                      </>
                    ) : (
                      'No hay inscritos que coincidan con los filtros seleccionados.'
                    )}
                  </p>
                </div>

                {onGoToRegister && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onGoToRegister();
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 active:scale-95 inline-flex items-center gap-2"
                    >
                      <Trophy size={15} />
                      <span>¡Inscribirme en la Carrera!</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FOOTER CALL TO ACTION */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 text-gray-500">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-orange-500" />
              <span>
                Base de datos oficial de participantes de <strong>{APP_CONFIG.raceName}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onGoToRegister && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToRegister();
                  }}
                  className="font-bold text-orange-600 hover:text-orange-700 text-xs px-3 py-1.5 rounded-xl hover:bg-orange-50 transition-colors"
                >
                  ¿No apareces en la lista? Regístrate aquí
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* MODAL: FICHA DIGITAL DEL PARTICIPANTE */}
      {selectedRunner && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 text-left"
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center relative">
              <button
                onClick={() => setSelectedRunner(null)}
                className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
              <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center text-white mb-3 shadow-inner">
                <Trophy size={32} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">
                Comprobante Oficial
              </span>
              <h3 className="text-xl font-black mt-2 leading-tight">
                {selectedRunner.fullName || `${selectedRunner.nombre} ${selectedRunner.apellido}`}
              </h3>
              <p className="text-xs text-orange-100 mt-0.5">{APP_CONFIG.raceName}</p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="font-bold text-gray-500">Cédula de Identidad:</span>
                  <span className="font-mono font-black text-gray-900 text-sm">
                    {selectedRunner.cedula}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="font-bold text-gray-500">Categoría:</span>
                  <span className="font-black text-orange-600">{selectedRunner.categoria}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
                  <span className="font-bold text-gray-500">Estatus:</span>
                  <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {selectedRunner.estado === 'pendiente' ? 'Pendiente' : 'Inscrito / Confirmado'}
                  </span>
                </div>
                {selectedRunner.edad && (
                  <div className="flex justify-between items-center py-1">
                    <span className="font-bold text-gray-500">Edad registrada:</span>
                    <span className="font-black text-gray-800">{selectedRunner.edad} años</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[11px] text-gray-400">
                Presenta este comprobante o tu cédula de identidad el día de la entrega de dorsales y kits.
              </div>

              <button
                type="button"
                onClick={() => setSelectedRunner(null)}
                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
