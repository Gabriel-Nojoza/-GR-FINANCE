create table if not exists public.captacoes_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  mes_referencia date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Concluída')),
  observacoes text not null default '',
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, mes_referencia)
);

create index if not exists captacoes_clientes_mes_idx
  on public.captacoes_clientes(mes_referencia, status);

alter table public.captacoes_clientes enable row level security;
drop policy if exists "acesso autenticado" on public.captacoes_clientes;
create policy "acesso autenticado"
  on public.captacoes_clientes for all to authenticated
  using (true) with check (true);

