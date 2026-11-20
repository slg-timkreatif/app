-- ============================================================
-- Pelacakan instalasi — Guru Berbagi Selogiri
-- Jalankan di Supabase SQL Editor (project qamqqwfzhyiihqyzliwq).
-- ============================================================

create table if not exists public.creative_installs (
  install_id uuid primary key,
  guru_id uuid,
  client text not null check (client in ('twa', 'pwa')),
  pkg text,
  apkv text,
  web_ver text,
  ua jsonb not null default '{}'::jsonb,
  first_seen timestamptz not null default now()
);

create index if not exists creative_installs_first_seen_idx
  on public.creative_installs (first_seen desc);

create index if not exists creative_installs_guru_idx
  on public.creative_installs (guru_id)
  where guru_id is not null;

alter table public.creative_installs enable row level security;

-- Client boleh mencatat instalasinya sendiri sekali saja.
-- Tidak ada policy UPDATE/DELETE: penulisan ulang harus lewat Edge Function/service role.
drop policy if exists "install_insert" on public.creative_installs;
create policy "install_insert" on public.creative_installs
  for insert to anon, authenticated with check (true);

-- Admin (user login) boleh membaca; sesuaikan dengan kebijakan admin Anda.
drop policy if exists "install_read" on public.creative_installs;
create policy "install_read" on public.creative_installs
  for select to authenticated using (true);

-- Contoh query di admin / SQL Editor:
-- select client, pkg, apkv, web_ver, count(*)
-- from public.creative_installs
-- group by client, pkg, apkv, web_ver
-- order by count(*) desc;
