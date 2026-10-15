import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  CheckCircle2,
  Clock,
  Trophy,
  IdCard,
  RefreshCw,
  Sparkles,
  Phone
} from 'lucide-react';
import { APP_CONFIG } from '../config';

export interface PublicRunner {
  id: string;
  nombre: string;
  apellido: string;
  fullName?: string;
  cedula?: string;
  celular?: string;
  telefono?: string;
  categoria: string;
  edad?: number | null;
  estado?: 'pendiente' | 'confirmado' | 'rechazado';
  created_at?: string;
}

interface PublicRunnerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToRegister?: () => void;
  onOpenAdmin?: () => void;
}

export const PublicRunnerSearchModal: React.FC<PublicRunnerSearchModalProps> = ({
  isOpen,
  onClose,
  onGoToRegister,
  onOpenAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [runners, setRunners] = useState<PublicRunner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<PublicRunner | null>(null);

  // Fetch runners only matching the specific search query (no public dumping of total roster)
  const fetchRunners = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.toLowerCase() === 'admin') {
      setRunners([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let fetchedList: PublicRunner[] = [];

      // 1. Search via public endpoint
      try {
        const url = `/api/public/runners?q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.runners)) {
            fetchedList = data.runners;
          }
        }
      } catch (apiErr) {
        console.warn('Nota de API pública:', apiErr);
      }

      // 2. Search local browser backup (for offline or static hosting)
      const localRaw = localStorage.getItem('race_local_registrations');
      let localList: any[] = [];
      if (localRaw) {
        try {
          localList = JSON.parse(localRaw);
        } catch {
          localList = [];
        }
      }

      const mergedMap = new Map<string, PublicRunner>();

      fetchedList.forEach((r) => {
        const phone = r.celular || r.telefono || r.cedula || '';
        const key = r.id || phone;
        mergedMap.set(key, {
          ...r,
          celular: phone,
          fullName: r.fullName || `${r.nombre} ${r.apellido}`.trim(),
        });
      });

      localList.forEach((r) => {
        const phone = r.celular || r.telefono || r.cedula || '';
        const key = r.id || phone;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            id: r.id || `local_${Math.random()}`,
            nombre: r.nombre || '',
            apellido: r.apellido || '',
            fullName: `${r.nombre || ''} ${r.apellido || ''}`.trim(),
            cedula: phone,
            celular: phone,
            telefono: phone,
            categoria: r.categoria || 'General',
            edad: r.edad || null,
            estado: r.estado || 'confirmado',
            created_at: r.created_at || new Date().toISOString(),
          });
        }
      });

      const cleanQuery = trimmed.toLowerCase();
      const digitsOnly = cleanQuery.replace(/\D/g, '');

      const filtered = Array.from(mergedMap.values()).filter((r) => {
        const name = (r.fullName || `${r.nombre} ${r.apellido}`).toLowerCase();
        const phone = (r.celular || r.telefono || r.cedula || '').toLowerCase();
        const phoneDigits = phone.replace(/\D/g, '');
        return (
          name.includes(cleanQuery) ||
          phone.includes(cleanQuery) ||
          (digitsOnly.length > 0 && phoneDigits.includes(digitsOnly))
        );
      });

      setRunners(filtered);
    } catch (err) {
      console.error('Error fetching runners:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Secret admin command listener: EXCLUSIVELY 'admin' (case-insensitive)
  useEffect(() => {
    if (!isOpen) return;
    const clean = searchQuery.trim().toLowerCase();
    if (clean === 'admin') {
      setSearchQuery('');
      if (onOpenAdmin) {
        onOpenAdmin();
      }
    }
  }, [searchQuery, isOpen, onOpenAdmin]);

  // Debounced search trigger (only runs when text is entered)
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.toLowerCase() === 'admin') {
      setRunners([]);
      return;
    }

    const timer = setTimeout(() => {
      fetchRunners(trimmed);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setRunners([]);
      setSelectedRunner(null);
    }
  }, [isOpen]);

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
          className="bg-white rounded-[2rem] sm:rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100"
        >
          {/* HEADER */}
          <div className="px-5 py-4.5 sm:px-6 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-2xl shadow-md">
                <Search size={22} className="stroke-[2.5]" />
              </div>
              <div className="text-left">
                <h3 className="font-black text-base sm:text-lg leading-tight tracking-tight text-white">
                  Consultar Inscripción
                </h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Escribe tu número de celular o nombre para consultar tu estatus
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

          {/* MAIN SEARCH BAR (ONLY THE SEARCH OPTION - NO COUNTS, NO FILTER TABS) */}
          <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100 shrink-0 text-left">
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const clean = searchQuery.trim().toLowerCase();
                    if (clean === 'admin') {
                      e.preventDefault();
                      setSearchQuery('');
                      if (onOpenAdmin) onOpenAdmin();
                    }
                  }
                }}
                placeholder="Escribe tu número de celular (ej. 0414-1234567) o tu nombre..."
                className="w-full bg-white border-2 border-gray-200 focus:border-orange-500 rounded-2xl pl-12 pr-12 py-3.5 text-sm sm:text-base font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-medium focus:ring-4 focus:ring-orange-500/15 outline-none transition-all shadow-sm"
                autoFocus
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setRunners([]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                  title="Borrar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {/* 1. INITIAL OR SHORT STATE: User hasn't typed enough yet */}
            {searchQuery.trim().length < 3 && (
              <div className="py-14 sm:py-20 text-center space-y-4 max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-orange-50 text-orange-500 mx-auto flex items-center justify-center border border-orange-100 shadow-inner">
                  <Search size={28} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-black text-gray-900 text-lg">Consulta tu Inscripción</h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    {searchQuery.trim().length === 0
                      ? 'Ingresa tu número de celular o nombre en el campo de búsqueda para verificar tu registro.'
                      : 'Continúa escribiendo tu número de celular o nombre (mínimo 3 caracteres)...'}
                  </p>
                </div>
              </div>
            )}

            {/* 2. LOADING STATE */}
            {searchQuery.trim() && isLoading && (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={32} className="animate-spin text-orange-500 mx-auto" />
                <p className="text-sm font-bold text-gray-500">Buscando tu inscripción...</p>
              </div>
            )}

            {/* 3. MATCHING RUNNERS FOUND */}
            {searchQuery.trim() && !isLoading && runners.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left">
                {runners.map((runner) => {
                  const isConfirmado = runner.estado === 'confirmado' || !runner.estado;
                  const fullName = runner.fullName || `${runner.nombre} ${runner.apellido}`.trim();

                  return (
                    <motion.div
                      key={runner.id || runner.celular || runner.cedula}
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
                              <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Phone size={11} className="text-orange-500" />
                                <span>{runner.celular || runner.telefono || runner.cedula || 'Sin celular'}</span>
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
            )}

            {/* 4. NOT FOUND STATE */}
            {searchQuery.trim().length >= 3 && !isLoading && runners.length === 0 && (
              <div className="py-12 sm:py-16 text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-3xl bg-gray-50 text-gray-400 mx-auto flex items-center justify-center border border-gray-100">
                  <Search size={28} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-black text-gray-900 text-lg">
                    No encontramos ninguna inscripción
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    No se encontró ningún participante con{' '}
                    <strong className="text-gray-800 font-bold">"{searchQuery.trim()}"</strong>. Verifica que tu número de celular o nombre estén bien escritos.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 text-xs shrink-0 text-gray-500">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-orange-500" />
              <span>
                Sistema Oficial de Consultas • <strong>{APP_CONFIG.raceName}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
            >
              Cerrar
            </button>
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
                  <span className="font-bold text-gray-500">Número de Celular:</span>
                  <span className="font-mono font-black text-gray-900 text-sm">
                    {selectedRunner.celular || selectedRunner.telefono || selectedRunner.cedula}
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
                Presenta este comprobante o tu número de celular registrado el día de la entrega de dorsales y kits.
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
