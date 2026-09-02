alter table public.mensagens_agendadas
  add column if not exists status_entrega text not null default 'Aguardando',
  add column if not exists entregue_em timestamptz,
  add column if not exists visualizada_em timestamptz,
  add column if not exists respondida_em timestamptz,
  add column if not exists resposta_texto text;

create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  whatsapp_message_id text not null unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  agendamento_id uuid references public.mensagens_agendadas(id) on delete set null,
  telefone text not null,
  direcao text not null check (direcao in ('Enviada', 'Recebida')),
  mensagem text not null default '',
  status text not null default 'Enviada',
  enviada_em timestamptz not null default now(),
  entregue_em timestamptz,
  visualizada_em timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_mensagens_cliente_idx
  on public.whatsapp_mensagens(cliente_id, enviada_em desc);
create index if not exists whatsapp_mensagens_telefone_idx
  on public.whatsapp_mensagens(telefone, enviada_em desc);
create index if not exists mensagens_agendadas_acompanhamento_idx
  on public.mensagens_agendadas(cliente_id, enviada_em desc);

alter table public.whatsapp_mensagens enable row level security;
drop policy if exists "acesso autenticado" on public.whatsapp_mensagens;
create policy "acesso autenticado"
  on public.whatsapp_mensagens for all to authenticated
  using (true) with check (true);

