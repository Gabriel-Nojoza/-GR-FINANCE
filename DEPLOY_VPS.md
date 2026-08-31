# Deploy em VPS com outros projetos

O contêiner publica somente `127.0.0.1:3002`, portanto não disputa as portas públicas 80/443 com os outros projetos. O Nginx/Caddy existente recebe o domínio e encaminha para essa porta.

## 1. Conferir a porta na VPS

```bash
sudo ss -lntp | grep ':3002'
```

Sem saída significa que a porta está livre. Se estiver ocupada, altere `APP_PORT` no `.env.production` e também o `proxy_pass` do Nginx.

## 2. Preparar variáveis

```bash
cp .env.production.example .env.production
nano .env.production
```

Use apenas a URL e a chave publicável do Supabase. Nunca coloque `sb_secret_`.

## 3. Construir e iniciar

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose ps
docker compose logs --tail=100 financeiro-adv
curl -I http://127.0.0.1:3002/login
```

## 4. Nginx

Copie `deploy/nginx-financeiro.conf` para `/etc/nginx/sites-available/financeiro-adv`, troque o domínio e habilite:

```bash
sudo ln -s /etc/nginx/sites-available/financeiro-adv /etc/nginx/sites-enabled/financeiro-adv
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d financeiro.seudominio.com
```

Se a VPS usa Caddy ou Traefik, não instale Nginx adicional; crie apenas uma nova rota no proxy existente para `127.0.0.1:3002`.

## Atualizações

```bash
git pull
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
docker image prune -f
```

## Voltar à imagem anterior

Não use `docker compose down -v`; o projeto não precisa de volumes, mas esse hábito pode apagar volumes de outros projetos quando executado na pasta errada. Mantenha tags das imagens anteriores se precisar de rollback.
