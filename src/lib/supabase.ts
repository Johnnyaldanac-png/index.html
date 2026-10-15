import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface RegistrationRecord {
  id?: string;
  nombre: string;
  apellido: string;
  cedula: string;
  correo_electronico: string;
  fecha_nacimiento: string; // YYYY-MM-DD
  categoria?: string;
  edad?: number;
  telefono?: string;
  estado?: 'pendiente' | 'confirmado' | 'rechazado';
  created_at?: string;
  updated_at?: string;
}

/**
 * Public method to create a registration in Supabase
 */
export async function createSupabaseRegistration(data: RegistrationRecord) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado todavía') };
  }
  return await supabase
    .from('registrations')
    .insert([
      {
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        cedula: data.cedula.trim(),
        correo_electronico: data.correo_electronico.trim().toLowerCase(),
        fecha_nacimiento: data.fecha_nacimiento,
        categoria: data.categoria || 'General',
        edad: data.edad || null,
        telefono: data.telefono || null,
        estado: data.estado || 'pendiente',
      },
    ])
    .select()
    .single();
}

/**
 * Private method to list registrations (requires authenticated user)
 */
export async function getSupabaseRegistrations() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado') };
  }
  return await supabase
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false });
}

/**
 * Private method to update a registration (requires authenticated user)
 */
export async function updateSupabaseRegistration(id: string, updates: Partial<RegistrationRecord>) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase no está configurado') };
  }
  return await supabase
    .from('registrations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
}
