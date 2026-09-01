create table if not exists public.mensagens_agendadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  telefone text not null,
  template_nome text not null,
  mensagem text not null default '',
  agendada_para timestamptz not null,
  status text not null default 'Pendente'
    check (status in ('Pendente', 'Processando', 'Enviada', 'Erro', 'Cancelada')),
  tentativas integer not null default 0,
  erro text,
  whatsapp_message_id text,
  enviada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mensagens_agendadas_fila_idx
  on public.mensagens_agendadas(status, agendada_para);
create index if not exists mensagens_agendadas_cliente_idx
  on public.mensagens_agendadas(cliente_id);

alter table public.mensagens_agendadas enable row level security;
drop policy if exists "acesso autenticado" on public.mensagens_agendadas;
create policy "acesso autenticado"
  on public.mensagens_agendadas for all to authenticated
  using (true) with check (true);
