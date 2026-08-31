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
7. No painel do Supabase, abra **Authentication → Users → Add user** e crie o primeiro usuário com e-mail e senha.
8. Acesse `/login` e entre com esse usuário.

## Segurança

A migração principal inclui políticas temporárias para `anon`. A segunda migração remove esse acesso e exige uma sessão autenticada para consultar ou alterar as tabelas.

- implemente Supabase Auth;
- remova `anon` das políticas;
- associe os registros a uma organização/usuário;
- troque o bucket de comprovantes para privado;
- nunca exponha a chave `service_role` em variáveis `NEXT_PUBLIC_*`.

O bucket aceita JPG, PNG e PDF com até 10 MB. O histórico de lançamentos é preenchido automaticamente por trigger no banco.
