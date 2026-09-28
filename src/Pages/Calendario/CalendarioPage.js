import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './CalendarioPage.module.css';
import boomerBMark from '../../assets/imgs/boomer-b-mark.png';
import {
  obterMes,
  verificarAcesso,
  pedirAcesso,
  atualizarPagamento,
  criarLancamento,
  editarCusto,
  criarRenda,
  editarRenda,
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

function formatarMoeda(valor, moeda) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL' }).format(valor);
  } catch {
    return `${moeda || 'BRL'} ${valor.toFixed(2)}`;
  }
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

  const carregarMes = useCallback(async (mesAlvo, token) => {
    setCarregando(true);
    setErroFatal(null);
    try {
      const resposta = await obterMes(mesAlvo, token);
      setDados(resposta);
      setMes(mesAlvo);
    } catch (e) {
      setErroFatal(e.message);
    } finally {
      setCarregando(false);
    }
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
    const novoStatus = item.statusPagamento === 'pago' ? 'Pendente' : 'Pago';
    try {
      await atualizarPagamento(item.linhaPlanilha, novoStatus);
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  const abrirPainelCriar = () => {
    if (dados && !dados.autenticado) return exigirLogin();
    setPainelItem({ modo: 'criar', tipo: 'custo' });
  };

  const abrirPainelEditar = (item) => {
    if (!dados.autenticado) return exigirLogin();
    setPainelItem({ modo: 'editar', tipo: item.tipo, item });
  };

  const fecharPainel = () => setPainelItem(null);

  const salvarPainel = async (tipo, form) => {
    setErroAcao(null);
    try {
      if (painelItem.modo === 'criar') {
        if (tipo === 'custo') await criarLancamento({ ...form, mes });
        else await criarRenda({ ...form, mes });
      } else {
        const linhaPlanilha = painelItem.item.linhaPlanilha;
        if (tipo === 'custo') await editarCusto({ ...form, linhaPlanilha, mes });
        else await editarRenda({ ...form, linhaPlanilha, mes });
      }
      fecharPainel();
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  const excluirPainel = async (tipo, form) => {
    if (!window.confirm('Excluir este lançamento?')) return;
    setErroAcao(null);
    try {
      const linhaPlanilha = painelItem.item.linhaPlanilha;
      if (tipo === 'custo') await editarCusto({ ...form, linhaPlanilha, mes, status: 'Inativo' });
      else await editarRenda({ ...form, linhaPlanilha, mes, status: 'Inativo' });
      fecharPainel();
      carregarMes(mes, linkToken);
    } catch (e) {
      setErroAcao(e.message);
    }
  };

  if (carregando && !dados) {
    return (
      <div className={styles.page}>
        <div className={styles.centerScreen}>Carregando calendário…</div>
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
          <div className={styles.desktopOnly}>
            <MonthGrid dados={dados} mes={mes} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          </div>
          <div className={styles.mobileOnly}>
            <MobileAgenda dados={dados} mes={mes} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          </div>
          <Legend categorias={dados.categorias} />
          {dados.semData.length > 0 && (
            <SemData itens={dados.semData} moeda={dados.moeda} onEditar={abrirPainelEditar} onTogglePago={alternarPago} />
          )}
          {erroAcao && <div className={styles.errorText}>{erroAcao}</div>}
        </main>

        {painelItem && (
          <PaymentPanel
            key={`${painelItem.modo}-${painelItem.tipo}-${painelItem.item?.linhaPlanilha ?? 'novo'}`}
            mes={mes}
            categoriasCusto={dados.categorias.filter((c) => c.nome !== 'Recebimento')}
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
        <span className={styles.brandSection}>Calendário</span>
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
      <SummaryCard label="Pago no mês" valor={totals.pago} moeda={moeda} cor="var(--ink-subtle)" />
      <SummaryCard label="A pagar" valor={totals.pendente} moeda={moeda} cor="var(--ink)" />
      <SummaryCard label="Em atraso" valor={totals.atrasado} moeda={moeda} cor="var(--status-atrasado)" />
      <SummaryCard label="Entradas" valor={totals.receita} moeda={moeda} cor="var(--status-receita)" receita />
    </div>
  );
}

function SummaryCard({ label, valor, moeda, cor, receita }) {
  return (
    <div className={`${styles.summaryCard} ${receita ? styles.summaryCardReceita : ''}`}>
      <div className={styles.summaryLabel}>{label}</div>
      <div className={styles.summaryValue} style={{ color: cor }}>
        {formatarMoeda(valor, moeda)}
      </div>
    </div>
  );
}

function MonthGrid({ dados, mes, onEditar, onTogglePago }) {
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
          <DayCell key={dia.data} dia={dia} hoje={dados.hoje} onEditar={onEditar} onTogglePago={onTogglePago} />
        ))}
        {Array.from({ length: blanksDepois }).map((_, i) => (
          <div key={`depois-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
        ))}
      </div>
    </>
  );
}

function DayCell({ dia, hoje, onEditar, onTogglePago }) {
  const isHoje = dia.data === hoje;
  const atrasado = dia.itens.some((i) => i.atrasado);
  const totalSaida = dia.itens
    .filter((i) => i.tipo === 'custo')
    .reduce((s, i) => s + i.valor, 0);

  const classe = [styles.cell, isHoje ? styles.cellToday : '', !isHoje && atrasado ? styles.cellLate : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classe}>
      <div className={styles.cellHead}>
        <span className={`${styles.cellDay} ${isHoje ? styles.cellDayToday : ''}`}>{dia.dia}</span>
        {totalSaida > 0 && <span className={styles.cellDayTotal}>−{totalSaida.toFixed(2)}</span>}
      </div>
      {dia.itens.map((item, idx) => (
        <Item key={idx} item={item} onEditar={onEditar} onTogglePago={onTogglePago} />
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

function Item({ item, onEditar, onTogglePago }) {
  const classeNome = item.statusPagamento === 'pago' ? styles.itemNamePago : '';
  const classeValor =
    item.tipo === 'renda'
      ? styles.itemAmountReceita
      : item.atrasado
        ? styles.itemAmountAtrasado
        : item.statusPagamento === 'pago'
          ? styles.itemAmountPago
          : styles.itemAmountPendente;

  const marca = item.tipo === 'renda' ? '+' : item.statusPagamento === 'pago' ? ' ✓' : item.atrasado ? ' !' : '';

  const { onClick, onDoubleClick } = useCliqueSimplesOuDuplo(
    () => onEditar(item),
    () => { if (item.tipo === 'custo') onTogglePago(item); },
  );
  const aoTeclar = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onEditar(item);
    }
  };

  return (
    <div
      className={`${styles.item} ${styles.itemClickable}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={aoTeclar}
      role="button"
      tabIndex={0}
      title={item.tipo === 'custo' ? 'Clique para editar · duplo clique para marcar pago/pendente' : 'Editar lançamento'}
    >
      <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
      <div className={styles.itemBody}>
        <div className={`${styles.itemName} ${classeNome}`}>{item.nome}</div>
        <div className={`${styles.itemAmount} ${classeValor}`}>
          {marca === '+' ? '+' : ''}
          {item.valor.toFixed(2)}
          {marca !== '+' ? marca : ''}
        </div>
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
      <MiniCalendar mes={mes} dias={dados.dias} hoje={dados.hoje} selecionado={diaAtual.data} onSelecionar={setDiaSelecionado} />
      <DayList dia={diaAtual} hoje={dados.hoje} moeda={dados.moeda} onEditar={onEditar} onTogglePago={onTogglePago} />
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
    !isHoje && isSelecionado ? styles.miniCellSelecionado : '',
    !isHoje && atrasado ? styles.cellLate : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classe} onClick={() => onSelecionar(dia.data)}>
      <span className={`${styles.cellDay} ${isHoje ? styles.cellDayToday : ''}`}>{dia.dia}</span>
      <span className={styles.miniDots}>
        {dia.itens.slice(0, 3).map((item, idx) => (
          <span key={idx} className={styles.miniDot} style={{ background: item.categoria.cor }} />
        ))}
      </span>
    </button>
  );
}

function DayList({ dia, hoje, moeda, onEditar, onTogglePago }) {
  return (
    <div className={styles.dayList}>
      <div className={styles.dayListHead}>
        <span className={styles.dayListTitle}>{tituloDia(dia.data)}</span>
        {dia.data === hoje && <span className={styles.dayListBadge}>hoje</span>}
      </div>
      {dia.itens.length === 0 ? (
        <div className={styles.dayListVazio}>Nenhum lançamento neste dia.</div>
      ) : (
        dia.itens.map((item, idx) => <DayListRow key={idx} item={item} moeda={moeda} onEditar={onEditar} onTogglePago={onTogglePago} />)
      )}
    </div>
  );
}

function DayListRow({ item, moeda, onEditar, onTogglePago }) {
  const statusLabel = item.tipo === 'renda' ? null : item.atrasado ? 'Atrasado' : item.statusPagamento === 'pago' ? 'Pago' : 'Não pago';
  const statusClasse = item.atrasado ? styles.dayListBadgeAtrasado : item.statusPagamento === 'pago' ? styles.dayListBadgePago : styles.dayListBadgePendente;
  const valorClasse =
    item.tipo === 'renda'
      ? styles.itemAmountReceita
      : item.atrasado
        ? styles.itemAmountAtrasado
        : item.statusPagamento === 'pago'
          ? styles.itemAmountPago
          : styles.itemAmountPendente;

  const { onClick, onDoubleClick } = useCliqueSimplesOuDuplo(
    () => onEditar(item),
    () => { if (item.tipo === 'custo') onTogglePago(item); },
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
      <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
      <div className={styles.itemBody} style={{ flex: 1 }}>
        <div className={styles.itemName}>{item.nome}</div>
        {item.tipo === 'custo' && <div className={styles.semDataMeta}>{item.categoria.nome}</div>}
      </div>
      {statusLabel && <span className={`${styles.dayListBadgeBase} ${statusClasse}`}>{statusLabel}</span>}
      <span className={`${styles.dayListAmount} ${valorClasse}`}>
        {item.tipo === 'renda' ? '+' : ''}
        {formatarMoeda(item.valor, moeda)}
      </span>
    </div>
  );
}

function Legend({ categorias }) {
  return (
    <div className={styles.legend}>
      {categorias.map((c) => (
        <div key={c.nome} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: c.cor }} />
          <span>
            {c.icone} {c.nome}
          </span>
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
            <div className={styles.itemName}>{item.nome}</div>
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

function PaymentPanel({ mes, categoriasCusto, modo, tipoInicial, item, onSalvar, onExcluir, onCancelar }) {
  const [tipo, setTipo] = useState(item ? item.tipo : tipoInicial);
  const [descricao, setDescricao] = useState(item?.nome || '');
  const [valor, setValor] = useState(item ? String(item.valor) : '');
  const [categoria, setCategoria] = useState(item?.categoria?.nome || categoriasCusto[0]?.nome || '');
  const [frequencia, setFrequencia] = useState(item?.frequencia ? frequenciaExibicao(item.frequencia) : 'Mensal');
  const [diaMes, setDiaMes] = useState(diaMesInicial(item, item ? item.tipo : tipoInicial));
  const [diaSemana, setDiaSemana] = useState(item?.tipo === 'renda' ? diaSemanaInicial(item.diaRecebimento) : DIAS_SEMANA_OPCOES[5]);
  const [repetirTodoMes, setRepetirTodoMes] = useState(item ? !!item.repete : true);
  const [statusPago, setStatusPago] = useState(item?.statusPagamento === 'pago');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const panelRef = useRef(null);
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const ehRenda = tipo === 'renda';
  const ehSemanal = ehRenda && frequencia === 'Semanal';
  const valido = descricao.trim() && Number(valor) > 0 && (ehSemanal ? !!diaSemana : Number(diaMes) >= 1 && Number(diaMes) <= 31);

  const montarForm = () => {
    if (ehRenda) {
      return {
        fonte: descricao,
        valor: Number(valor),
        frequencia,
        diaRecebimento: ehSemanal ? diaSemana : Number(diaMes),
        repetirTodoMes,
      };
    }
    return {
      nome: descricao,
      valor: Number(valor),
      categoria,
      dia: Number(diaMes),
      repetirTodoMes,
    };
  };

  const salvar = async () => {
    setSalvando(true);
    if (modo === 'editar' && tipo === 'custo' && statusPago !== (item.statusPagamento === 'pago')) {
      await atualizarPagamento(item.linhaPlanilha, statusPago ? 'Pago' : 'Pendente');
    }
    await onSalvar(tipo, montarForm());
    setSalvando(false);
  };

  const excluir = async () => {
    setExcluindo(true);
    await onExcluir(tipo, montarForm());
    setExcluindo(false);
  };

  const titulo = modo === 'criar' ? (ehRenda ? 'Nova renda' : 'Novo pagamento') : ehRenda ? 'Editar renda' : 'Editar pagamento';

  return (
    <aside className={styles.panel} ref={panelRef}>
      <div className={styles.panelTitle}>{titulo}</div>
      <div className={styles.panelSubtitle}>{tituloMes(mes)}</div>

      {modo === 'criar' && (
        <div className={styles.chipsRow}>
          <button type="button" className={`${styles.chip} ${!ehRenda ? styles.chipActive : ''}`} onClick={() => setTipo('custo')}>
            Custo
          </button>
          <button type="button" className={`${styles.chip} ${ehRenda ? styles.chipActive : ''}`} onClick={() => setTipo('renda')}>
            Renda
          </button>
        </div>
      )}

      <label className={styles.fieldLabel}>{ehRenda ? 'Fonte' : 'Descrição'}</label>
      <input
        className={styles.fieldInput}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder={ehRenda ? 'Salário' : 'Assinatura de streaming'}
      />

      <div className={styles.fieldRow}>
        <div style={{ flex: 1.3 }}>
          <label className={styles.fieldLabel}>Valor</label>
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

      {ehRenda ? (
        <>
          <label className={styles.fieldLabel}>Frequência</label>
          <div className={styles.chipsRow}>
            {FREQUENCIAS_RENDA.map((f) => (
              <button
                key={f}
                type="button"
                className={`${styles.chip} ${frequencia === f ? styles.chipActive : ''}`}
                onClick={() => setFrequencia(f)}
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

      {modo === 'editar' && !ehRenda && (
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

      <button
        type="button"
        className={`${styles.switchTrack} ${repetirTodoMes ? styles.switchTrackOn : ''}`}
        onClick={() => setRepetirTodoMes((v) => !v)}
        aria-pressed={repetirTodoMes}
      >
        <span className={styles.switchThumb} />
      </button>
      <div className={styles.switchRow} style={{ marginTop: -22 }}>
        <span style={{ width: 44 }} />
        <span className={styles.switchLabel}>Repetir todo mês</span>
      </div>

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
    </aside>
  );
}

function LoginModal({ email, onEmailChange, mensagem, onEnviar, onFechar }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
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
