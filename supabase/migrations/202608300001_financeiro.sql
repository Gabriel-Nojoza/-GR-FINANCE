create extension if not exists pgcrypto;

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  email text not null unique,
  telefone text not null,
  data_entrada date not null,
  status text not null check (status in ('Ativo', 'Inativo')) default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#2563eb',
  created_at timestamptz not null default now()
);

insert into public.categorias (nome, cor) values
  ('Custas', '#f59e0b'), ('Honorários', '#10b981'), ('Viagens', '#8b5cf6'),
  ('Pessoal', '#2563eb'), ('Operacional', '#14b8a6'), ('Outros', '#64748b')
on conflict (nome) do nothing;

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  voluntario_id uuid references public.funcionarios(id) on delete set null,
  voluntario text not null,
  categoria text not null,
  tipo text not null check (tipo in ('Receita', 'Despesa')),
  valor numeric(12,2) not null check (valor > 0),
  forma_pagamento text not null check (forma_pagamento in ('PIX', 'Dinheiro', 'Cartão', 'Transferência')),
  data date not null,
  vencimento date not null,
  status text not null check (status in ('Pago', 'Pendente')),
  recorrente boolean not null default false,
  comprovante_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lancamento_historico (
  id bigint generated always as identity primary key,
  lancamento_id uuid not null,
  acao text not null,
  dados jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.viagens (
  id uuid primary key default gen_random_uuid(),
  motivo text not null,
  origem text not null,
  destino text not null,
  data date not null,
  transporte text not null,
  km_inicial numeric(10,1) not null default 0,
  km_final numeric(10,1) not null default 0,
  custo_km numeric(10,2) not null default 0,
  pedagios numeric(12,2) not null default 0,
  combustivel numeric(12,2) not null default 0,
  alimentacao numeric(12,2) not null default 0,
  hospedagem numeric(12,2) not null default 0,
  adiantamento numeric(12,2) not null default 0,
  status text not null check (status in ('Planejada', 'Em andamento', 'Concluída')),
  prestacao_contas text not null check (prestacao_contas in ('Pendente', 'Entregue', 'Aprovada')) default 'Pendente',
  observacoes text not null default '',
  comprovante_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quilometragem_valida check (km_final >= km_inicial)
);

create table if not exists public.viagem_voluntarios (
  viagem_id uuid references public.viagens(id) on delete cascade,
  funcionario_id uuid references public.funcionarios(id) on delete cascade,
  primary key (viagem_id, funcionario_id)
);

create or replace function public.registrar_historico_lancamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.lancamento_historico (lancamento_id, acao, dados)
  values (
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then 'criado' when tg_op = 'UPDATE' then 'alterado' else 'excluído' end,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists lancamentos_historico on public.lancamentos;
create trigger lancamentos_historico after insert or update or delete on public.lancamentos
for each row execute function public.registrar_historico_lancamento();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', true, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = excluded.public;

alter table public.funcionarios enable row level security;
alter table public.categorias enable row level security;
alter table public.lancamentos enable row level security;
alter table public.lancamento_historico enable row level security;
alter table public.viagens enable row level security;
alter table public.viagem_voluntarios enable row level security;

-- POLÍTICAS DE DESENVOLVIMENTO: permitem uso antes da criação do login.
-- Em produção, remova o papel anon e restrinja por auth.uid()/organização.
do $$ declare tabela text; begin
  foreach tabela in array array['funcionarios','categorias','lancamentos','lancamento_historico','viagens','viagem_voluntarios'] loop
    execute format('drop policy if exists "acesso desenvolvimento" on public.%I', tabela);
    execute format('create policy "acesso desenvolvimento" on public.%I for all to anon, authenticated using (true) with check (true)', tabela);
  end loop;
end $$;

drop policy if exists "comprovantes leitura" on storage.objects;
create policy "comprovantes leitura" on storage.objects for select to anon, authenticated using (bucket_id = 'comprovantes');
drop policy if exists "comprovantes envio" on storage.objects;
create policy "comprovantes envio" on storage.objects for insert to anon, authenticated with check (bucket_id = 'comprovantes');
drop policy if exists "comprovantes exclusao" on storage.objects;
create policy "comprovantes exclusao" on storage.objects for delete to anon, authenticated using (bucket_id = 'comprovantes');
