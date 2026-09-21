'use strict';

/**
 * E2E leve: monta cada função de api/cal/*.js num Express só pra exercitar o
 * fio real (querystring, JSON body, Set-Cookie) — a lógica em si já é testada
 * em lib/cal/handlers/*.test.js. sheets.js e email.js seguem mockados.
 */

process.env.CAL_JWT_SECRET = 'segredo-de-teste-bem-comprido-1234';
process.env.CAL_APP_URL = 'https://cal.exemplo.com';

jest.mock('../../lib/cal/sheets');
jest.mock('../../lib/cal/email');

const express = require('express');
const request = require('supertest');
const sheets = require('../../lib/cal/sheets');
const emailIO = require('../../lib/cal/email');
const auth = require('../../lib/cal/auth');
const fx = require('./fixtures/planilha');

function montarApp() {
  const app = express();
  app.use(express.json());
  // app.all: cada função em api/cal/*.js decide seu próprio método
  // (igual à Vercel, onde uma rota = um arquivo, todos os métodos).
  app.all('/api/cal/mes', (req, res) => require('../../api/cal/mes')(req, res));
  app.all('/api/cal/login', (req, res) => require('../../api/cal/login')(req, res));
  app.all('/api/cal/verificar', (req, res) => require('../../api/cal/verificar')(req, res));
  app.all('/api/cal/logout', (req, res) => require('../../api/cal/logout')(req, res));
  app.all('/api/cal/pagamento', (req, res) => require('../../api/cal/pagamento')(req, res));
  app.all('/api/cal/lancamento', (req, res) => require('../../api/cal/lancamento')(req, res));
  app.all('/api/cal/custo-editar', (req, res) => require('../../api/cal/custo-editar')(req, res));
  app.all('/api/cal/renda-lancamento', (req, res) => require('../../api/cal/renda-lancamento')(req, res));
  app.all('/api/cal/renda-editar', (req, res) => require('../../api/cal/renda-editar')(req, res));
  return app;
}

describe('api/cal — fio completo via HTTP', () => {
  const app = montarApp();

  beforeEach(() => {
    sheets.getTabs.mockResolvedValue({
      CONFIG: fx.SHEETS.CONFIG,
      PARAMS: fx.SHEETS.PARAMS,
      RENDA: fx.SHEETS.RENDA,
      CUSTO_FIXO: fx.SHEETS.CUSTO_FIXO,
    });
    sheets.getValues.mockResolvedValue(fx.SHEETS.CONFIG);
    sheets.updateCell.mockResolvedValue();
    sheets.updateRow.mockResolvedValue();
    sheets.appendRow.mockResolvedValue();
    emailIO.enviarMagicLink.mockResolvedValue();
  });

  test('GET /api/cal/mes sem sessão nem link -> 401', async () => {
    const res = await request(app).get('/api/cal/mes').query({ mes: '2026-09' });
    expect(res.status).toBe(401);
  });

  test('GET /api/cal/mes com link do assessor -> 200 e payload projetado', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);
    const res = await request(app).get('/api/cal/mes').query({ mes: '2026-09', s: link });
    expect(res.status).toBe(200);
    expect(res.body.autenticado).toBe(false);
    expect(res.body.dias).toHaveLength(30);
  });

  test('fluxo completo: login -> verificar -> mes autenticado -> pagamento', async () => {
    const link = auth.assinarLink(fx.SPREADSHEET_ID);

    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.CONFIG);
    const loginRes = await request(app).post('/api/cal/login').send({ s: link, email: fx.EMAIL });
    expect(loginRes.status).toBe(200);
    const magicUrl = emailIO.enviarMagicLink.mock.calls[0][0].url;
    const magicToken = magicUrl.split('t=')[1];

    const verificarRes = await request(app).get('/api/cal/verificar').query({ t: magicToken });
    expect(verificarRes.status).toBe(200);
    const setCookie = verificarRes.headers['set-cookie'][0];
    const cookiePar = setCookie.split(';')[0];

    const mesRes = await request(app).get('/api/cal/mes').query({ mes: '2026-09' }).set('Cookie', cookiePar);
    expect(mesRes.status).toBe(200);
    expect(mesRes.body.autenticado).toBe(true);

    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.CUSTO_FIXO);
    const pagamentoRes = await request(app)
      .post('/api/cal/pagamento')
      .set('Cookie', cookiePar)
      .send({ linhaPlanilha: 2, statusPagamento: 'Pago' });
    expect(pagamentoRes.status).toBe(200);
    expect(sheets.updateCell).toHaveBeenCalledTimes(1);
  });

  test('POST /api/cal/pagamento sem sessão -> 401', async () => {
    const res = await request(app).post('/api/cal/pagamento').send({ linhaPlanilha: 2, statusPagamento: 'Pago' });
    expect(res.status).toBe(401);
  });

  test('POST /api/cal/lancamento com sessão cria a linha', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.CUSTO_FIXO);
    const res = await request(app)
      .post('/api/cal/lancamento')
      .set('Cookie', `${auth.COOKIE_NOME}=${token}`)
      .send({ nome: 'Streaming', valor: 15, categoria: 'Entretenimento', dia: 12, mes: '2026-09' });
    expect(res.status).toBe(201);
    expect(sheets.appendRow).toHaveBeenCalledTimes(1);
  });

  test('POST /api/cal/custo-editar com sessão edita a linha', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.CUSTO_FIXO);
    const res = await request(app)
      .post('/api/cal/custo-editar')
      .set('Cookie', `${auth.COOKIE_NOME}=${token}`)
      .send({ linhaPlanilha: 2, nome: 'Aluguel', valor: 950, categoria: 'Moradia', dia: 1, mes: '2026-09', repetirTodoMes: true });
    expect(res.status).toBe(200);
    expect(sheets.updateRow).toHaveBeenCalledTimes(1);
  });

  test('POST /api/cal/custo-editar sem sessão -> 401', async () => {
    const res = await request(app)
      .post('/api/cal/custo-editar')
      .send({ linhaPlanilha: 2, nome: 'Aluguel', valor: 950, dia: 1, mes: '2026-09' });
    expect(res.status).toBe(401);
  });

  test('POST /api/cal/renda-lancamento com sessão cria a linha', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.RENDA);
    const res = await request(app)
      .post('/api/cal/renda-lancamento')
      .set('Cookie', `${auth.COOKIE_NOME}=${token}`)
      .send({ fonte: 'Freelance', valor: 300, frequencia: 'Mensal', diaRecebimento: 10, mes: '2026-09' });
    expect(res.status).toBe(201);
    expect(sheets.appendRow).toHaveBeenCalledTimes(1);
  });

  test('POST /api/cal/renda-editar com sessão edita a linha', async () => {
    const token = auth.assinarSessao({ sid: fx.SPREADSHEET_ID, email: fx.EMAIL });
    sheets.getValues.mockResolvedValueOnce(fx.SHEETS.RENDA);
    const res = await request(app)
      .post('/api/cal/renda-editar')
      .set('Cookie', `${auth.COOKIE_NOME}=${token}`)
      .send({ linhaPlanilha: 2, fonte: 'Salário', valor: 850, frequencia: 'Semanal', diaRecebimento: 'Sexta-feira', mes: '2026-09', repetirTodoMes: true });
    expect(res.status).toBe(200);
    expect(sheets.updateRow).toHaveBeenCalledTimes(1);
  });

  test('POST /api/cal/logout limpa o cookie', async () => {
    const res = await request(app).post('/api/cal/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toContain('Max-Age=0');
  });

  test('método errado -> 405', async () => {
    const res = await request(app).post('/api/cal/mes');
    expect(res.status).toBe(405);
  });
});
