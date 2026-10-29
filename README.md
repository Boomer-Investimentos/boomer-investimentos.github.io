# Calendário Financeiro — Boomer Investimentos

Página institucional da Boomer Investimentos, com a feature de **Calendário Financeiro**: permite que o cliente registre seus próprios custos, rendas e reservas em um calendário mensal para acompanhar sua vida financeira.

## Funcionalidades

- Lançamento de **custos** (com opção de parcelamento), **rendas** e **reservas**, organizados por mês.
- Marcação de status: pago/pendente (custos) e guardado/pendente (reservas).
- Acesso por **link mágico** enviado por e-mail, sem necessidade de senha.

## Stack

- **Frontend:** React + React Router (Create React App)
- **Backend:** Node/Express (local) e funções serverless na Vercel (produção)
- **Armazenamento:** Google Sheets, via Google Sheets API

## Rodando localmente

Frontend:
```bash
npm start
```

Backend (API):
```bash
cd server && npm start
```
O `server/npm start` carrega as variáveis de `server/.env` automaticamente (via `dotenv`). Veja os nomes das variáveis necessárias em `server/.env.example`.

## Licença

Projeto privado, de uso exclusivo da Boomer Investimentos.
