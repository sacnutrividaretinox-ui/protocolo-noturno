# Protocolo Noturno (MVP)

SaaS de rotina e disciplina com mentor de IA. Next.js 14 + Supabase + API do Claude.

## Subir

1. **Supabase**: crie um projeto, rode `supabase/schema.sql` no SQL Editor.
   Em Authentication > URL Configuration, coloque a URL do seu deploy em Site URL.
2. **Variáveis**: copie `.env.example` para `.env.local` e preencha (na Vercel, cadastre as mesmas em Settings > Environment Variables).
3. **Local**: `npm install && npm run dev` (http://localhost:3000).
4. **Deploy**: suba a pasta para um repositório e importe na Vercel.

## O que já tem

- Login por link mágico (Supabase Auth)
- Missões diárias com dificuldade
- Score de disciplina transparente (`lib/score.ts`)
- Diário + check-in
- Mentor "Sentinela" com 3 intensidades e memória dos últimos 14 dias (`app/api/mentor/route.ts`)
- Detecção simples de sofrimento: o mentor abandona o tom duro e acolhe (`lib/mentor.ts`)

## Próximos passos

Sugestão de missões pela IA, notificações push, cobrança (Stripe/Mercado Pago) com limite no plano grátis, redenção de streak.

Importante: não use nome, personagem ou frases de franquias protegidas.
