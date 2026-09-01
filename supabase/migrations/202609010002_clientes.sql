create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text not null unique,
  email text not null default '',
  telefone text not null default '',
  cep text not null default '',
  endereco text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null,
  estado text not null,
  observacoes text not null default '',
  status text not null default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lancamentos
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

alter table public.viagens
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists lancamentos_cliente_id_idx on public.lancamentos(cliente_id);
create index if not exists viagens_cliente_id_idx on public.viagens(cliente_id);

alter table public.clientes enable row level security;

drop policy if exists "acesso autenticado" on public.clientes;
create policy "acesso autenticado"
  on public.clientes for all to authenticated
  using (true) with check (true);
