import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleCheck, Clock, TriangleAlert, TrendingUp, PiggyBank, Wallet, Check,
  Coins, House, Clapperboard, HeartPulse, Wrench, ShoppingBag, Dumbbell, Tag,
  Briefcase, Landmark, PawPrint, GraduationCap, ChevronDown, ChevronLeft, ChevronRight,
  CalendarDays, CalendarClock, Repeat, CreditCard, Layers, Hash,
} from 'lucide-react';
import '@google/model-viewer';
import styles from './CalendarioPage.module.css';
import boomerBMark from '../../assets/imgs/boomer-b-mark.png';
import boomerLogo3D from '../../assets/3d/Logo Boomer - metal.glb';
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
  excluirCusto,
  excluirRenda,
  excluirReserva,
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
  entretenimento: Clapperboard,
  saude: HeartPulse,
  software: Wrench,
  compras: ShoppingBag,
  esportes: Dumbbell,
  servico: Briefcase,
  imposto: Landmark,
  pet: PawPrint,
  educacao: GraduationCap,
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
    // Metal de verdade (reflete o ambiente tingido pela cor base = prateado),
    // em vez do fosco não-metálico calibrado pro logo antigo (que achatava
    // esse material num plástico branco).
    const metalico = () => {
      (el.model?.materials || []).forEach((m) => {
        m.pbrMetallicRoughness.setRoughnessFactor(0.4);
        m.pbrMetallicRoughness.setMetallicFactor(0.9);
      });
    };
    el.addEventListener('load', metalico);
    return () => el.removeEventListener('load', metalico);
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
        await atualizarReserva(item.linhaPlanilha, novoStatus, mes, item.id);
      } else {
        const novoStatus = item.statusPagamento === 'pago' ? 'Pendente' : 'Pago';
        await atualizarPagamento(item.linhaPlanilha, novoStatus, mes, item.id);
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
    let aviso = null;
    try {
      if (painelItem.modo === 'criar') {
        let resposta;
        if (tipo === 'custo') resposta = await criarLancamento({ ...form, mes });
        else if (tipo === 'reserva') resposta = await criarReserva({ ...form, mes });
        else resposta = await criarRenda({ ...form, mes });
        // Criou, mas não conseguiu marcar como pago/guardado: avisa depois de fechar.
        aviso = resposta?.aviso || null;
      } else {
        const { linhaPlanilha, id } = painelItem.item;
        if (tipo === 'custo') {
          await editarCusto({ ...form, linhaPlanilha, id, mes });
          if (statusPagamento) await atualizarPagamento(linhaPlanilha, statusPagamento, mes, id);
        } else if (tipo === 'reserva') {
          await editarReserva({ ...form, linhaPlanilha, id, mes });
          if (statusPagamento) await atualizarReserva(linhaPlanilha, statusPagamento, mes, id);
        } else {
          await editarRenda({ ...form, linhaPlanilha, id, mes });
        }
      }
      fecharPainel();
      if (aviso) setErroAcao(aviso);
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  const excluirPainel = (tipo, form) => {
    setConfirmExcluir({ tipo, form });
  };

  const confirmarExclusao = async () => {
    const { tipo } = confirmExcluir;
    setConfirmExcluir(null);
    setErroAcao(null);
    try {
      const { linhaPlanilha, id } = painelItem.item;
      if (tipo === 'custo') await excluirCusto(linhaPlanilha, id);
      else if (tipo === 'reserva') await excluirReserva(linhaPlanilha, id);
      else await excluirRenda(linhaPlanilha, id);
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
          {vista === 'mes' && dados.semData.length > 0 && (
            <SemData itens={dados.semData} moeda={dados.moeda} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          )}
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
          {vista === 'mes' && <Legend categorias={dados.categorias} />}
          {erroAcao && !painelItem && <div className={styles.errorText}>{erroAcao}</div>}
        </main>

        {painelItem && (
          <PaymentPanel
            key={`${painelItem.modo}-${painelItem.tipo}-${painelItem.item?.linhaPlanilha ?? 'novo'}`}
            mes={mes}
            erro={erroAcao}
            nomesCusto={dados.nomesCusto || []}
            categoriasCusto={dados.categorias.filter((c) => c.nome !== 'Recebimento' && c.nome !== 'Reserva')}
            moeda={dados.moeda}
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
  // No mobile o botão é só "+" e, assim que a página rola um pouco, vira um botão
  // flutuante (fixo no canto). O `slot` fica no fluxo e guarda o espaço do botão,
  // então nada pula na troca.
  const [flutuante, setFlutuante] = useState(false);
  useEffect(() => {
    const aoRolar = () => setFlutuante(window.scrollY > 24);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

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
        <span className={styles.addSlot}>
          <button
            className={`${styles.addButton} ${flutuante ? styles.addButtonFlutuante : ''}`}
            onClick={onAdicionar}
            aria-label="Adicionar"
          >
            <span aria-hidden="true">+</span>
            <span className={styles.addLabel} aria-hidden="true">
              {' '}Adicionar
            </span>
          </button>
        </span>
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

  const titulo = nomeComParcela(item);

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
          aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} ${item.tipo === 'reserva' ? 'reservado' : 'pago'}: ${item.nome}`}
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
          aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} ${item.tipo === 'reserva' ? 'reservado' : 'pago'}: ${item.nome}`}
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
      {dados.semData.length > 0 && (
        <SemData itens={dados.semData} moeda={dados.moeda} onEditar={onEditar} onTogglePago={onTogglePago} />
      )}
      {vazio ? (
        <div className={styles.dayListVazio}>Nenhum lançamento neste mês.</div>
      ) : (
        diasComItens.map((dia) => (
          <DayList
            key={dia.data}
            dia={dia}
            hoje={dados.hoje}
            moeda={dados.moeda}
            onEditar={onEditar}
            onTogglePago={onTogglePago}
            comIcone
          />
        ))
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
      <div className={styles.semDataTitle}>
        <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
        Sem data definida ({itens.length})
      </div>
      {itens.map((item) => {
        const concluido = itemConcluido(item);
        const alternavel = item.tipo === 'custo' || item.tipo === 'reserva';
        return (
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
              <div className={`${styles.itemName} ${concluido ? styles.itemNamePago : ''}`}>{nomeComParcela(item)}</div>
              <div className={styles.semDataMeta}>{item.diaTexto}</div>
            </div>
            <span className={styles.semDataAmount}>{formatarMoeda(item.valor, moeda)}</span>
            {alternavel && (
              <button
                type="button"
                className={`${styles.agendaCheck} ${styles.semDataCheck} ${item.tipo === 'reserva' ? styles.agendaCheckReserva : ''} ${concluido ? styles.agendaCheckOn : ''}`}
                onClick={(ev) => { ev.stopPropagation(); onTogglePago(item); }}
                aria-pressed={concluido}
                aria-label={`${concluido ? 'Desmarcar' : 'Marcar'} ${item.tipo === 'reserva' ? 'reservado' : 'pago'}: ${item.nome}`}
              >
                <Check size={10} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FREQUENCIAS_RENDA = ['Mensal', 'Semanal', 'Única'];
const FREQUENCIAS_RESERVA = ['Mensal', 'Única'];
const OPCOES_TIPO = [
  { valor: 'custo', label: 'Custo' },
  { valor: 'renda', label: 'Renda' },
  { valor: 'reserva', label: 'Reserva' },
];
const OPCOES_STATUS_CUSTO = [
  { valor: 'nao', label: 'Não pago' },
  { valor: 'sim', label: 'Pago' },
];
const OPCOES_STATUS_RESERVA = [
  { valor: 'nao', label: 'Não reservado' },
  { valor: 'sim', label: 'Reservado' },
];

// Interruptor em linha do grupo (Parcelado, Repetir todo mês): ícone + rótulo à
// esquerda, trilho à direita. Mantém um <input type="checkbox" role="switch">
// escondido, então teclado e leitor de tela seguem funcionando; o trilho
// desenhado reflete o estado via CSS. A linha inteira é clicável.
function Interruptor({ marcado, onChange, icone: Icone, children }) {
  return (
    <label className={`${styles.linha} ${styles.linhaToggle}`}>
      <input
        type="checkbox"
        role="switch"
        className={styles.switchInput}
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchThumb} />
      </span>
      <span className={styles.linhaRotulo}>
        <Icone size={18} strokeWidth={2} aria-hidden="true" />
        {children}
      </span>
    </label>
  );
}

// Seletor segmentado com a pílula deslizante (estilo "liquid glass"). `--n` ajusta
// a largura da pílula ao número de opções (hoje só o tipo: Custo/Renda/Reserva).
// Se o valor atual não estiver entre as opções, a pílula some em vez de marcar a
// primeira.
function Segmentado({ opcoes, valor, onChange, ariaLabel }) {
  const indice = opcoes.findIndex((o) => o.valor === valor);
  return (
    <div
      className={styles.segmented}
      role="tablist"
      aria-label={ariaLabel}
      style={{ '--n': opcoes.length }}
    >
      <span
        className={styles.segmentedThumb}
        style={{ transform: `translateX(${Math.max(indice, 0) * 100}%)`, opacity: indice < 0 ? 0 : 1 }}
        aria-hidden="true"
      />
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          className={`${styles.segmentedBtn} ${valor === o.valor ? styles.segmentedBtnActive : ''}`}
          onClick={() => onChange(o.valor)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
// Dropdown customizado (lista num portal pro document.body, pra não ser
// cortada pelo overflow-y:auto do modal). Visual próprio: pílula igual aos
// outros campos, lista com cantos arredondados e gap embaixo da pílula, item
// em foco/hover usa o mesmo creme (--interactive) do resto do app em vez do
// azul padrão do navegador.
// Topo de um popup `position: fixed` ancorado num gatilho (rect `r`): abaixo do
// gatilho; se não couber, acima; se também não couber (janela baixa), encosta na
// borda de baixo da janela em vez de ficar cortado.
function topoPopup(r, altura) {
  const margem = 8;
  const abaixo = r.bottom + 6;
  if (abaixo + altura <= window.innerHeight - margem) return abaixo;
  const acima = r.top - 6 - altura;
  if (acima >= margem) return acima;
  return Math.max(margem, window.innerHeight - altura - margem);
}

// `linha` ({ Icone, rotulo }): em vez da pílula, renderiza uma linha de grupo
// (ícone + rótulo à esquerda, valor + seta à direita) e a lista abre alinhada à direita.
function Dropdown({ opcoes, valor, onChange, ariaLabel, style, linha }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const gatilhoRef = useRef(null);
  const listaRef = useRef(null);
  const idBase = useId();

  const selecionada = opcoes.find((o) => o.valor === valor);

  const abrir = () => {
    const r = gatilhoRef.current.getBoundingClientRect();
    const largura = linha ? Math.min(r.width, 240) : r.width;
    const altura = Math.min(280, opcoes.length * 38 + 16);
    setPosicao({ top: topoPopup(r, altura), left: linha ? r.right - largura : r.left, width: largura });
    setIndiceAtivo(Math.max(opcoes.findIndex((o) => o.valor === valor), 0));
    setAberto(true);
  };

  const selecionar = (opcao) => {
    onChange(opcao);
    setAberto(false);
    gatilhoRef.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => {
      if (gatilhoRef.current?.contains(e.target) || listaRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    // Ignora o scroll interno da própria lista (ela rola — tem mais opções do
    // que cabem no max-height); só fecha quando quem rolou foi o fundo do modal.
    const fecharNoScroll = (e) => {
      if (listaRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    window.addEventListener('scroll', fecharNoScroll, true);
    window.addEventListener('resize', fecharNoScroll);
    return () => {
      document.removeEventListener('mousedown', fechar);
      window.removeEventListener('scroll', fecharNoScroll, true);
      window.removeEventListener('resize', fecharNoScroll);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    listaRef.current?.querySelector(`[data-indice="${indiceAtivo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aberto, indiceAtivo]);

  const aoTeclar = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!aberto) abrir();
      else setIndiceAtivo((i) => Math.min(i + 1, opcoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) abrir();
      else setIndiceAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (aberto) selecionar(opcoes[indiceAtivo].valor);
      else abrir();
    } else if (e.key === 'Escape' && aberto) {
      e.preventDefault();
      setAberto(false);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={gatilhoRef}
        className={linha ? `${styles.linha} ${styles.linhaGatilho}` : `${styles.fieldInput} ${styles.dropdownGatilho}`}
        style={style}
        role="combobox"
        aria-label={linha ? linha.rotulo : undefined}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${idBase}-listbox`}
        aria-activedescendant={aberto ? `${idBase}-${indiceAtivo}` : undefined}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={aoTeclar}
      >
        {linha && (
          <span className={styles.linhaRotulo}>
            <linha.Icone size={18} strokeWidth={2} aria-hidden="true" />
            {linha.rotulo}
          </span>
        )}
        <span className={linha ? styles.linhaValor : styles.dropdownValor}>{selecionada?.label ?? valor}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={`${styles.dropdownSeta} ${aberto ? styles.dropdownSetaAberta : ''}`}
          aria-hidden="true"
        />
      </button>
      {aberto && posicao && createPortal(
        <div
          ref={listaRef}
          id={`${idBase}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
          className={styles.dropdownLista}
          style={{ top: posicao.top, left: posicao.left, width: posicao.width }}
        >
          {opcoes.map((o, i) => (
            <button
              key={o.valor}
              type="button"
              id={`${idBase}-${i}`}
              data-indice={i}
              role="option"
              aria-selected={o.valor === valor}
              className={`${styles.dropdownOpcao} ${i === indiceAtivo ? styles.dropdownOpcaoAtiva : ''}`}
              onMouseEnter={() => setIndiceAtivo(i)}
              onClick={() => selecionar(o.valor)}
            >
              {o.label}
            </button>
          ))}
        </div>,
        // Precisa ficar dentro de .page: é lá que as custom properties de cor
        // (--surface-raised, --border etc.) são definidas. Um portal direto pro
        // document.body ficaria fora desse escopo e renderizaria sem cor nenhuma.
        document.querySelector(`.${styles.page}`) || document.body
      )}
    </>
  );
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Seletor de mês em formato de calendário: popup com navegação de ano e uma
// grade com os 12 meses (em vez de uma lista comprida pra rolar). `valor` é
// sempre "AAAA-MM".
// `linha`: mesmo formato de linha de grupo do Dropdown; o popup alinha à direita.
function SeletorMes({ valor, onChange, ariaLabel, style, linha }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const [anoExibido, setAnoExibido] = useState(() => Number(valor.slice(0, 4)));
  const gatilhoRef = useRef(null);
  const popupRef = useRef(null);

  const anoAtual = Number(mesAtual().slice(0, 4));
  const anoMin = anoAtual - 5;
  const anoMax = anoAtual + 10;
  const anoSelecionado = Number(valor.slice(0, 4));
  const mesSelecionado = Number(valor.slice(5, 7)) - 1;

  const abrir = () => {
    const r = gatilhoRef.current.getBoundingClientRect();
    setPosicao({ top: topoPopup(r, 232), left: linha ? r.right - 240 : r.left });
    setAnoExibido(anoSelecionado);
    setAberto(true);
  };

  const selecionar = (mesIndice) => {
    onChange(`${anoExibido}-${String(mesIndice + 1).padStart(2, '0')}`);
    setAberto(false);
    gatilhoRef.current?.focus();
  };

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => {
      if (gatilhoRef.current?.contains(e.target) || popupRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    const fecharNoScroll = (e) => {
      if (popupRef.current?.contains(e.target)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    window.addEventListener('scroll', fecharNoScroll, true);
    window.addEventListener('resize', fecharNoScroll);
    return () => {
      document.removeEventListener('mousedown', fechar);
      window.removeEventListener('scroll', fecharNoScroll, true);
      window.removeEventListener('resize', fecharNoScroll);
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        ref={gatilhoRef}
        className={linha ? `${styles.linha} ${styles.linhaGatilho}` : `${styles.fieldInput} ${styles.dropdownGatilho}`}
        style={style}
        aria-label={linha ? linha.rotulo : undefined}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        {linha && (
          <span className={styles.linhaRotulo}>
            <linha.Icone size={18} strokeWidth={2} aria-hidden="true" />
            {linha.rotulo}
          </span>
        )}
        <span className={linha ? styles.linhaValor : styles.dropdownValor}>{tituloMes(valor)}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.2}
          className={`${styles.dropdownSeta} ${aberto ? styles.dropdownSetaAberta : ''}`}
          aria-hidden="true"
        />
      </button>
      {aberto && posicao && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={ariaLabel}
          className={styles.mesPopup}
          style={{ top: posicao.top, left: posicao.left }}
        >
          <div className={styles.mesPopupHeader}>
            <button
              type="button"
              className={styles.mesPopupNav}
              disabled={anoExibido <= anoMin}
              onClick={() => setAnoExibido((a) => a - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
            <span className={styles.mesPopupAno}>{anoExibido}</span>
            <button
              type="button"
              className={styles.mesPopupNav}
              disabled={anoExibido >= anoMax}
              onClick={() => setAnoExibido((a) => a + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div className={styles.mesPopupGrid}>
            {MESES_ABREV.map((label, i) => {
              const ativo = anoExibido === anoSelecionado && i === mesSelecionado;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={ativo}
                  className={`${styles.mesPopupMes} ${ativo ? styles.mesPopupMesAtiva : ''}`}
                  onClick={() => selecionar(i)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>,
        document.querySelector(`.${styles.page}`) || document.body
      )}
    </>
  );
}

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

// Valor em destaque (centro, grande): símbolo + inteiro em tinta cheia, centavos
// em cinza e um cursor laranja. A digitação é por centavos (digita 1500 → 15,00),
// como em apps de banco; o <input> real fica transparente por cima e só recebe o
// foco/teclado (inputMode numérico).
const MAX_DIGITOS_VALOR = 9;

function partesDoValor(centavos, moeda) {
  const valor = centavos / 100;
  try {
    const partes = new Intl.NumberFormat(localeDaMoeda(moeda), { style: 'currency', currency: moeda || 'BRL' }).formatToParts(valor);
    let simbolo = '';
    let inteiro = '';
    let decimal = '';
    for (const p of partes) {
      if (p.type === 'currency') simbolo = p.value;
      else if (p.type === 'integer' || p.type === 'group') inteiro += p.value;
      else if (p.type === 'decimal' || p.type === 'fraction') decimal += p.value;
    }
    return { simbolo, inteiro, decimal };
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    const [i, d] = valor.toFixed(2).split('.');
    return { simbolo: moeda || 'BRL', inteiro: i, decimal: `,${d}` };
  }
}

function CampoValor({ rotulo, valor, onChange, moeda }) {
  const [focado, setFocado] = useState(false);
  const centavos = Math.round((Number(valor) || 0) * 100);
  const { simbolo, inteiro, decimal } = partesDoValor(centavos, moeda);

  const aoDigitar = (e) => {
    const digitos = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITOS_VALOR);
    const c = digitos ? parseInt(digitos, 10) : 0;
    onChange(c ? (c / 100).toFixed(2) : '');
  };

  return (
    <label className={styles.valorCampo}>
      <span className={styles.valorRotulo}>{rotulo}</span>
      <span className={`${styles.valorDisplay} ${centavos === 0 ? styles.valorVazio : ''}`} aria-hidden="true">
        <span className={styles.valorSimbolo}>{simbolo}</span>
        <span>{inteiro}</span>
        <span className={styles.valorCentavos}>{decimal}</span>
        {focado && <span className={styles.valorCursor} />}
      </span>
      <input
        className={styles.valorInput}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={rotulo}
        value={centavos ? String(centavos) : ''}
        onChange={aoDigitar}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
      />
    </label>
  );
}

function PaymentPanel({ mes, erro, nomesCusto = [], categoriasCusto, moeda, modo, tipoInicial, item, onSalvar, onExcluir, onCancelar }) {
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
  const [inicio, setInicio] = useState(() => (item?.dataInicio ? item.dataInicio.slice(0, 7) : mes));
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmDuplicado, setConfirmDuplicado] = useState(false);

  const ehRenda = tipo === 'renda';
  const ehReserva = tipo === 'reserva';
  const ehCusto = !ehRenda && !ehReserva;
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
        dataInicio: inicio,
      };
    }
    if (ehReserva) {
      return {
        nome: descricao,
        valor: Number(valor),
        frequencia,
        dia: Number(diaMes),
        repetirTodoMes,
        dataInicio: inicio,
      };
    }
    return {
      nome: descricao,
      valor: Number(valor),
      categoria,
      dia: Number(diaMes),
      repetirTodoMes,
      dataInicio: inicio,
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
    // Criar já pago/guardado: o status vai junto com o lançamento (o servidor marca).
    let statusNaCriacao = {};
    if (modo === 'criar' && tipo === 'custo' && statusPago) statusNaCriacao = { statusPagamento: 'Pago' };
    else if (modo === 'criar' && tipo === 'reserva' && statusGuardado) statusNaCriacao = { statusReserva: 'Guardado' };
    try {
      await onSalvar(tipo, { ...montarForm(), ...statusNaCriacao }, statusExtra);
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

  // Mobile (folha de baixo): arrastar a alça pra baixo fecha, como no iOS. O painel
  // acompanha o dedo; soltando longe o bastante ele desce e fecha, senão volta.
  const painelRef = useRef(null);
  const arrasto = useRef(null);
  const ARRASTO_PARA_FECHAR = 100;

  const comecarArrasto = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    arrasto.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    painelRef.current.style.transition = 'none';
  };
  const arrastar = (e) => {
    const a = arrasto.current;
    if (!a) return;
    a.dy = Math.max(0, e.clientY - a.y);
    painelRef.current.style.transform = `translateY(${a.dy}px)`;
  };
  const soltarArrasto = () => {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    const el = painelRef.current;
    el.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
    if (a.dy > ARRASTO_PARA_FECHAR) {
      el.style.transform = 'translateY(100%)';
      setTimeout(onCancelar, 220);
    } else {
      el.style.transform = '';
      setTimeout(() => {
        if (painelRef.current) painelRef.current.style.transition = '';
      }, 260);
    }
  };

  return (
    <div className={styles.paymentOverlay} onClick={onCancelar}>
      <div
        ref={painelRef}
        className={`${styles.panel} ${styles.modalPanel} ${styles.paymentPanel}`}
        onClick={(e) => e.stopPropagation()}
      >
      {/* Mobile: alça + Cancelar | título | Salvar no topo (fixo ao rolar); os botões
          de baixo somem. No desktop esta barra fica oculta. */}
      <div className={styles.sheetTopo}>
        <div
          className={styles.sheetAlca}
          onPointerDown={comecarArrasto}
          onPointerMove={arrastar}
          onPointerUp={soltarArrasto}
          onPointerCancel={soltarArrasto}
          aria-hidden="true"
        />
        <div className={styles.sheetHeader}>
          <button type="button" className={styles.sheetCancelar} onClick={onCancelar}>
            Cancelar
          </button>
          <span className={styles.sheetTitulo}>{titulo}</span>
          <button type="button" className={styles.sheetSalvar} disabled={!valido || salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
      {modo !== 'criar' && <div className={`${styles.panelTitle} ${styles.tituloDesktop}`}>{titulo}</div>}

      {modo === 'criar' && (
        <Segmentado
          ariaLabel="Tipo de lançamento"
          opcoes={OPCOES_TIPO}
          valor={tipo}
          onChange={(val) => {
            setTipo(val);
            setFrequencia('Mensal');
            setRepetirTodoMes(true);
            setStatusPago(false);
            setStatusGuardado(false);
          }}
        />
      )}

      <CampoValor rotulo={comParcelas ? 'Valor da parcela' : 'Valor'} valor={valor} onChange={setValor} moeda={moeda} />
      {erro && <div className={`${styles.errorText} ${styles.erroTopo}`}>{erro}</div>}

      <label className={styles.fieldLabel}>{ehRenda ? 'Fonte' : 'Descrição'}</label>
      <input
        className={styles.fieldInput}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder={ehRenda ? 'Salário' : ehReserva ? 'Reserva de emergência' : 'Assinatura de streaming'}
      />

      {/* Mesma estrutura nos três tipos: um cartão de linhas (rótulo com ícone à
          esquerda, valor/controle à direita). A 1ª linha é Categoria (custo) ou
          Frequência (renda/reserva); o resto é igual. */}
      <div className={styles.grupo}>
        {ehCusto && modo === 'criar' && (
          <Interruptor icone={CreditCard} marcado={parcelado} onChange={setParcelado}>
            Parcelado
          </Interruptor>
        )}
        {comParcelas && (
          <>
            <label className={styles.linha}>
              <span className={styles.linhaRotulo}>
                <Layers size={18} strokeWidth={2} aria-hidden="true" />
                Parcelas
              </span>
              <input
                className={styles.linhaInput}
                type="number"
                min="2"
                max="120"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                placeholder="10"
              />
            </label>
            <label className={styles.linha}>
              <span className={styles.linhaRotulo}>
                <Hash size={18} strokeWidth={2} aria-hidden="true" />
                Parcela atual
              </span>
              <input
                className={styles.linhaInput}
                type="number"
                min="1"
                max={parcelas || undefined}
                value={parcelaAtual}
                onChange={(e) => setParcelaAtual(e.target.value)}
                placeholder="1"
              />
            </label>
          </>
        )}
        {ehCusto ? (
          <Dropdown
            linha={{ Icone: Tag, rotulo: 'Categoria' }}
            ariaLabel="Categoria"
            opcoes={categoriasCusto.map((c) => ({ valor: c.nome, label: c.nome }))}
            valor={categoria}
            onChange={setCategoria}
          />
        ) : (
          <Dropdown
            linha={{ Icone: Clock, rotulo: 'Frequência' }}
            ariaLabel="Frequência"
            opcoes={(ehReserva ? FREQUENCIAS_RESERVA : FREQUENCIAS_RENDA).map((f) => ({ valor: f, label: f }))}
            valor={frequencia}
            onChange={(f) => {
              setFrequencia(f);
              setRepetirTodoMes(f !== 'Única');
            }}
          />
        )}
        {ehSemanal ? (
          <Dropdown
            linha={{ Icone: CalendarDays, rotulo: 'Dia da semana' }}
            ariaLabel="Dia da semana"
            opcoes={DIAS_SEMANA_OPCOES.map((d) => ({ valor: d, label: d }))}
            valor={diaSemana}
            onChange={setDiaSemana}
          />
        ) : (
          <label className={styles.linha}>
            <span className={styles.linhaRotulo}>
              <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
              Dia do mês
            </span>
            <input
              className={styles.linhaInput}
              type="number"
              min="1"
              max="31"
              value={diaMes}
              onChange={(e) => setDiaMes(e.target.value)}
              placeholder="23"
            />
          </label>
        )}
        {!comParcelas && (
          <SeletorMes
            linha={{ Icone: CalendarClock, rotulo: 'Começa em' }}
            ariaLabel="Começa em"
            valor={inicio}
            onChange={setInicio}
          />
        )}
        {!comParcelas && (
          <Interruptor icone={Repeat} marcado={repetirTodoMes} onChange={setRepetirTodoMes}>
            Repetir todo mês
          </Interruptor>
        )}
      </div>

      {(ehCusto || ehReserva) && (
        <>
          <label className={styles.fieldLabel}>Status</label>
          {ehCusto ? (
            <Segmentado
              ariaLabel="Status do pagamento"
              opcoes={OPCOES_STATUS_CUSTO}
              valor={statusPago ? 'sim' : 'nao'}
              onChange={(v) => setStatusPago(v === 'sim')}
            />
          ) : (
            <Segmentado
              ariaLabel="Status da reserva"
              opcoes={OPCOES_STATUS_RESERVA}
              valor={statusGuardado ? 'sim' : 'nao'}
              onChange={(v) => setStatusGuardado(v === 'sim')}
            />
          )}
        </>
      )}

      {erro && <div className={`${styles.errorText} ${styles.erroBase}`}>{erro}</div>}

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
  const pagarLabel = ehReserva ? 'Reservado' : 'Pago';
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
