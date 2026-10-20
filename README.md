# CRM · TCF Advogados · Dra. Talita

Painel do agente de atendimento (funil, conversas do WhatsApp, ficha do lead, configuração do agente, clientes, áudios, usuários).
React + Vite + Tailwind + Supabase. Publicado no Easypanel da VPS da Dra. Talita (Dockerfile + nginx).

- Desenvolvimento: `npm install` e `npm run dev` (crie `.env.local` com as mesmas chaves do `.env.production`).
- Produção: o Easypanel constrói pelo `Dockerfile` a cada push na `main`. As rotas do React são servidas pelo `deploy/nginx.conf`.
- `.env.production` só tem valores públicos (URL do Supabase e chave publicável). Nenhuma chave secreta entra neste repositório.
- Fonte e histórico completos: pasta `agente-1` do projeto (README, docs/diario-desenvolvimento.md).
