import { useState } from 'react';
import { Container, Form } from 'react-bootstrap';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import { buscarCEP, enviarFormulario } from '../services/formularioService';
import brandMark from '../assets/imgs/boomer-b-mark.png';
import styles from './Formulario.module.css';

const maskCPF = v => v.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d)/, '$1.$2')
  .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const maskCelular = v => v.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{2})(\d)/, '($1) $2')
  .replace(/(\d{5})(\d)/, '$1-$2');

const maskCEP = v => v.replace(/\D/g, '').slice(0, 8)
  .replace(/(\d{5})(\d)/, '$1-$2');

const maskBRL = v => {
  const n = v.replace(/\D/g, '').slice(0, 10).padStart(3, '0');
  return 'R$ ' + n.slice(0, -2).replace(/^0+(?=\d)/, '') + ',' + n.slice(-2);
};

const formatSize = bytes => {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

const TIPOS_DOCUMENTO = ['RG', 'CNH', 'Carteira de Trabalho', 'Passaporte', 'RNE', 'Outro'];
const METODOS_PAGAMENTO = ['Pix', 'Boleto', 'Dinheiro', 'Débito', 'Cartão de Crédito'];
const STEPS = ['Seus dados', 'Cartões', 'Renda & custos'];

const emptyCartao = () => ({ modelo: '', fechamento: '', vencimento: '' });
const emptyRenda = () => ({ tipo: '', valor: '' });
const emptyCusto = () => ({ nome: '', valor: '', metodo: '', parcelado: false, parcelas: '', inicio_parcela: '' });

const initialState = {
  nome: '', celular: '', email: '', cpf: '',
  documento_tipo: '', documento: null,
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
  banco: '',
  cartoes: [emptyCartao()],
  rendas: [emptyRenda()],
  custos_fixos: [emptyCusto()],
};

const blockLabel = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#141c31' };

const Svg = ({ children, size = 18, width = 1.9 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ic = {
  user: <><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 4-6 8-6s8 2 8 6"></path></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></>,
  money: <><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>,
  receipt: <><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M7 15h4"></path></>,
  upload: <><path d="M12 16V5"></path><path d="m8 9 4-4 4 4"></path><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"></path></>,
  fileCheck: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="m9 15 2 2 4-4"></path></>,
  x: <><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></>,
  trash: <><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></>,
  plus: <><path d="M12 5v14"></path><path d="M5 12h14"></path></>,
  info: <><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></>,
  check: <path d="M20 6 9 17l-5-5"></path>,
  arrowLeft: <path d="m15 18-6-6 6-6"></path>,
};

const Req = () => <span className={styles.req} aria-hidden="true"> *</span>;

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className={styles.fieldError}>{msg}</div>;
}

function SectionHeader({ icon, title, spaced }) {
  return (
    <div className={`${styles.section} ${spaced ? styles.sectionSpaced : ''}`}>
      <span className={styles.sectionIcon}><Svg>{icon}</Svg></span>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}

function Note({ children }) {
  return (
    <div className={styles.note}>
      <span className={styles.noteIcon}><Svg size={16}>{ic.info}</Svg></span>
      <div className={styles.noteText}>{children}</div>
    </div>
  );
}

function RemoveButton({ label, onClick }) {
  return (
    <button type="button" className={styles.entryRemove} aria-label={label} onClick={onClick}>
      <Svg size={15}>{ic.trash}</Svg> Remover
    </button>
  );
}

function AddButton({ children, onClick }) {
  return (
    <button type="button" className={styles.ghostAdd} onClick={onClick}>
      <Svg size={16}>{ic.plus}</Svg> {children}
    </button>
  );
}

function Stepper({ step }) {
  return (
    <div className={styles.stepper}>
      <div className={styles.stepBars}>
        {[1, 2, 3].map(s => (
          <div key={s} className={`${styles.stepBar} ${s < step ? styles.stepBarDone : s === step ? styles.stepBarActive : ''}`} />
        ))}
      </div>
      <div className={styles.stepLabels}>
        {STEPS.map((label, i) => (
          <div key={label} className={`${styles.stepLabel} ${i + 1 <= step ? styles.stepLabelOn : ''}`}>{i + 1} · {label}</div>
        ))}
      </div>
    </div>
  );
}

function StepOne({ data, errors, set, setEndereco, buscarCEP }) {
  return (
    <>
      <SectionHeader icon={ic.user} title="Informações Pessoais" />

      <div className={styles.stack}>
        <Form.Group controlId="nome">
          <Form.Label>Nome completo<Req /></Form.Label>
          <Form.Control value={data.nome} onChange={e => set('nome', e.target.value)} isInvalid={!!errors.nome} placeholder="João da Silva" />
          <FieldError msg={errors.nome} />
        </Form.Group>

        <div className={styles.row}>
          <Form.Group className={styles.col} controlId="celular">
            <Form.Label>Celular<Req /></Form.Label>
            <Form.Control value={data.celular} onChange={e => set('celular', maskCelular(e.target.value))} isInvalid={!!errors.celular} placeholder="(11) 99999-9999" />
            <FieldError msg={errors.celular} />
          </Form.Group>
          <Form.Group className={styles.col} controlId="email">
            <Form.Label>E-mail<Req /></Form.Label>
            <Form.Control type="email" value={data.email} onChange={e => set('email', e.target.value)} isInvalid={!!errors.email} placeholder="joao@email.com" />
            <FieldError msg={errors.email} />
          </Form.Group>
        </div>

        <Form.Group controlId="cpf" style={{ maxWidth: 340 }}>
          <Form.Label>CPF<Req /></Form.Label>
          <Form.Control value={data.cpf} onChange={e => set('cpf', maskCPF(e.target.value))} isInvalid={!!errors.cpf} placeholder="000.000.000-00" />
          <FieldError msg={errors.cpf} />
        </Form.Group>

        <div>
          <span style={blockLabel}>Tipo de documento</span>
          <div className={styles.pills} role="group" aria-label="Tipo de documento">
            {TIPOS_DOCUMENTO.map(tipo => (
              <button
                key={tipo}
                type="button"
                aria-pressed={data.documento_tipo === tipo}
                className={`${styles.pill} ${data.documento_tipo === tipo ? styles.pillActive : ''}`}
                onClick={() => set('documento_tipo', tipo)}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span style={blockLabel}>Documento de identificação<Req /></span>
          <label className={`${styles.dropzone} ${errors.documento ? styles.dropzoneInvalid : ''}`}>
            <span className={styles.dropIcon}><Svg size={30} width={1.8}>{ic.upload}</Svg></span>
            <span className={styles.dropTitle}>Arraste o arquivo ou <span className={styles.dropLink}>selecione no dispositivo</span></span>
            <span className={styles.dropHint}>PDF, JPG ou PNG · até 10 MB</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className={styles.visuallyHidden}
              onChange={e => set('documento', e.target.files[0] || null)}
            />
          </label>
          {data.documento && (
            <div className={styles.fileChip}>
              <span className={styles.fileChipIcon}><Svg size={20}>{ic.fileCheck}</Svg></span>
              <div className={styles.fileChipMeta}>
                <div className={styles.fileChipName}>{data.documento.name}</div>
                <div className={styles.fileChipSize}>{formatSize(data.documento.size)} · anexado</div>
              </div>
              <button type="button" aria-label="Remover arquivo" className={styles.iconBtn} onClick={() => set('documento', null)}>
                <Svg size={16}>{ic.x}</Svg>
              </button>
            </div>
          )}
          <FieldError msg={errors.documento} />
        </div>
      </div>

      <SectionHeader icon={ic.pin} title="Endereço" spaced />

      <div className={styles.stack}>
        <div className={styles.row}>
          <div className={styles.col} style={{ flexBasis: 200 }}>
            <span style={blockLabel}>CEP<Req /></span>
            <div className={styles.cepGroup}>
              <Form.Control
                value={data.endereco.cep}
                aria-label="CEP"
                onChange={e => setEndereco('cep', maskCEP(e.target.value))}
                isInvalid={!!errors.cep}
                placeholder="00000-000"
              />
              <button type="button" className={styles.cepBtn} onClick={buscarCEP}>Buscar</button>
            </div>
            <FieldError msg={errors.cep} />
          </div>
          <Form.Group className={styles.colWide} controlId="logradouro">
            <Form.Label>Logradouro<Req /></Form.Label>
            <Form.Control value={data.endereco.logradouro} onChange={e => setEndereco('logradouro', e.target.value)} isInvalid={!!errors.logradouro} placeholder="Rua Exemplo" />
            <FieldError msg={errors.logradouro} />
          </Form.Group>
        </div>

        <div className={styles.row}>
          <Form.Group className={styles.colNarrow} controlId="numero">
            <Form.Label>Número<Req /></Form.Label>
            <Form.Control value={data.endereco.numero} onChange={e => setEndereco('numero', e.target.value)} isInvalid={!!errors.numero} placeholder="123" />
            <FieldError msg={errors.numero} />
          </Form.Group>
          <Form.Group className={styles.col} controlId="complemento">
            <Form.Label>Complemento</Form.Label>
            <Form.Control value={data.endereco.complemento} onChange={e => setEndereco('complemento', e.target.value)} placeholder="Apto 4" />
          </Form.Group>
          <Form.Group className={styles.col} controlId="bairro">
            <Form.Label>Bairro<Req /></Form.Label>
            <Form.Control value={data.endereco.bairro} onChange={e => setEndereco('bairro', e.target.value)} isInvalid={!!errors.bairro} placeholder="Centro" />
            <FieldError msg={errors.bairro} />
          </Form.Group>
        </div>

        <div className={styles.row}>
          <Form.Group className={styles.colWide} controlId="cidade">
            <Form.Label>Cidade<Req /></Form.Label>
            <Form.Control value={data.endereco.cidade} onChange={e => setEndereco('cidade', e.target.value)} isInvalid={!!errors.cidade} placeholder="Belo Horizonte" />
            <FieldError msg={errors.cidade} />
          </Form.Group>
          <Form.Group className={styles.colNarrow} controlId="estado">
            <Form.Label>Estado<Req /></Form.Label>
            <Form.Control value={data.endereco.estado} onChange={e => setEndereco('estado', e.target.value.toUpperCase().slice(0, 2))} isInvalid={!!errors.estado} placeholder="MG" />
            <FieldError msg={errors.estado} />
          </Form.Group>
        </div>
      </div>
    </>
  );
}

function StepTwo({ data, errors, updateCartao, addCartao, removeCartao }) {
  return (
    <>
      <SectionHeader icon={ic.card} title="Cartões de crédito" />
      <div className={styles.stack}>
        {data.cartoes.map((cartao, i) => (
          <div key={i} className={styles.entryCard}>
            <div className={styles.entryHead}>
              <span className={styles.entryBadge}>Cartão {i + 1}</span>
              {i > 0 && <RemoveButton label={`Remover cartão ${i + 1}`} onClick={() => removeCartao(i)} />}
            </div>
            <Form.Group controlId={`cartao-modelo-${i}`}>
              <Form.Label>Nome do cartão</Form.Label>
              <Form.Control value={cartao.modelo} onChange={e => updateCartao(i, 'modelo', e.target.value)} isInvalid={!!errors[`cartao_modelo_${i}`]} placeholder="Ex: Nubank Platinum" />
              <FieldError msg={errors[`cartao_modelo_${i}`]} />
            </Form.Group>
            <div className={styles.row} style={{ marginTop: 14 }}>
              <Form.Group className={styles.col} controlId={`cartao-fechamento-${i}`}>
                <Form.Label>Dia de fechamento</Form.Label>
                <Form.Control type="number" min={1} max={31} value={cartao.fechamento} onChange={e => updateCartao(i, 'fechamento', e.target.value)} isInvalid={!!errors[`cartao_fechamento_${i}`]} placeholder="19" />
                <FieldError msg={errors[`cartao_fechamento_${i}`]} />
              </Form.Group>
              <Form.Group className={styles.col} controlId={`cartao-vencimento-${i}`}>
                <Form.Label>Dia de vencimento</Form.Label>
                <Form.Control type="number" min={1} max={31} value={cartao.vencimento} onChange={e => updateCartao(i, 'vencimento', e.target.value)} isInvalid={!!errors[`cartao_vencimento_${i}`]} placeholder="26" />
                <FieldError msg={errors[`cartao_vencimento_${i}`]} />
              </Form.Group>
            </div>
          </div>
        ))}
        <AddButton onClick={addCartao}>Adicionar outro cartão</AddButton>
        <Note>
          Se no seu cartão estiver escrito <strong>“melhor dia de compra”</strong>, a data de fechamento é um dia antes. Ex.: melhor dia 20 → fechamento dia 19.
        </Note>
      </div>
    </>
  );
}

function StepThree({ data, errors, updateRenda, addRenda, removeRenda, updateCusto, addCusto, removeCusto }) {
  return (
    <>
      <SectionHeader icon={ic.money} title="Renda mensal" />
      <div className={styles.stack}>
        <Note>
          Informe cada renda separadamente — ex.: <strong>Salário CLT</strong> e <strong>Freelancer</strong> em linhas diferentes.
        </Note>
        {data.rendas.map((renda, i) => (
          <div key={i} className={styles.entryCard}>
            <div className={styles.entryHead}>
              <span className={styles.entryBadge}>Renda {i + 1}</span>
              {i > 0 && <RemoveButton label={`Remover renda ${i + 1}`} onClick={() => removeRenda(i)} />}
            </div>
            <div className={styles.row}>
              <Form.Group className={styles.colWide} controlId={`renda-tipo-${i}`}>
                <Form.Label>Fonte de renda</Form.Label>
                <Form.Control value={renda.tipo} onChange={e => updateRenda(i, 'tipo', e.target.value)} isInvalid={!!errors[`renda_tipo_${i}`]} placeholder="Ex: Salário CLT" />
                <FieldError msg={errors[`renda_tipo_${i}`]} />
              </Form.Group>
              <Form.Group className={styles.col} controlId={`renda-valor-${i}`}>
                <Form.Label>Valor mensal</Form.Label>
                <Form.Control value={renda.valor} inputMode="numeric" onChange={e => updateRenda(i, 'valor', maskBRL(e.target.value))} isInvalid={!!errors[`renda_valor_${i}`]} placeholder="R$ 0,00" />
                <FieldError msg={errors[`renda_valor_${i}`]} />
              </Form.Group>
            </div>
          </div>
        ))}
        <AddButton onClick={addRenda}>Adicionar outra renda</AddButton>
      </div>

      <SectionHeader icon={ic.receipt} title="Custos fixos mensais" spaced />
      <div className={styles.stack}>
        <Note>
          Informe só os custos <strong>fixos</strong> (aluguel, internet…). Alimentação e transporte são variáveis — não precisam entrar aqui.
        </Note>
        {data.custos_fixos.map((custo, i) => (
          <div key={i} className={styles.entryCard}>
            <div className={styles.entryHead}>
              <span className={styles.entryBadge}>Custo {i + 1}</span>
              {i > 0 && <RemoveButton label={`Remover custo ${i + 1}`} onClick={() => removeCusto(i)} />}
            </div>
            <div className={styles.row}>
              <Form.Group className={styles.colWide} controlId={`custo-nome-${i}`}>
                <Form.Label>Descrição</Form.Label>
                <Form.Control value={custo.nome} onChange={e => updateCusto(i, 'nome', e.target.value)} isInvalid={!!errors[`custo_nome_${i}`]} placeholder="Ex: Aluguel" />
                <FieldError msg={errors[`custo_nome_${i}`]} />
              </Form.Group>
              <Form.Group className={styles.col} controlId={`custo-valor-${i}`}>
                <Form.Label>Valor</Form.Label>
                <Form.Control value={custo.valor} inputMode="numeric" onChange={e => updateCusto(i, 'valor', maskBRL(e.target.value))} isInvalid={!!errors[`custo_valor_${i}`]} placeholder="R$ 0,00" />
                <FieldError msg={errors[`custo_valor_${i}`]} />
              </Form.Group>
              <Form.Group className={styles.col} controlId={`custo-metodo-${i}`}>
                <Form.Label>Pagamento</Form.Label>
                <Form.Select value={custo.metodo} onChange={e => updateCusto(i, 'metodo', e.target.value)} isInvalid={!!errors[`custo_metodo_${i}`]}>
                  <option value="">Selecione…</option>
                  {METODOS_PAGAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
                <FieldError msg={errors[`custo_metodo_${i}`]} />
              </Form.Group>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={custo.parcelado} onChange={e => updateCusto(i, 'parcelado', e.target.checked)} />
              Custo parcelado
            </label>
            {custo.parcelado && (
              <div className={styles.subPanel}>
                <div className={styles.row}>
                  <Form.Group className={styles.col} controlId={`custo-parcelas-${i}`}>
                    <Form.Label>Nº de parcelas<Req /></Form.Label>
                    <Form.Control type="number" min={2} value={custo.parcelas} onChange={e => updateCusto(i, 'parcelas', e.target.value)} isInvalid={!!errors[`custo_parcelas_${i}`]} placeholder="Ex: 48" />
                    <FieldError msg={errors[`custo_parcelas_${i}`]} />
                  </Form.Group>
                  <Form.Group className={styles.col} controlId={`custo-inicio-${i}`}>
                    <Form.Label>Início da 1ª parcela<Req /></Form.Label>
                    <Form.Control type="date" value={custo.inicio_parcela} onChange={e => updateCusto(i, 'inicio_parcela', e.target.value)} isInvalid={!!errors[`custo_inicio_${i}`]} />
                    <FieldError msg={errors[`custo_inicio_${i}`]} />
                  </Form.Group>
                </div>
              </div>
            )}
          </div>
        ))}
        <AddButton onClick={addCusto}>Adicionar outro custo</AddButton>
      </div>
    </>
  );
}

const STEP_TITLES = {
  1: { title: 'Cadastro — Assessoria Financeira', subtitle: 'Preencha seus dados para iniciarmos sua assessoria. Leva cerca de 5 minutos.' },
  2: { title: 'Informações Bancárias', subtitle: 'Cadastre seus cartões de crédito para montarmos seu calendário financeiro.' },
  3: { title: 'Renda & custos fixos', subtitle: 'Por último, informe suas fontes de renda e seus custos fixos mensais.' },
};

function Formulario() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const setEndereco = (field, value) => setFormData(prev => ({
    ...prev,
    endereco: { ...prev.endereco, [field]: value },
  }));

  const handleBuscarCEP = async () => {
    const cep = formData.endereco.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const endereco = await buscarCEP(cep);
      setFormData(prev => ({
        ...prev,
        endereco: { ...prev.endereco, ...endereco },
      }));
    } catch { }
  };

  const validateStep1 = () => {
    const e = {};
    if (!formData.nome.trim()) e.nome = 'Obrigatório';
    if (!formData.celular.trim()) e.celular = 'Obrigatório';
    if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'E-mail inválido';
    if (formData.cpf.replace(/\D/g, '').length < 11) e.cpf = 'CPF inválido';
    if (!formData.documento) e.documento = 'Selecione o documento';
    if (!formData.endereco.cep.trim()) e.cep = 'Obrigatório';
    if (!formData.endereco.logradouro.trim()) e.logradouro = 'Obrigatório';
    if (!formData.endereco.numero.trim()) e.numero = 'Obrigatório';
    if (!formData.endereco.bairro.trim()) e.bairro = 'Obrigatório';
    if (!formData.endereco.cidade.trim()) e.cidade = 'Obrigatório';
    if (!formData.endereco.estado.trim()) e.estado = 'Obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    formData.rendas.forEach((r, i) => {
      if (!r.tipo.trim()) e[`renda_tipo_${i}`] = 'Obrigatório';
      if (!r.valor || r.valor === 'R$ 0,00') e[`renda_valor_${i}`] = 'Obrigatório';
    });
    formData.custos_fixos.forEach((c, i) => {
      if (!c.nome.trim()) e[`custo_nome_${i}`] = 'Obrigatório';
      if (!c.valor || c.valor === 'R$ 0,00') e[`custo_valor_${i}`] = 'Obrigatório';
      if (!c.metodo) e[`custo_metodo_${i}`] = 'Obrigatório';
      if (c.parcelado) {
        if (!c.parcelas || Number(c.parcelas) < 2) e[`custo_parcelas_${i}`] = 'Informe o nº de parcelas (mín. 2)';
        if (!c.inicio_parcela) e[`custo_inicio_${i}`] = 'Informe o início';
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    setErrors({});
    setStep(s => s + 1);
  };

  const back = () => { setErrors({}); setStep(s => s - 1); };

  const updateCartao = (i, field, value) => {
    const arr = [...formData.cartoes];
    arr[i] = { ...arr[i], [field]: value };
    set('cartoes', arr);
  };
  const addCartao = () => set('cartoes', [...formData.cartoes, emptyCartao()]);
  const removeCartao = i => set('cartoes', formData.cartoes.filter((_, idx) => idx !== i));

  const updateRenda = (i, field, value) => {
    const arr = [...formData.rendas];
    arr[i] = { ...arr[i], [field]: value };
    set('rendas', arr);
  };
  const addRenda = () => set('rendas', [...formData.rendas, emptyRenda()]);
  const removeRenda = i => set('rendas', formData.rendas.filter((_, idx) => idx !== i));

  const updateCusto = (i, field, value) => {
    const arr = [...formData.custos_fixos];
    arr[i] = { ...arr[i], [field]: value };
    set('custos_fixos', arr);
  };
  const addCusto = () => set('custos_fixos', [...formData.custos_fixos, emptyCusto()]);
  const removeCusto = i => set('custos_fixos', formData.custos_fixos.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    setSubmitError('');
    try {
      await enviarFormulario(formData, formData.documento);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={`${styles.page} d-flex flex-column min-vh-100`}>
        <Header />
        <main className="flex-grow-1">
          <Container className="py-5">
            <div className={styles.success}>
              <div className={styles.successIcon}><Svg size={34}>{ic.check}</Svg></div>
              <h2 className={styles.successTitle}>Cadastro enviado com sucesso!</h2>
              <p className={styles.successText}>Recebemos suas informações. Em breve entraremos em contato para dar sequência à sua assessoria.</p>
            </div>
          </Container>
        </main>
        <Footer />
      </div>
    );
  }

  const { title, subtitle } = STEP_TITLES[step];

  return (
    <div className={`${styles.page} d-flex flex-column min-vh-100`}>
      <Header />
      <main className="flex-grow-1">
        <Container className="py-5">
          <div className={styles.shell}>
            <div className={styles.headerBand}>
              <div className={styles.brandGroup}>
                <img src={brandMark} alt="Boomer" className={styles.brandMark} />
                <span className={styles.brandName}>Boomer Investimentos</span>
              </div>
              <span className={styles.stepTag}>Etapa {step} de 3</span>
            </div>

            <div className={styles.body}>
              <h1 className={styles.title}>{title}</h1>
              <p className={styles.subtitle}>{subtitle}</p>

              <Stepper step={step} />

              {step === 1 && (
                <StepOne data={formData} errors={errors} set={set} setEndereco={setEndereco} buscarCEP={handleBuscarCEP} />
              )}
              {step === 2 && (
                <StepTwo data={formData} errors={errors} updateCartao={updateCartao} addCartao={addCartao} removeCartao={removeCartao} />
              )}
              {step === 3 && (
                <StepThree
                  data={formData}
                  errors={errors}
                  updateRenda={updateRenda}
                  addRenda={addRenda}
                  removeRenda={removeRenda}
                  updateCusto={updateCusto}
                  addCusto={addCusto}
                  removeCusto={removeCusto}
                />
              )}

              {submitError && <div className={styles.submitError} role="alert">{submitError}</div>}

              <div className={styles.actions}>
                {step > 1 ? (
                  <button type="button" className={styles.btnSecondary} onClick={back}>
                    <Svg size={16}>{ic.arrowLeft}</Svg> Voltar
                  </button>
                ) : (
                  <div className={styles.trust}>
                    <Svg size={16}>{ic.lock}</Svg>
                    Seus dados são protegidos e usados apenas para sua assessoria.
                  </div>
                )}

                {step < 3 ? (
                  <button type="button" className={styles.btnPrimary} onClick={next}>
                    Próximo <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button type="button" className={`${styles.btnPrimary} ${styles.btnSubmit}`} onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Enviando...' : (<><Svg size={18}>{ic.check}</Svg> Enviar cadastro</>)}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export default Formulario;
