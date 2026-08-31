# GR Finance

Sistema de gestão financeira para escritórios e equipes, com controle de lançamentos, viagens, prestação de contas, funcionários e autenticação integrada ao Supabase.

## Funcionalidades

- Dashboard financeiro
- Receitas, despesas e lançamentos pendentes
- Categorias, formas de pagamento e comprovantes
- Viagens, rotas, quilometragem e prestação de contas
- Cadastro e vínculo de funcionários e voluntários
- Autenticação e persistência de dados com Supabase
- Interface responsiva com identidade visual azul-marinho e dourado

## Tecnologias

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- Docker e Docker Compose

## Desenvolvimento

Crie o arquivo `.env.local` com as variáveis públicas do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

Instale as dependências e inicie o servidor:

```bash
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Docker

Na VPS, o Compose publica a aplicação somente em `127.0.0.1:3002`, permitindo sua exposição segura por um proxy reverso:

```bash
docker compose up -d --build
```

Consulte [DEPLOY_VPS.md](DEPLOY_VPS.md) para as instruções de implantação e [SUPABASE.md](SUPABASE.md) para a configuração do banco de dados.

> Nunca envie `.env.local`, chaves secretas ou a chave `service_role` para o repositório.
