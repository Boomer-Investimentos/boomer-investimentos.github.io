import { useEffect, useState, useCallback } from 'react';
import styles from './CalendarioPage.module.css';
import {
  obterMes,
  verificarAcesso,
  pedirAcesso,
  atualizarPagamento,
  criarLancamento,
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
  const [painelAberto, setPainelAberto] = useState(false);

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

  const abrirPainel = () => {
    if (dados && !dados.autenticado) return exigirLogin();
    setPainelAberto(true);
  };

  const salvarNovoPagamento = async (form) => {
    setErroAcao(null);
    try {
      await criarLancamento({ ...form, mes });
      setPainelAberto(false);
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
            onAdicionar={abrirPainel}
            carregando={carregando}
          />
          <SummaryCards totals={dados.totals} moeda={dados.moeda} />
          <div className={styles.desktopOnly}>
            <MonthGrid dados={dados} mes={mes} onTogglePago={alternarPago} />
          </div>
          <div className={styles.mobileOnly}>
            <MobileAgenda dados={dados} mes={mes} onTogglePago={alternarPago} />
          </div>
          <Legend categorias={dados.categorias} />
          {dados.semData.length > 0 && (
            <SemData itens={dados.semData} moeda={dados.moeda} onTogglePago={alternarPago} />
          )}
          {erroAcao && <div className={styles.errorText}>{erroAcao}</div>}
        </main>

        {painelAberto && (
          <NewPaymentPanel
            mes={mes}
            categorias={dados.categorias.filter((c) => c.nome !== 'Recebimento')}
            onSalvar={salvarNovoPagamento}
            onCancelar={() => setPainelAberto(false)}
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
        <div className={styles.brandMark}>b</div>
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
          + Pagamento
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

function MonthGrid({ dados, mes, onTogglePago }) {
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
          <DayCell key={dia.data} dia={dia} hoje={dados.hoje} onTogglePago={onTogglePago} />
        ))}
        {Array.from({ length: blanksDepois }).map((_, i) => (
          <div key={`depois-${i}`} className={`${styles.cell} ${styles.cellBlank}`} />
        ))}
      </div>
    </>
  );
}

function DayCell({ dia, hoje, onTogglePago }) {
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
        <Item key={idx} item={item} onTogglePago={onTogglePago} />
      ))}
    </div>
  );
}

function Item({ item, onTogglePago }) {
  const clicavel = item.tipo === 'custo';
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

  const acionar = () => onTogglePago(item);
  const aoTeclar = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      acionar();
    }
  };

  return (
    <div
      className={`${styles.item} ${clicavel ? styles.itemClickable : ''}`}
      onClick={clicavel ? acionar : undefined}
      onKeyDown={clicavel ? aoTeclar : undefined}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      title={clicavel ? 'Marcar como pago/pendente' : undefined}
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
function MobileAgenda({ dados, mes, onTogglePago }) {
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
      <DayList dia={diaAtual} hoje={dados.hoje} moeda={dados.moeda} onTogglePago={onTogglePago} />
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

function DayList({ dia, hoje, moeda, onTogglePago }) {
  return (
    <div className={styles.dayList}>
      <div className={styles.dayListHead}>
        <span className={styles.dayListTitle}>{tituloDia(dia.data)}</span>
        {dia.data === hoje && <span className={styles.dayListBadge}>hoje</span>}
      </div>
      {dia.itens.length === 0 ? (
        <div className={styles.dayListVazio}>Nenhum lançamento neste dia.</div>
      ) : (
        dia.itens.map((item, idx) => <DayListRow key={idx} item={item} moeda={moeda} onTogglePago={onTogglePago} />)
      )}
    </div>
  );
}

function DayListRow({ item, moeda, onTogglePago }) {
  const clicavel = item.tipo === 'custo';
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

  const acionar = () => onTogglePago(item);
  const aoTeclar = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      acionar();
    }
  };

  return (
    <div
      className={`${styles.dayListRow} ${clicavel ? styles.itemClickable : ''}`}
      onClick={clicavel ? acionar : undefined}
      onKeyDown={clicavel ? aoTeclar : undefined}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
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

function SemData({ itens, moeda, onTogglePago }) {
  return (
    <div className={styles.semDataBox}>
      <div className={styles.semDataTitle}>Sem data definida ({itens.length})</div>
      {itens.map((item) => (
        <div key={item.linhaPlanilha} className={styles.semDataRow}>
          <span className={styles.itemDot} style={{ background: item.categoria.cor }} />
          <div className={styles.itemBody} style={{ flex: 1 }}>
            <div className={styles.itemName}>{item.nome}</div>
            <div className={styles.semDataMeta}>{item.diaTexto}</div>
          </div>
          <button
            className={`${styles.btnGhost} ${styles.btnCompact}`}
            onClick={() => onTogglePago(item)}
          >
            {item.statusPagamento === 'pago' ? 'Pago' : 'Marcar pago'}
          </button>
          <span className={styles.semDataAmount}>{formatarMoeda(item.valor, moeda)}</span>
        </div>
      ))}
    </div>
  );
}

function NewPaymentPanel({ mes, categorias, onSalvar, onCancelar }) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('');
  const [categoria, setCategoria] = useState(categorias[0]?.nome || '');
  const [repetirTodoMes, setRepetirTodoMes] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const valido = nome.trim() && Number(valor) > 0 && Number(dia) >= 1 && Number(dia) <= 31;

  const salvar = async () => {
    setSalvando(true);
    await onSalvar({ nome, valor: Number(valor), categoria, dia: Number(dia), repetirTodoMes });
    setSalvando(false);
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.panelTitle}>Novo pagamento</div>
      <div className={styles.panelSubtitle}>{tituloMes(mes)}</div>

      <label className={styles.fieldLabel}>Descrição</label>
      <input className={styles.fieldInput} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Assinatura de streaming" />

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
          <label className={styles.fieldLabel}>Dia</label>
          <input
            className={styles.fieldInput}
            style={{ marginBottom: 0 }}
            type="number"
            min="1"
            max="31"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            placeholder="23"
          />
        </div>
      </div>

      <label className={styles.fieldLabel}>Categoria</label>
      <div className={styles.chipsRow}>
        {categorias.map((c) => (
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
