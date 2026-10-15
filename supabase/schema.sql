-- ==========================================================
-- SUPABASE SQL SCHEMA: INSCRIPCIONES DE CARRERA
-- Desafío El Volcán
-- ==========================================================

-- 1. Crear tabla de registros de participantes
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
  estado text default 'pendiente', -- 'pendiente', 'confirmado', 'rechazado'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices recomendados para búsquedas rápidas
create index if not exists idx_registrations_cedula on public.registrations(cedula);
create index if not exists idx_registrations_correo on public.registrations(correo_electronico);
create index if not exists idx_registrations_created_at on public.registrations(created_at desc);

-- 2. Habilitar Row Level Security (RLS)
alter table public.registrations enable row level security;

-- 3. POLÍTICA PÚBLICA PARA CREACIÓN (INSERT):
-- Cualquier persona sin necesidad de estar autenticada puede registrarse.
drop policy if exists "Permitir crear registro publicamente" on public.registrations;
create policy "Permitir crear registro publicamente"
on public.registrations
for insert
to anon, authenticated
with check (true);

-- 4. POLÍTICA PRIVADA PARA LECTURA (SELECT):
-- Solo usuarios autenticados mediante Supabase Auth pueden leer los datos.
drop policy if exists "Solo usuarios autenticados pueden leer registros" on public.registrations;
create policy "Solo usuarios autenticados pueden leer registros"
on public.registrations
for select
to authenticated
using (true);

-- 5. POLÍTICA PRIVADA PARA ACTUALIZACIÓN (UPDATE):
-- Solo usuarios autenticados mediante Supabase Auth pueden modificar los registros.
drop policy if exists "Solo usuarios autenticados pueden actualizar registros" on public.registrations;
create policy "Solo usuarios autenticados pueden actualizar registros"
on public.registrations
for update
to authenticated
using (true)
with check (true);

-- 6. Trigger automático para actualizar updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.registrations;
create trigger set_updated_at
before update on public.registrations
for each row
execute procedure public.handle_updated_at();
