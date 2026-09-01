# WhatsApp automático

O sistema grava os agendamentos no Supabase. A Edge Function `enviar-whatsapp-agendado` consulta a fila e envia modelos aprovados pela WhatsApp Cloud API.

## Pré-requisitos na Meta

1. Criar um aplicativo Business e adicionar o produto WhatsApp.
2. Cadastrar o número remetente.
3. Criar e aprovar um modelo Utility em `pt_BR`, por exemplo `lembrete_atendimento`, com uma variável `{{1}}` no corpo.
4. Obter o token permanente e o `Phone Number ID`.

## Banco de dados

Execute `supabase/migrations/202609010004_mensagens_agendadas.sql` no SQL Editor.

## Segredos da Edge Function

Crie localmente um arquivo `.env.whatsapp` (ele é ignorado pelo Git):

```env
WHATSAPP_ACCESS_TOKEN=token-permanente-da-meta
WHATSAPP_PHONE_NUMBER_ID=id-do-numero
WHATSAPP_GRAPH_VERSION=versao-indicada-pela-meta
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
CRON_SECRET=uma-senha-aleatoria-longa
```

Configure e publique:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase secrets set --env-file .env.whatsapp
npx supabase functions deploy enviar-whatsapp-agendado --no-verify-jwt
```

## Cron a cada minuto

No SQL Editor, grave os três valores no Vault seguindo a documentação oficial:

```sql
select vault.create_secret('https://SEU_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('SUA_CHAVE_PUBLICAVEL', 'publishable_key');
select vault.create_secret('A_MESMA_SENHA_DE_CRON_SECRET', 'whatsapp_cron_secret');
```

Depois ative `pg_cron` e `pg_net` em Integrations e execute:

```sql
select cron.schedule(
  'enviar-whatsapp-agendado',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/enviar-whatsapp-agendado',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_cron_secret')
    ),
    body := jsonb_build_object('executado_em', now())
  );
  $$
);
```

Nunca coloque o token da Meta em `NEXT_PUBLIC_*`, `.env.local` versionado ou código do frontend.
