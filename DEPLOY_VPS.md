# Deploy em VPS com outros projetos

O contêiner não publica portas no host. Ele compartilha a rede externa `fortech_fortech` com o Nginx Proxy Manager, que encaminha o domínio diretamente para `financeiro-adv:3000`.

## 1. Conferir a rede do proxy na VPS

```bash
docker network inspect fortech_fortech
```

O Nginx Proxy Manager e o GR Finance precisam participar dessa mesma rede.

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
docker exec financeiro-adv wget -q --spider http://127.0.0.1:3000/login
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
