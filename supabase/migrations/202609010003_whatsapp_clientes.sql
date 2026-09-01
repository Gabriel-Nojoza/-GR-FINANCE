alter table public.clientes
  add column if not exists aceita_whatsapp boolean not null default false;
