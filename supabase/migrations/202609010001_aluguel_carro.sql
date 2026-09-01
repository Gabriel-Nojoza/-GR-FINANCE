-- Custos de locação de veículo nas viagens.
alter table public.viagens
  add column if not exists quantidade_diarias integer not null default 0,
  add column if not exists valor_diaria numeric(12,2) not null default 0;

alter table public.viagens
  drop constraint if exists viagens_quantidade_diarias_valida,
  drop constraint if exists viagens_valor_diaria_valido;

alter table public.viagens
  add constraint viagens_quantidade_diarias_valida
    check (quantidade_diarias >= 0),
  add constraint viagens_valor_diaria_valido
    check (valor_diaria >= 0);
