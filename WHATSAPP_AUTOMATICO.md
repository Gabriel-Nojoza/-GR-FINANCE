# WhatsApp automático com Evolution API

O Supabase guarda os agendamentos. A Edge Function `enviar-whatsapp-agendado` consulta a fila e envia a mensagem pela instância `gr-finance` da Evolution API.

## 1. Instância da Evolution

Crie uma instância separada chamada `gr-finance` na Evolution API e conecte o WhatsApp do escritório pelo QR Code. Não reutilize a instância de outro sistema.

## 2. Segredos do Supabase

Crie localmente o arquivo `.env.whatsapp` (ignorado pelo Git):

```env
EVOLUTION_API_URL=https://endereco-publico-da-evolution
EVOLUTION_API_KEY=chave-da-evolution
EVOLUTION_INSTANCE=gr-finance
CRON_SECRET=uma-senha-aleatoria-longa
```

A URL precisa ser acessível pela internet, pois a Edge Function do Supabase não consegue acessar `localhost` ou um endereço privado da VPS.

Configure e publique:

```bash
npx supabase login
npx supabase link --project-ref kycwxilbhfpvzgfxwnuw
npx supabase secrets set --env-file .env.whatsapp
npx supabase functions deploy enviar-whatsapp-agendado --no-verify-jwt
```

## 3. Cron a cada minuto

No SQL Editor, habilite as extensões e grave os valores no Vault. O valor de
`gr_finance_cron_secret` precisa ser igual ao Secret `CRON_SECRET` da Edge Function:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret(
  'https://kycwxilbhfpvzgfxwnuw.supabase.co',
  'gr_finance_project_url'
);
select vault.create_secret(
  'A_MESMA_SENHA_DE_CRON_SECRET',
  'gr_finance_cron_secret'
);
```

Crie o job:

```sql
select cron.schedule(
  'gr-finance-enviar-whatsapp',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'gr_finance_project_url') || '/functions/v1/enviar-whatsapp-agendado',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gr_finance_cron_secret')
    ),
    body := jsonb_build_object('executado_em', now())
  );
  $$
);
```

Nunca coloque a API key da Evolution em `NEXT_PUBLIC_*`, no frontend ou em arquivos enviados ao GitHub.
