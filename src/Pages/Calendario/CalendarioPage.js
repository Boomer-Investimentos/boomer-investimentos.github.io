import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CircleCheck, Clock, TriangleAlert, TrendingUp, PiggyBank, Wallet, Check,
  Coins, House, Laptop, Clapperboard, HeartPulse, Wrench, ShoppingBag, Dumbbell, Tag,
} from 'lucide-react';
import '@google/model-viewer';
import styles from './CalendarioPage.module.css';
import boomerBMark from '../../assets/imgs/boomer-b-mark.png';
import boomerLogo3D from '../../assets/3d/Logo Boomer 20_PNG-terracota.glb';
import {
  obterMes,
  verificarAcesso,
  pedirAcesso,
  atualizarPagamento,
  criarLancamento,
  editarCusto,
  criarRenda,
  editarRenda,
  criarReserva,
  editarReserva,
  atualizarReserva,
} from '../../services/calendarioService';

const LINK_TOKEN_KEY = 'cal_link_token';
const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function somarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const total = ano * 12 + (m - 1) + delta;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, '0')}`;
}

function primeiroDiaDaSemana(mes) {
  return new Date(`${mes}-01T00:00:00Z`).getUTCDay();
}

const COR_FUNDO = '#141c31'; // = --surface em CalendarioPage.module.css

const LOCALE_POR_MOEDA = { USD: 'en-US', BRL: 'pt-BR' };

function localeDaMoeda(moeda) {
  return LOCALE_POR_MOEDA[moeda] || 'pt-BR';
}

function formatarMoeda(valor, moeda) {
  try {
    return new Intl.NumberFormat(localeDaMoeda(moeda), { style: 'currency', currency: moeda || 'BRL' }).format(valor);
  } catch {
    return `${moeda || 'BRL'} ${valor.toFixed(2)}`;
  }
}

function formatarNumero(valor, moeda) {
  return new Intl.NumberFormat(localeDaMoeda(moeda), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

function tituloMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const nome = new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function tituloDia(dataISO) {
  const nome = new Date(`${dataISO}T00:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

// Mapa categoria -> ícone Lucide (chave por nome normalizado; `includes` cobre
// variações como "Software e Ferramentas"). Fallback: Circle.
const ICONES_CATEGORIA = {
  recebimento: Coins,
  moradia: House,
  tecnologia: Laptop,
  entretenimento: Clapperboard,
  saude: HeartPulse,
  software: Wrench,
  compras: ShoppingBag,
  esportes: Dumbbell,
  reserva: PiggyBank,
};
function normalizarTexto(txt) {
  return (txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function iconeCategoria(nome) {
  const chave = normalizarTexto(nome);
  const achado = Object.keys(ICONES_CATEGORIA).find((k) => chave.includes(k));
  return achado ? ICONES_CATEGORIA[achado] : Tag;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Vira pago/pendente (custo) ou guardado/pendente (reserva) no estado local,
// sem esperar a planilha (atualização otimista). Espelha as regras de
// lib/cal/projection.js: custo cai em atrasado/pago/pendente; reserva guardada
// soma em `reservado`; saldo = receita - (pago + pendente + atrasado + reservado).
// O alvo é achado por tipo+linha+data e virado pelo seu estado ATUAL, então
// aplicar duas vezes desfaz (usado no rollback quando a gravação falha).
function aplicarToggleOtimista(dados, alvo) {
  if (!dados) return dados;
  const mesmo = (i) =>
    i.tipo === alvo.tipo && i.linhaPlanilha === alvo.linhaPlanilha && (i.data || null) === (alvo.data || null);
  const totals = { ...dados.totals };

  const virar = (i) => {
    if (i.tipo === 'reserva') {
      const guardado = i.statusReserva === 'guardado';
      totals.reservado = round2((totals.reservado || 0) + (guardado ? -i.valor : i.valor));
      return { ...i, statusReserva: guardado ? 'pendente' : 'guardado' };
    }
    const novoPago = i.statusPagamento !== 'pago';
    const atrasado = !novoPago && i.data != null && i.data < dados.hoje;
    const antes = i.atrasado ? 'atrasado' : i.statusPagamento === 'pago' ? 'pago' : 'pendente';
    const depois = atrasado ? 'atrasado' : novoPago ? 'pago' : 'pendente';
    totals[antes] = round2((totals[antes] || 0) - i.valor);
    totals[depois] = round2((totals[depois] || 0) + i.valor);
    return { ...i, statusPagamento: novoPago ? 'pago' : 'pendente', atrasado };
  };

  const mapItens = (itens) => itens.map((i) => (mesmo(i) ? virar(i) : i));
  const dias = dados.dias.map((d) => (d.itens.some(mesmo) ? { ...d, itens: mapItens(d.itens) } : d));
  const semData = mapItens(dados.semData || []);
  totals.saldo = round2(
    (totals.receita || 0) - ((totals.pago || 0) + (totals.pendente || 0) + (totals.atrasado || 0) + (totals.reservado || 0)),
  );
  return { ...dados, dias, semData, totals };
}

function LoadingLogo() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Só reduz o brilho/verniz (roughness/metallic) do material já vindo
    // colorido certo do arquivo — não mexe na cor base.
    const fosco = () => {
      (el.model?.materials || []).forEach((m) => {
        m.pbrMetallicRoughness.setRoughnessFactor(0.95);
        m.pbrMetallicRoughness.setMetallicFactor(0);
      });
    };
    el.addEventListener('load', fosco);
    return () => el.removeEventListener('load', fosco);
  }, []);

  return (
    <model-viewer
      ref={ref}
      src={boomerLogo3D}
      class={styles.loadingLogo}
      auto-rotate
      auto-rotate-delay="0"
      rotation-per-second="60deg"
      disable-zoom
      interaction-prompt="none"
      camera-controls={false}
      tone-mapping="neutral"
      exposure="1"
      shadow-intensity="0"
    />
  );
}

export default function CalendarioPage() {
  const [linkToken, setLinkToken] = useState('');
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroFatal, setErroFatal] = useState(null);
  const [erroAcao, setErroAcao] = useState(null);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [emailLogin, setEmailLogin] = useState('');
  const [mensagemLogin, setMensagemLogin] = useState(null);
  const [painelItem, setPainelItem] = useState(null); // null | { modo: 'criar'|'editar', tipo: 'custo'|'renda', item? }
  const [confirmExcluir, setConfirmExcluir] = useState(null); // null | { tipo, form }
  const [acaoItem, setAcaoItem] = useState(null); // null | item (escolha pagar/editar no mobile)
  const [vista, setVista] = useState('mes'); // 'mes' | 'agenda'
  // Gravações de pago/guardado em andamento + mês atual (lido dentro de callbacks
  // assíncronos): a releitura silenciosa só aplica se não houver gravação pendente
  // e o usuário ainda estiver no mesmo mês, senão sobrescreveria a tela otimista.
  const escritasPendentes = useRef(0);
  const mesRef = useRef(mes);
  mesRef.current = mes;
  // Tempo mínimo pra tela de carregamento inicial ficar visível, pra dar
  // chance da logo 3D (model-viewer) carregar e girar antes de trocar pra
  // tela real — sem isso, em conexões rápidas o fetch termina antes da logo
  // sequer aparecer. `introOk` só vira true uma vez (primeira carga) e nunca
  // mais volta a false, então trocas de mês depois não reativam a tela cheia.
  const [tempoMinimoOk, setTempoMinimoOk] = useState(false);
  const [introOk, setIntroOk] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTempoMinimoOk(true), 1800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!introOk && dados && tempoMinimoOk) setIntroOk(true);
  }, [introOk, dados, tempoMinimoOk]);

  // `silencioso`: releitura em segundo plano (reconcilia após gravar) — sem
  // ligar o "carregando", sem erro fatal e sem sobrescrever gravação pendente.
  const carregarMes = useCallback(async (mesAlvo, token, { silencioso = false } = {}) => {
    if (!silencioso) {
      setCarregando(true);
      setErroFatal(null);
    }
    try {
      const resposta = await obterMes(mesAlvo, token);
      if (silencioso && (escritasPendentes.current > 0 || mesRef.current !== mesAlvo)) return;
      setDados(resposta);
      setMes(mesAlvo);
    } catch (e) {
      if (!silencioso) setErroFatal(e.message);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Boomer Investimentos - Calendário Financeiro';
    return () => {
      document.title = anterior;
    };
  }, []);

  // Página dark-only: pinta html/body e a theme-color pra Safari/Chrome mobile
  // não mostrarem faixas brancas atrás da barra do navegador. Restaura ao sair.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const anterior = {
      html: document.documentElement.style.backgroundColor,
      body: document.body.style.backgroundColor,
      tema: meta ? meta.getAttribute('content') : null,
    };
    document.documentElement.style.backgroundColor = COR_FUNDO;
    document.body.style.backgroundColor = COR_FUNDO;
    if (meta) meta.setAttribute('content', COR_FUNDO);
    return () => {
      document.documentElement.style.backgroundColor = anterior.html;
      document.body.style.backgroundColor = anterior.body;
      if (meta && anterior.tema !== null) meta.setAttribute('content', anterior.tema);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get('t');
    const sParam = params.get('s');
    if (sParam) sessionStorage.setItem(LINK_TOKEN_KEY, sParam);
    const token = sParam || sessionStorage.getItem(LINK_TOKEN_KEY) || '';
    setLinkToken(token);

    (async () => {
      if (magicToken) {
        try {
          await verificarAcesso(magicToken);
        } catch {
          // link de e-mail expirado/invalido: segue como leitura, se houver link do assessor
        }
        const url = new URL(window.location.href);
        url.searchParams.delete('t');
        window.history.replaceState({}, '', url.toString());
      }
      carregarMes(mesAtual(), token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudarMes = (delta) => carregarMes(somarMes(mes, delta), linkToken);

  const exigirLogin = () => {
    setErroAcao(null);
    setMostrarLogin(true);
  };

  const enviarPedidoAcesso = async (ev) => {
    ev.preventDefault();
    setMensagemLogin(null);
    try {
      const r = await pedirAcesso(linkToken, emailLogin);
      setMensagemLogin(r.mensagem || 'Verifique seu e-mail.');
    } catch (e) {
      setMensagemLogin(e.message);
    }
  };

  const alternarPago = async (item) => {
    if (!dados.autenticado) return exigirLogin();
    setErroAcao(null);
    // Atualização otimista: vira o check (e os totais) na hora, sem esperar a
    // planilha. A gravação e a releitura acontecem em segundo plano.
    setDados((atual) => aplicarToggleOtimista(atual, item));
    escritasPendentes.current += 1;
    try {
      if (item.tipo === 'reserva') {
        const novoStatus = item.statusReserva === 'guardado' ? 'Pendente' : 'Guardado';
        await atualizarReserva(item.linhaPlanilha, novoStatus, mes);
      } else {
        const novoStatus = item.statusPagamento === 'pago' ? 'Pendente' : 'Pago';
        await atualizarPagamento(item.linhaPlanilha, novoStatus, mes);
      }
    } catch (e) {
      // Falhou: desfaz o otimista (aplicar de novo reverte) e mostra o erro.
      setDados((atual) => aplicarToggleOtimista(atual, item));
      setErroAcao(e.message);
    } finally {
      escritasPendentes.current -= 1;
    }
    // Reconcilia com a planilha só quando não resta gravação pendente.
    if (escritasPendentes.current === 0) carregarMes(mes, linkToken, { silencioso: true });
  };

  const abrirPainelCriar = () => {
    if (dados && !dados.autenticado) return exigirLogin();
    setErroAcao(null);
    setPainelItem({ modo: 'criar', tipo: 'custo' });
  };

  const abrirPainelEditar = (item) => {
    if (!dados.autenticado) return exigirLogin();
    setErroAcao(null);
    setPainelItem({ modo: 'editar', tipo: item.tipo, item });
  };

  // Toque no badge (mobile): se a sessão não estiver verificada, pede o e-mail
  // primeiro; só com a sessão autenticada abre a escolha pagar/editar.
  const pedirAcaoPagamento = (item) => {
    if (!dados.autenticado) return exigirLogin();
    setErroAcao(null);
    setAcaoItem(item);
  };

  const fecharPainel = () => {
    setErroAcao(null);
    setPainelItem(null);
  };

  const salvarPainel = async (tipo, form, statusPagamento) => {
    setErroAcao(null);
    try {
      if (painelItem.modo === 'criar') {
        if (tipo === 'custo') await criarLancamento({ ...form, mes });
        else if (tipo === 'reserva') await criarReserva({ ...form, mes });
        else await criarRenda({ ...form, mes });
      } else {
        const linhaPlanilha = painelItem.item.linhaPlanilha;
        if (tipo === 'custo') {
          await editarCusto({ ...form, linhaPlanilha, mes });
          if (statusPagamento) await atualizarPagamento(linhaPlanilha, statusPagamento, mes);
        } else if (tipo === 'reserva') {
          await editarReserva({ ...form, linhaPlanilha, mes });
          if (statusPagamento) await atualizarReserva(linhaPlanilha, statusPagamento, mes);
        } else {
          await editarRenda({ ...form, linhaPlanilha, mes });
        }
      }
      fecharPainel();
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  const excluirPainel = (tipo, form) => {
    setConfirmExcluir({ tipo, form });
  };

  const confirmarExclusao = async () => {
    const { tipo, form } = confirmExcluir;
    setConfirmExcluir(null);
    setErroAcao(null);
    try {
      const linhaPlanilha = painelItem.item.linhaPlanilha;
      if (tipo === 'custo') await editarCusto({ ...form, linhaPlanilha, mes, status: 'Inativo' });
      else if (tipo === 'reserva') await editarReserva({ ...form, linhaPlanilha, mes, status: 'Inativo' });
      else await editarRenda({ ...form, linhaPlanilha, mes, status: 'Inativo' });
      fecharPainel();
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  if (!introOk && !erroFatal) {
    return (
      <div className={styles.page}>
        <div className={styles.centerScreen}>
          <LoadingLogo />
        </div>
      </div>
    );
  }

  if (erroFatal && !dados) {
    return (
      <div className={styles.page}>
        <div className={styles.centerScreen}>
          {erroFatal}
          <br />
          Use o link enviado pelo seu assessor para acessar o Calendário Financeiro.
        </div>
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div className={styles.page}>
      <Topbar />
      <div className={styles.content}>
        <main className={styles.main}>
          <Toolbar
            mes={mes}
            dados={dados}
            onNav={mudarMes}
            onAdicionar={abrirPainelCriar}
            carregando={carregando}
          />
          <SummaryCards totals={dados.totals} moeda={dados.moeda} />
          <ViewToggle vista={vista} onChange={setVista} />
          {vista === 'mes' ? (
            <>
              <div className={styles.desktopOnly}>
                <MonthGrid dados={dados} mes={mes} onEditar={abrirPainelEditar} onTogglePago={alternarPago} onPedirAcao={pedirAcaoPagamento} />
              </div>
              <div className={styles.mobileOnly}>
                <MobileAgenda dados={dados} mes={mes} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
              </div>
            </>
          ) : (
            <AgendaView dados={dados} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          )}
          <Legend categorias={dados.categorias} />
          {vista === 'mes' && dados.semData.length > 0 && (
            <SemData itens={dados.semData} moeda={dados.moeda} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          )}
          {erroAcao && !painelItem && <div className={styles.errorText}>{erroAcao}</div>}
        </main>

        {painelItem && (
          <PaymentPanel
            key={`${painelItem.modo}-${painelItem.tipo}-${painelItem.item?.linhaPlanilha ?? 'novo'}`}
            mes={mes}
            erro={erroAcao}
            nomesCusto={dados.nomesCusto || []}
            categoriasCusto={dados.categorias.filter((c) => c.nome !== 'Recebimento' && c.nome !== 'Reserva')}
            modo={painelItem.modo}
            tipoInicial={painelItem.tipo}
            item={painelItem.item}
            onSalvar={salvarPainel}
            onExcluir={excluirPainel}
            onCancelar={fecharPainel}
          />
        )}
      </div>

      {mostrarLogin && (
        <LoginModal
          email={emailLogin}
          onEmailChange={setEmailLogin}
          mensagem={mensagemLogin}
          onEnviar={enviarPedidoAcesso}
          onFechar={() => setMostrarLogin(false)}
        />
      )}

      {confirmExcluir && (
        <ConfirmModal
          titulo="Excluir lançamento"
          mensagem="Excluir este lançamento?"
          confirmarLabel="Excluir"
          onConfirmar={confirmarExclusao}
          onCancelar={() => setConfirmExcluir(null)}
        />
      )}

      {acaoItem && (
        <AcaoPagamentoModal
          item={acaoItem}
          onPagar={async () => {
            const alvo = acaoItem;
            setAcaoItem(null);
            await alternarPago(alvo);
          }}
          onEditar={() => {
            const alvo = acaoItem;
            setAcaoItem(null);
            abrirPainelEditar(alvo);
          }}
          onCancelar={() => setAcaoItem(null)}
        />
      )}
    </div>
  );
}

function Topbar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.brandGroup}>
        <img src={boomerBMark} alt="Boomer" className={styles.brandMark} />
        <span className={styles.brandName}>boomer</span>
        <span className={styles.brandDivider} />
        <span className={styles.brandSection}>Calendário Financeiro</span>
      </div>
    </header>
  );
}

function Toolbar({ mes, dados, onNav, onAdicionar, carregando }) {
  return (
    <div className={styles.toolbar}>
      <div>
        <div className={styles.monthTitle}>{tituloMes(mes)}</div>
        <div className={styles.monthSubtitle}>
          {dados.cliente}
          {dados.tituloEstrategia ? ` · ${dados.tituloEstrategia}` : ''}
        </div>
      </div>
      <div className={styles.toolbarActions}>
        <div className={styles.navGroup}>
          <button className={styles.navButton} onClick={() => onNav(-1)} disabled={carregando} aria-label="Mês anterior">
            ‹
          </button>
          <button className={styles.navButton} onClick={() => onNav(1)} disabled={carregando} aria-label="Próximo mês">
            ›
          </button>
        </div>
        <button className={styles.addButton} onClick={onAdicionar}>
          + Adicionar
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ totals, moeda }) {
  return (
    <div className={styles.summaryRow}>
      <SummaryCard label="Pago" icone={CircleCheck} valor={totals.pago} moeda={moeda} cor="var(--ink-subtle)" />
      <SummaryCard label="A pagar" icone={Clock} valor={totals.pendente} moeda={moeda} cor="var(--ink)" />
      <SummaryCard label="Em atraso" icone={TriangleAlert} valor={totals.atrasado} moeda={moeda} cor="var(--status-atrasado)" />
      <SummaryCard label="Entradas" icone={TrendingUp} valor={totals.receita} moeda={moeda} cor="var(--status-receita)" />
      <SummaryCard label="Reservas" icone={PiggyBank} valor={totals.reservado || 0} moeda={moeda} cor="var(--status-reserva)" />
      <div className={styles.summaryDivider} aria-hidden="true" />
      <SummaryCard
        label="Disponível"
        icone={Wallet}
        valor={totals.saldo || 0}
        moeda={moeda}
        cor={(totals.saldo || 0) >= 0 ? 'var(--status-receita)' : 'var(--status-atrasado)'}
        heroi
      />
    </div>
  );
}

function SummaryCard({ label, icone: Icone, valor, moeda, cor, destaque, heroi }) {
  return (
    <div
      className={`${styles.summaryCard} ${heroi ? styles.summaryCardHero : destaque ? styles.summaryCardDestaque : ''}`}
      style={heroi ? { borderColor: cor, background: `color-mix(in srgb, ${cor} 8%, var(--surface-raised))` } : undefined}
    >
      <div className={styles.summaryLabel}>
        <span>{label}</span>
        {Icone && <Icone />}
      </div>
      <div className={styles.summaryValue} style={{ color: cor }}>
        {formatarMoeda(valor, moeda)}
      </div>
    </div>
  );
}

function MonthGrid({ dados, mes, onEditar, onTogglePago, onPedirAcao }) {
  const blanksAntes = primeiroDiaDaSemana(mes);
  const totalCelulas = blanksAntes + dados.dias.length;
  const blanksDepois = (7 - (totalCelulas % 7)) % 7;

  return (
    <>
      <div className={styles.dowRow}>
        {DOW.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.grid}>
        {Array.from({ length: blanksAntes }).map((_, i) => (
          <div key={`antes-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
        ))}
        {dados.dias.map((dia) => (
          <DayCell key={dia.data} dia={dia} hoje={dados.hoje} moeda={dados.moeda} onEditar={onEditar} onTogglePago={onTogglePago} onPedirAcao={onPedirAcao} />
        ))}
        {Array.from({ length: blanksDepois }).map((_, i) => (
          <div key={`depois-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
        ))}
      </div>
    </>
  );
}

function nomeComParcela(item) {
  return item.parcela ? `${item.nome} (${item.parcela.atual}/${item.parcela.total})` : item.nome;
}

function DayCell({ dia, hoje, moeda, onEditar, onTogglePago, onPedirAcao }) {
  const isHoje = dia.data === hoje;
  const atrasado = dia.itens.some((i) => i.atrasado);
  const totalSaida = dia.itens
    .filter((i) => i.tipo === 'custo')
    .reduce((s, i) => s + i.valor, 0);

  const classe = [
    styles.cell,
    dia.itens.length === 0 ? styles.cellVazio : '',
    isHoje ? styles.cellToday : '',
    !isHoje && atrasado ? styles.cellLate : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classe}>
      <div className={styles.cellHead}>
        <span className={`${styles.cellDay} ${isHoje ? styles.cellDayToday : atrasado ? styles.cellDayLate : ''}`}>
          {atrasado && !isHoje && <TriangleAlert size={13} strokeWidth={2.4} role="img" aria-label="Em atraso" />}
          {dia.dia}
        </span>
        {totalSaida > 0 && <span className={styles.cellDayTotal}>−{formatarNumero(totalSaida, moeda)}</span>}
      </div>
      {dia.itens.map((item, idx) => (
        <Item key={idx} item={item} moeda={moeda} onEditar={onEditar} onTogglePago={onTogglePago} onPedirAcao={onPedirAcao} />
      ))}
    </div>
  );
}

function useCliqueSimplesOuDuplo(aoClicar, aoClicarDuplo) {
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    onClick: () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        aoClicar();
      }, 250);
    },
    onDoubleClick: () => {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      aoClicarDuplo();
    },
  };
}

function itemConcluido(item) {
  return item.tipo === 'reserva' ? item.statusReserva === 'guardado' : item.statusPagamento === 'pago';
}

function Item({ item, moeda, onEditar, onTogglePago, onPedirAcao }) {
  const concluido = itemConcluido(item);
  const alternavel = item.tipo === 'custo' || item.tipo === 'reserva';
  const acionavel = alternavel && !concluido && typeof onPedirAcao === 'function';
  const classeNome = concluido ? styles.itemNamePago : '';
  const classeValor =
    item.tipo === 'renda'
      ? styles.itemAmountReceita
      : item.atrasado
        ? styles.itemAmountAtrasado
        : concluido
          ? styles.itemAmountPago
          : styles.itemAmountPendente;

  const marca = item.tipo === 'renda' ? '+' : concluido ? ' ✓' : item.atrasado ? ' !' : '';

  const comCheck = alternavel && typeof onTogglePago === 'function';
  const aoClicar = () => { if (acionavel) onPedirAcao(item); else onEditar(item); };
  const aoTeclar = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      aoClicar();
    }
  };

  const titulo = acionavel
    ? (item.tipo === 'reserva' ? 'Clique para guardar ou editar' : 'Clique para pagar ou editar')
    : 'Editar lançamento';

  return (
    <div
      className={`${styles.item} ${styles.itemClickable} ${comCheck ? styles.itemComCheck : ''}`}
      onClick={aoClicar}
      onKeyDown={aoTeclar}
      role="button"
      tabIndex={0}
      title={titulo}
    >
      <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
      {comCheck && (
        <button
          type="button"
          className={`${styles.itemCheck} ${item.tipo === 'reserva' ? styles.itemCheckReserva : ''} ${concluido ? styles.itemCheckOn : ''}`}
          onClick={(ev) => { ev.stopPropagation(); onTogglePago(item); }}
          onKeyDown={(ev) => ev.stopPropagation()}
          aria-pressed={concluido}
          aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} ${item.tipo === 'reserva' ? 'guardado' : 'pago'}: ${item.nome}`}
        >
          <Check size={8} strokeWidth={3.5} aria-hidden="true" />
        </button>
      )}
      <div className={styles.itemBody}>
        <div className={`${styles.itemName} ${classeNome}`}>{nomeComParcela(item)}</div>
      </div>
      <div className={`${styles.itemAmount} ${classeValor}`}>
        {marca === '+' ? '+' : ''}
        {formatarNumero(item.valor, moeda)}
        {marca !== '+' ? marca : ''}
      </div>
    </div>
  );
}

/*
 * Vista mobile: em vez da grade de 7 colunas do desktop com texto dentro de
 * cada célula (ilegível em ~400px — nomes/valores cortados), usa o padrão do
 * mockup original pra celular: mini-calendário só com pontinhos por
 * categoria + lista de detalhe do dia selecionado abaixo.
 */
function MobileAgenda({ dados, mes, onEditar, onTogglePago }) {
  const hojeNoMes = dados.dias.some((d) => d.data === dados.hoje);
  const [diaSelecionado, setDiaSelecionado] = useState(hojeNoMes ? dados.hoje : dados.dias[0]?.data);

  useEffect(() => {
    const hoje = dados.dias.some((d) => d.data === dados.hoje);
    setDiaSelecionado(hoje ? dados.hoje : dados.dias[0]?.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const diaAtual = dados.dias.find((d) => d.data === diaSelecionado) || dados.dias[0];
  if (!diaAtual) return null;

  return (
    <div className={styles.mobileAgenda}>
      <DayList dia={diaAtual} hoje={dados.hoje} moeda={dados.moeda} onEditar={onEditar} onTogglePago={onTogglePago} />
      <MiniCalendar mes={mes} dias={dados.dias} hoje={dados.hoje} selecionado={diaAtual.data} onSelecionar={setDiaSelecionado} />
    </div>
  );
}

function MiniCalendar({ mes, dias, hoje, selecionado, onSelecionar }) {
  const blanksAntes = primeiroDiaDaSemana(mes);
  const totalCelulas = blanksAntes + dias.length;
  const blanksDepois = (7 - (totalCelulas % 7)) % 7;

  return (
    <>
      <div className={styles.dowRow}>
        {DOW.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.miniGrid}>
        {Array.from({ length: blanksAntes }).map((_, i) => (
          <div key={`antes-${i}`} className={`${styles.miniCell} ${styles.cellBlank}`} />
        ))}
        {dias.map((dia) => (
          <MiniCell
            key={dia.data}
            dia={dia}
            isHoje={dia.data === hoje}
            isSelecionado={dia.data === selecionado}
            onSelecionar={onSelecionar}
          />
        ))}
        {Array.from({ length: blanksDepois }).map((_, i) => (
          <div key={`depois-${i}`} className={`${styles.miniCell} ${styles.cellBlank}`} />
        ))}
      </div>
    </>
  );
}

function MiniCell({ dia, isHoje, isSelecionado, onSelecionar }) {
  const atrasado = dia.itens.some((i) => i.atrasado);
  const classe = [
    styles.miniCell,
    isHoje ? styles.cellToday : '',
    isSelecionado ? styles.miniCellSelecionado : '',
    !isHoje && atrasado ? styles.cellLate : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classe} onClick={() => onSelecionar(dia.data)}>
      <span className={`${styles.cellDay} ${isHoje ? styles.cellDayToday : atrasado ? styles.cellDayLate : ''}`}>
        {atrasado && !isHoje && <TriangleAlert size={13} strokeWidth={2.4} role="img" aria-label="Em atraso" />}
        {dia.dia}
      </span>
      <span className={styles.miniDots}>
        {dia.itens.slice(0, 3).map((item, idx) => (
          <span key={idx} className={styles.miniDot} style={{ background: item.categoria.cor }} />
        ))}
      </span>
    </button>
  );
}

function DayList({ dia, hoje, moeda, onEditar, onTogglePago, comIcone }) {
  return (
    <div className={styles.dayList}>
      <div className={styles.dayListHead}>
        <span className={styles.dayListTitle}>{tituloDia(dia.data)}</span>
        {dia.data === hoje && <span className={styles.dayListBadge}>hoje</span>}
      </div>
      {dia.itens.length === 0 ? (
        <div className={styles.dayListVazio}>Nenhum lançamento.</div>
      ) : (
        // Chave por identidade (não por posição): senão, ao trocar de dia, o React
        // reaproveita o mesmo botão da linha anterior e o check "desliza" do estado dela.
        dia.itens.map((item, idx) => <DayListRow key={`${item.tipo}-${item.linhaPlanilha ?? idx}-${item.data ?? dia.data}`} item={item} moeda={moeda} onEditar={onEditar} onTogglePago={onTogglePago} comIcone={comIcone} />)
      )}
    </div>
  );
}

function DayListRow({ item, moeda, onEditar, onTogglePago, comIcone }) {
  const concluido = itemConcluido(item);
  const IconeCat = iconeCategoria(item.categoria.nome);
  const alternavel = item.tipo === 'custo' || item.tipo === 'reserva';
  const classeNome = concluido ? styles.itemNamePago : '';
  const valorClasse =
    item.tipo === 'renda'
      ? styles.itemAmountReceita
      : item.atrasado
        ? styles.itemAmountAtrasado
        : concluido
          ? styles.itemAmountPago
          : styles.itemAmountPendente;

  const { onClick, onDoubleClick } = useCliqueSimplesOuDuplo(
    () => onEditar(item),
    () => { if (alternavel) onTogglePago(item); },
  );
  const aoTeclar = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onEditar(item);
    }
  };

  return (
    <div
      className={`${styles.dayListRow} ${styles.itemClickable}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={aoTeclar}
      role="button"
      tabIndex={0}
    >
      {comIcone ? (
        <span className={styles.itemIcon} style={{ color: item.categoria.cor }}>
          <IconeCat size={17} strokeWidth={2} aria-hidden="true" />
        </span>
      ) : (
        <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
      )}
      <div className={styles.itemBody} style={{ flex: 1 }}>
        <div className={`${styles.itemName} ${classeNome}`}>{nomeComParcela(item)}</div>
        {item.tipo !== 'renda' && <div className={styles.semDataMeta}>{item.categoria.nome}</div>}
      </div>
      <span className={`${styles.dayListAmount} ${valorClasse}`}>
        {item.tipo === 'renda' ? '+' : ''}
        {formatarMoeda(item.valor, moeda)}
      </span>
      {alternavel && (
        <button
          type="button"
          className={`${styles.agendaCheck} ${item.tipo === 'reserva' ? styles.agendaCheckReserva : ''} ${concluido ? styles.agendaCheckOn : ''}`}
          onClick={(ev) => { ev.stopPropagation(); onTogglePago(item); }}
          aria-pressed={concluido}
          aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} ${item.tipo === 'reserva' ? 'guardado' : 'pago'}: ${item.nome}`}
        >
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function ViewToggle({ vista, onChange }) {
  const opcoes = [['mes', 'Mês'], ['agenda', 'Agenda']];
  return (
    <div className={styles.viewToggle} role="tablist" aria-label="Visualização">
      {opcoes.map(([valor, label]) => (
        <button
          key={valor}
          type="button"
          role="tab"
          aria-selected={vista === valor}
          className={`${styles.viewToggleBtn} ${vista === valor ? styles.viewToggleBtnActive : ''}`}
          onClick={() => onChange(valor)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AgendaView({ dados, onEditar, onTogglePago }) {
  const diasComItens = dados.dias.filter((d) => d.itens.length > 0);
  const vazio = diasComItens.length === 0 && dados.semData.length === 0;
  return (
    <div className={styles.agendaView}>
      {vazio ? (
        <div className={styles.dayListVazio}>Nenhum lançamento neste mês.</div>
      ) : (
        <>
          {diasComItens.map((dia) => (
            <DayList
              key={dia.data}
              dia={dia}
              hoje={dados.hoje}
              moeda={dados.moeda}
              onEditar={onEditar}
              onTogglePago={onTogglePago}
              comIcone
            />
          ))}
          {dados.semData.length > 0 && (
            <SemData itens={dados.semData} moeda={dados.moeda} onEditar={onEditar} onTogglePago={onTogglePago} />
          )}
        </>
      )}
    </div>
  );
}

function Legend({ categorias }) {
  return (
    <div className={styles.legend}>
      {categorias.map((c) => (
        <div key={c.nome} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: c.cor }} />
          <span>{c.nome}</span>
        </div>
      ))}
      <div className={styles.legendItem}>
        <span style={{ color: 'var(--ink-subtle)' }}>✓</span>
        <span>pago</span>
      </div>
      <div className={styles.legendItem}>
        <span style={{ color: 'var(--status-atrasado)' }}>!</span>
        <span>atrasado</span>
      </div>
    </div>
  );
}

function SemData({ itens, moeda, onEditar, onTogglePago }) {
  return (
    <div className={styles.semDataBox}>
      <div className={styles.semDataTitle}>Sem data definida ({itens.length})</div>
      {itens.map((item) => (
        <div
          key={item.linhaPlanilha}
          className={`${styles.semDataRow} ${styles.itemClickable}`}
          onClick={() => onEditar(item)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              onEditar(item);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
          <div className={styles.itemBody} style={{ flex: 1 }}>
            <div className={styles.itemName}>{nomeComParcela(item)}</div>
            <div className={styles.semDataMeta}>{item.diaTexto}</div>
          </div>
          <button
            className={`${styles.btnGhost} ${styles.btnCompact}`}
            onClick={(ev) => {
              ev.stopPropagation();
              onTogglePago(item);
            }}
          >
            {item.statusPagamento === 'pago' ? 'Pago' : 'Marcar pago'}
          </button>
          <span className={styles.semDataAmount}>{formatarMoeda(item.valor, moeda)}</span>
        </div>
      ))}
    </div>
  );
}

const FREQUENCIAS_RENDA = ['Mensal', 'Semanal', 'Única'];
const FREQUENCIAS_RESERVA = ['Mensal', 'Única'];
const DIAS_SEMANA_OPCOES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function semAcentoLocal(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/-?feira/g, '').trim();
}

function frequenciaExibicao(frequenciaNormalizada) {
  if (frequenciaNormalizada === 'semanal') return 'Semanal';
  if (frequenciaNormalizada === 'unica') return 'Única';
  return 'Mensal';
}

function diaSemanaInicial(valorBruto) {
  const chave = semAcentoLocal(valorBruto);
  return DIAS_SEMANA_OPCOES.find((d) => semAcentoLocal(d) === chave) || DIAS_SEMANA_OPCOES[5];
}

function diaMesInicial(item, tipo) {
  if (!item) return '';
  if (tipo === 'renda') return item.diaRecebimento != null ? String(item.diaRecebimento) : '';
  return item.data ? String(Number(item.data.slice(-2))) : '';
}

function normalizarNome(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function PaymentPanel({ mes, erro, nomesCusto = [], categoriasCusto, modo, tipoInicial, item, onSalvar, onExcluir, onCancelar }) {
  const [tipo, setTipo] = useState(item ? item.tipo : tipoInicial);
  const [descricao, setDescricao] = useState(item?.nome || '');
  const [valor, setValor] = useState(item ? String(item.valor) : '');
  const [categoria, setCategoria] = useState(item?.categoria?.nome || categoriasCusto[0]?.nome || '');
  const [frequencia, setFrequencia] = useState(item?.frequencia ? frequenciaExibicao(item.frequencia) : 'Mensal');
  const [diaMes, setDiaMes] = useState(diaMesInicial(item, item ? item.tipo : tipoInicial));
  const [diaSemana, setDiaSemana] = useState(item?.tipo === 'renda' ? diaSemanaInicial(item.diaRecebimento) : DIAS_SEMANA_OPCOES[5]);
  const [repetirTodoMes, setRepetirTodoMes] = useState(item ? !!item.repete : true);
  const [statusPago, setStatusPago] = useState(item?.statusPagamento === 'pago');
  const [parcelado, setParcelado] = useState(!!item?.parcela);
  const [parcelas, setParcelas] = useState(item?.parcela ? String(item.parcela.total) : '');
  const [parcelaAtual, setParcelaAtual] = useState(item?.parcela ? String(item.parcela.atual) : '1');
  const [statusGuardado, setStatusGuardado] = useState(item?.statusReserva === 'guardado');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmDuplicado, setConfirmDuplicado] = useState(false);

  const ehRenda = tipo === 'renda';
  const ehReserva = tipo === 'reserva';
  const ehSemanal = ehRenda && frequencia === 'Semanal';
  const comParcelas = !ehRenda && !ehReserva && parcelado;
  const parcelasValidas =
    !comParcelas ||
    (Number.isInteger(Number(parcelas)) && Number(parcelas) >= 2 && Number(parcelas) <= 120 &&
      Number.isInteger(Number(parcelaAtual)) && Number(parcelaAtual) >= 1 && Number(parcelaAtual) <= Number(parcelas));
  const valido = descricao.trim() && Number(valor) > 0 && (ehSemanal ? !!diaSemana : Number(diaMes) >= 1 && Number(diaMes) <= 31) && parcelasValidas;

  const montarForm = ({ incluirParcelas = true } = {}) => {
    if (ehRenda) {
      return {
        fonte: descricao,
        valor: Number(valor),
        frequencia,
        diaRecebimento: ehSemanal ? diaSemana : Number(diaMes),
        repetirTodoMes,
      };
    }
    if (ehReserva) {
      return {
        nome: descricao,
        valor: Number(valor),
        frequencia,
        dia: Number(diaMes),
        repetirTodoMes,
      };
    }
    return {
      nome: descricao,
      valor: Number(valor),
      categoria,
      dia: Number(diaMes),
      repetirTodoMes,
      ...(comParcelas && incluirParcelas && { parcelas: Number(parcelas), parcelaAtual: Number(parcelaAtual) }),
    };
  };

  const executarSalvar = async () => {
    setSalvando(true);
    let statusExtra = null;
    if (modo === 'editar' && tipo === 'custo' && statusPago !== (item.statusPagamento === 'pago')) {
      statusExtra = statusPago ? 'Pago' : 'Pendente';
    } else if (modo === 'editar' && tipo === 'reserva' && statusGuardado !== (item.statusReserva === 'guardado')) {
      statusExtra = statusGuardado ? 'Guardado' : 'Pendente';
    }
    try {
      await onSalvar(tipo, montarForm(), statusExtra);
    } finally {
      setSalvando(false);
    }
  };

  const salvar = () => {
    if (tipo === 'custo') {
      const alvo = normalizarNome(descricao);
      const renomeou = modo === 'editar' && alvo !== normalizarNome(item?.nome);
      if ((modo === 'criar' || renomeou) && nomesCusto.some((n) => normalizarNome(n) === alvo)) {
        setConfirmDuplicado(true);
        return;
      }
    }
    executarSalvar();
  };

  const confirmarDuplicado = () => {
    setConfirmDuplicado(false);
    executarSalvar();
  };

  const excluir = async () => {
    setExcluindo(true);
    try {
      await onExcluir(tipo, montarForm({ incluirParcelas: false }));
    } finally {
      setExcluindo(false);
    }
  };

  const substantivo = ehRenda ? 'renda' : ehReserva ? 'reserva' : 'pagamento';
  const titulo = modo === 'criar'
    ? (ehRenda ? 'Nova renda' : ehReserva ? 'Nova reserva' : 'Novo pagamento')
    : `Editar ${substantivo}`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onCancelar}
    >
      <div
        className={`${styles.panel} ${styles.modalPanel}`}
        style={{
          width: 440,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
      {modo !== 'criar' && <div className={styles.panelTitle}>{titulo}</div>}
      <div className={styles.panelSubtitle}>{tituloMes(mes)}</div>

      {modo === 'criar' && (
        <div className={styles.segmented} role="tablist" aria-label="Tipo de lançamento">
          <span
            className={styles.segmentedThumb}
            style={{ transform: `translateX(${['custo', 'renda', 'reserva'].indexOf(tipo) * 100}%)` }}
            aria-hidden="true"
          />
          {[['custo', 'Custo'], ['renda', 'Renda'], ['reserva', 'Reserva']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              role="tab"
              aria-selected={tipo === val}
              className={`${styles.segmentedBtn} ${tipo === val ? styles.segmentedBtnActive : ''}`}
              onClick={() => {
                setTipo(val);
                setFrequencia('Mensal');
                setRepetirTodoMes(true);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <label className={styles.fieldLabel}>{ehRenda ? 'Fonte' : 'Descrição'}</label>
      <input
        className={styles.fieldInput}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder={ehRenda ? 'Salário' : ehReserva ? 'Reserva de emergência' : 'Assinatura de streaming'}
      />

      <div className={styles.fieldRow}>
        <div style={{ flex: 1.3 }}>
          <label className={styles.fieldLabel}>{comParcelas ? 'Valor da parcela' : 'Valor'}</label>
          <input
            className={styles.fieldInput}
            style={{ marginBottom: 0 }}
            type="number"
            min="0"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="15,00"
          />
        </div>
        <div style={{ flex: 1 }}>
          {ehSemanal ? (
            <>
              <label className={styles.fieldLabel}>Dia da semana</label>
              <select
                className={styles.fieldInput}
                style={{ marginBottom: 0 }}
                value={diaSemana}
                onChange={(e) => setDiaSemana(e.target.value)}
              >
                {DIAS_SEMANA_OPCOES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className={styles.fieldLabel}>Dia</label>
              <input
                className={styles.fieldInput}
                style={{ marginBottom: 0 }}
                type="number"
                min="1"
                max="31"
                value={diaMes}
                onChange={(e) => setDiaMes(e.target.value)}
                placeholder="23"
              />
            </>
          )}
        </div>
      </div>

      {modo === 'criar' && !ehRenda && !ehReserva && (
        <label className={styles.checkRow}>
          <input type="checkbox" checked={parcelado} onChange={(e) => setParcelado(e.target.checked)} />
          <span className={styles.switchLabel}>Parcelado</span>
        </label>
      )}

      {comParcelas && (
        <div className={styles.fieldRow}>
          <div style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Parcelas</label>
            <input
              className={styles.fieldInput}
              style={{ marginBottom: 0 }}
              type="number"
              min="2"
              max="120"
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              placeholder="10"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Parcela atual</label>
            <input
              className={styles.fieldInput}
              style={{ marginBottom: 0 }}
              type="number"
              min="1"
              max={parcelas || undefined}
              value={parcelaAtual}
              onChange={(e) => setParcelaAtual(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>
      )}

      {ehRenda || ehReserva ? (
        <>
          <label className={styles.fieldLabel}>Frequência</label>
          <div className={styles.chipsRow}>
            {(ehReserva ? FREQUENCIAS_RESERVA : FREQUENCIAS_RENDA).map((f) => (
              <button
                key={f}
                type="button"
                className={`${styles.chip} ${frequencia === f ? styles.chipActive : ''}`}
                onClick={() => {
                  setFrequencia(f);
                  setRepetirTodoMes(f !== 'Única');
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className={styles.fieldLabel}>Categoria</label>
          <div className={styles.chipsRow}>
            {categoriasCusto.map((c) => (
              <button
                key={c.nome}
                type="button"
                className={`${styles.chip} ${categoria === c.nome ? styles.chipActive : ''}`}
                onClick={() => setCategoria(c.nome)}
              >
                <span className={styles.chipDot} style={{ background: c.cor }} />
                {c.icone} {c.nome}
              </button>
            ))}
          </div>
        </>
      )}

      {modo === 'editar' && !ehRenda && !ehReserva && (
        <>
          <label className={styles.fieldLabel}>Status</label>
          <div className={styles.statusToggle}>
            <button
              type="button"
              className={`${styles.statusOption} ${!statusPago ? styles.statusOptionActive : ''}`}
              onClick={() => setStatusPago(false)}
            >
              Não pago
            </button>
            <button
              type="button"
              className={`${styles.statusOption} ${statusPago ? styles.statusOptionActive : ''}`}
              onClick={() => setStatusPago(true)}
            >
              Pago
            </button>
          </div>
        </>
      )}

      {modo === 'editar' && ehReserva && (
        <>
          <label className={styles.fieldLabel}>Status</label>
          <div className={styles.statusToggle}>
            <button
              type="button"
              className={`${styles.statusOption} ${!statusGuardado ? styles.statusOptionActive : ''}`}
              onClick={() => setStatusGuardado(false)}
            >
              Não guardado
            </button>
            <button
              type="button"
              className={`${styles.statusOption} ${statusGuardado ? styles.statusOptionActive : ''}`}
              onClick={() => setStatusGuardado(true)}
            >
              Guardado
            </button>
          </div>
        </>
      )}

      {!comParcelas && (
        <div className={styles.switchRow}>
          <button
            type="button"
            className={`${styles.switchTrack} ${repetirTodoMes ? styles.switchTrackOn : ''}`}
            onClick={() => setRepetirTodoMes((v) => !v)}
            aria-pressed={repetirTodoMes}
          >
            <span className={styles.switchThumb} />
          </button>
          <span className={styles.switchLabel}>Repetir todo mês</span>
        </div>
      )}

      {erro && <div className={styles.errorText}>{erro}</div>}

      <div className={styles.panelActions}>
        <button className={styles.btnPrimary} disabled={!valido || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button className={styles.btnGhost} onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      {modo === 'editar' && (
        <button
          type="button"
          className={styles.btnGhost}
          style={{ marginTop: 'var(--space-2)', color: 'var(--status-atrasado)', borderColor: 'var(--status-atrasado)' }}
          disabled={excluindo}
          onClick={excluir}
        >
          {excluindo ? 'Excluindo…' : 'Excluir'}
        </button>
      )}

      {confirmDuplicado && (
        <ConfirmModal
          titulo="Nome duplicado"
          mensagem="Já existe um custo com esse nome. Continuar?"
          confirmarLabel="Continuar"
          onConfirmar={confirmarDuplicado}
          onCancelar={() => setConfirmDuplicado(false)}
        />
      )}
      </div>
    </div>
  );
}

function LoginModal({ email, onEmailChange, mensagem, onEnviar, onFechar }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onFechar}
    >
      <div
        className={`${styles.panel} ${styles.modalPanel}`}
        style={{ width: 340, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.panelTitle}>Confirme seu e-mail</div>
        <div className={styles.panelSubtitle}>Editar pagamentos exige verificação por e-mail.</div>
        <form className={styles.loginForm} onSubmit={onEnviar}>
          <input
            className={styles.fieldInput}
            style={{ marginBottom: 0 }}
            type="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <button className={styles.btnPrimary} style={{ flex: 'none', padding: 'var(--space-3) var(--space-4)' }} type="submit">
            Enviar
          </button>
        </form>
        {mensagem && <div className={styles.okText}>{mensagem}</div>}
        <button className={styles.btnGhost} style={{ marginTop: 16 }} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ titulo, mensagem, confirmarLabel = 'Confirmar', cancelarLabel = 'Cancelar', onConfirmar, onCancelar }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onCancelar}
    >
      <div
        className={`${styles.panel} ${styles.modalPanel}`}
        style={{ width: 320, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.panelTitle}>{titulo}</div>
        <div className={styles.panelSubtitle}>{mensagem}</div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className={styles.btnGhost} style={{ flex: 1 }} onClick={onCancelar}>
            {cancelarLabel}
          </button>
          <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={onConfirmar}>
            {confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcaoPagamentoModal({ item, onPagar, onEditar, onCancelar }) {
  const ehReserva = item.tipo === 'reserva';
  const pagarLabel = ehReserva ? 'Guardado' : 'Pago';
  const [confirmando, setConfirmando] = useState(false);

  // Feedback: botão pisca verde e só então a ação (pagar/guardar) + fecha a tela.
  const confirmarPagar = () => {
    if (confirmando) return;
    setConfirmando(true);
    setTimeout(() => onPagar(), 550);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={confirmando ? undefined : onCancelar}
    >
      <div
        className={`${styles.panel} ${styles.modalPanel}`}
        style={{ width: 320, maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="O que fazer com o lançamento"
      >
        <div className={styles.panelTitle} style={{ marginBottom: 'var(--space-5)' }}>{nomeComParcela(item)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            className={styles.btnPrimary}
            style={confirmando
              ? { background: 'var(--status-receita)', color: 'var(--surface)', transition: 'background 0.15s ease', textTransform: 'uppercase', fontWeight: 700 }
              : { transition: 'background 0.15s ease', textTransform: 'uppercase', fontWeight: 700 }}
            onClick={confirmarPagar}
            disabled={confirmando}
          >
            {confirmando ? `✓ ${pagarLabel}` : pagarLabel}
          </button>
          <button className={styles.btnGhost} style={{ borderColor: 'var(--ink-subtle)', textTransform: 'uppercase', fontWeight: 700 }} onClick={onEditar} disabled={confirmando}>
            Editar
          </button>
          <button className={styles.btnGhost} style={{ textTransform: 'uppercase', fontWeight: 700 }} onClick={onCancelar} disabled={confirmando}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
