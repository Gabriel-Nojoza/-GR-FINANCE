-- Blindagem de segurança: remove todo acesso anônimo, força RLS e torna
-- o bucket de comprovantes privado. Rode este arquivo por último, no
-- SQL Editor do projeto de produção.

-- 1. Tabelas: RLS habilitado + forçado, sem acesso para o papel `anon`.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'funcionarios','categorias','lancamentos','lancamento_historico',
    'viagens','viagem_voluntarios','clientes','mensagens_agendadas',
    'whatsapp_mensagens','captacoes_clientes'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('alter table public.%I force row level security', tabela);

    -- Remove qualquer política antiga (inclusive as de desenvolvimento com anon).
    execute format('drop policy if exists "acesso desenvolvimento" on public.%I', tabela);
    execute format('drop policy if exists "acesso autenticado" on public.%I', tabela);

    -- Política única: somente sessão autenticada.
    execute format(
      'create policy "acesso autenticado" on public.%I for all to authenticated using (true) with check (true)',
      tabela
    );

    -- Defesa extra: tira privilégios de tabela do papel anônimo.
    execute format('revoke all on public.%I from anon', tabela);
  end loop;
end $$;

-- 2. Storage: bucket de comprovantes passa a ser privado.
update storage.buckets set public = false where id = 'comprovantes';

drop policy if exists "comprovantes leitura" on storage.objects;
drop policy if exists "comprovantes envio" on storage.objects;
drop policy if exists "comprovantes exclusao" on storage.objects;
drop policy if exists "comprovantes leitura autenticada" on storage.objects;
drop policy if exists "comprovantes envio autenticado" on storage.objects;
drop policy if exists "comprovantes exclusao autenticada" on storage.objects;

create policy "comprovantes leitura autenticada" on storage.objects
  for select to authenticated using (bucket_id = 'comprovantes');
create policy "comprovantes envio autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'comprovantes');
create policy "comprovantes exclusao autenticada" on storage.objects
  for delete to authenticated using (bucket_id = 'comprovantes');

-- 3. Confirmação: esta consulta não pode retornar nenhuma linha com {anon}.
-- select tablename, policyname, roles from pg_policies
-- where schemaname in ('public','storage') and 'anon' = any(roles);
