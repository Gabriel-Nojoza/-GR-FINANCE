-- Execute depois da migração principal e após criar pelo menos um usuário em Authentication → Users.
do $$ declare tabela text; begin
  foreach tabela in array array['funcionarios','categorias','lancamentos','lancamento_historico','viagens','viagem_voluntarios'] loop
    execute format('drop policy if exists "acesso desenvolvimento" on public.%I', tabela);
    execute format('create policy "acesso autenticado" on public.%I for all to authenticated using (true) with check (true)', tabela);
  end loop;
end $$;

-- O bucket permanece público para que os links persistidos continuem válidos.
-- Para documentos sensíveis em produção, armazene apenas o caminho e gere signed URLs.
update storage.buckets set public = true where id = 'comprovantes';
drop policy if exists "comprovantes leitura" on storage.objects;
create policy "comprovantes leitura autenticada" on storage.objects for select to authenticated using (bucket_id = 'comprovantes');
drop policy if exists "comprovantes envio" on storage.objects;
create policy "comprovantes envio autenticado" on storage.objects for insert to authenticated with check (bucket_id = 'comprovantes');
drop policy if exists "comprovantes exclusao" on storage.objects;
create policy "comprovantes exclusao autenticada" on storage.objects for delete to authenticated using (bucket_id = 'comprovantes');
