# Configuração do Supabase

1. Crie um projeto em <https://supabase.com/dashboard>.
2. Abra **SQL Editor**, copie todo o conteúdo de `supabase/migrations/202608300001_financeiro.sql` e execute.
3. Em **Project Settings → API**, copie a URL do projeto e a chave pública/publishable.
4. Crie `.env.local` na raiz do frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

5. Reinicie `npm run dev`.

6. Execute também `supabase/migrations/202608310001_autenticacao.sql`.
7. Execute `supabase/migrations/202609020003_seguranca.sql` (blindagem: remove `anon`, força RLS, bucket privado).
8. No painel do Supabase, abra **Authentication → Users → Add user** e crie os usuários com e-mail e senha.
9. Em **Authentication → Providers → Email**, **desative "Allow new users to sign up"**. Só o administrador cria contas pelo painel.
10. Acesse `/login` e entre com esse usuário.

## Segurança

Toda a autorização acontece via RLS do Supabase (as telas são client-side). Depois das 3 migrações:

- nenhuma política concede acesso ao papel `anon` — sem sessão, o banco não responde;
- RLS está `force` em todas as tabelas;
- o bucket `comprovantes` é **privado**; o app gera URLs assinadas de 10 min sob demanda.

Confirme rodando no SQL Editor (não pode retornar nenhuma linha):

```sql
select tablename, policyname, roles from pg_policies
where schemaname in ('public','storage') and 'anon' = any(roles);
```

Checklist de produção:

- [ ] as 3 migrações aplicadas, nessa ordem;
- [ ] signup público desativado;
- [ ] senhas dos usuários com 8+ caracteres;
- [ ] nos secrets da função `evolution-conexao`, defina `APP_ORIGINS` com a(s) origem(ns) do site (ex.: `https://financeiro.seudominio.com`);
- [ ] nunca exponha a chave `service_role` em variáveis `NEXT_PUBLIC_*`;
- [ ] `CRON_SECRET` e `EVOLUTION_WEBHOOK_SECRET` longos e aleatórios.

O bucket aceita JPG, PNG e PDF com até 10 MB. O histórico de lançamentos é preenchido automaticamente por trigger no banco.

> Comprovantes enviados **antes** desta mudança podem ter sido salvos como URL pública
> completa em `comprovante_url`; o app detecta esse formato e mesmo assim gera uma URL
> assinada. Não é preciso migrar os registros.
