import { useState } from 'react';
import { Container, Form, Button, Row, Col, Alert, InputGroup } from 'react-bootstrap';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import { buscarCEP, enviarFormulario } from '../services/formularioService';

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

const BANCOS = [
  'Nubank', 'Itaú', 'Bradesco', 'Santander', 'Caixa Econômica Federal',
  'Banco do Brasil', 'Inter', 'C6 Bank', 'Sicoob', 'Outro',
];
const TIPOS_DOCUMENTO = ['RG', 'CNH', 'Carteira de Trabalho', 'Passaporte', 'RNE', 'Outro'];
const METODOS_PAGAMENTO = ['Pix', 'Boleto', 'Dinheiro', 'Débito', 'Cartão de Crédito'];

const emptyCartao = () => ({ modelo: '', fechamento: '', vencimento: '' });
const emptyRenda = () => ({ tipo: '', valor: '' });
const emptyCusto = () => ({ nome: '', valor: '', metodo: '' });

const initialState = {
  nome: '', celular: '', email: '', cpf: '',
  documento_tipo: '', documento: null,
  endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
  banco: '',
  cartoes: [emptyCartao()],
  rendas: [emptyRenda()],
  custos_fixos: [emptyCusto()],
};

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="text-danger" style={{ fontSize: '0.8rem' }}>{msg}</div>;
}

function StepOne({ data, errors, set, setEndereco, buscarCEP }) {
  return (
    <>
      <h5 className="mb-3">Informações Pessoais</h5>
      <Row>
        <Col xs={12} className="mb-3">
          <Form.Group>
            <Form.Label>Nome completo *</Form.Label>
            <Form.Control
              value={data.nome}
              onChange={e => set('nome', e.target.value)}
              isInvalid={!!errors.nome}
              placeholder="João da Silva"
            />
            <FieldError msg={errors.nome} />
          </Form.Group>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <Form.Group>
            <Form.Label>Celular *</Form.Label>
            <Form.Control
              value={data.celular}
              onChange={e => set('celular', maskCelular(e.target.value))}
              isInvalid={!!errors.celular}
              placeholder="(11) 99999-9999"
            />
            <FieldError msg={errors.celular} />
          </Form.Group>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <Form.Group>
            <Form.Label>E-mail *</Form.Label>
            <Form.Control
              type="email"
              value={data.email}
              onChange={e => set('email', e.target.value)}
              isInvalid={!!errors.email}
              placeholder="joao@email.com"
            />
            <FieldError msg={errors.email} />
          </Form.Group>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <Form.Group>
            <Form.Label>CPF *</Form.Label>
            <Form.Control
              value={data.cpf}
              onChange={e => set('cpf', maskCPF(e.target.value))}
              isInvalid={!!errors.cpf}
              placeholder="000.000.000-00"
            />
            <FieldError msg={errors.cpf} />
          </Form.Group>
        </Col>
        <Col xs={12} md={6} className="mb-3">
          <Form.Group>
            <Form.Label>Tipo de documento *</Form.Label>
            <div className="d-flex flex-wrap gap-2 mt-1">
              {TIPOS_DOCUMENTO.map(tipo => (
                <Button
                  key={tipo}
                  size="sm"
                  variant={data.documento_tipo === tipo ? 'dark' : 'outline-secondary'}
                  onClick={() => set('documento_tipo', tipo)}
                >
                  {tipo}
                </Button>
              ))}
            </div>
            <FieldError msg={errors.documento_tipo} />
          </Form.Group>
        </Col>
        <Col xs={12} className="mb-4">
          <Form.Group>
            <Form.Label>Documento de identidade (PDF ou imagem) *</Form.Label>
            <Form.Control
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => set('documento', e.target.files[0] || null)}
              isInvalid={!!errors.documento}
            />
            {data.documento && (
              <div className="text-success mt-1" style={{ fontSize: '0.85rem' }}>
                {data.documento.name} selecionado ✓
              </div>
            )}
            <FieldError msg={errors.documento} />
          </Form.Group>
        </Col>
      </Row>

      <h5 className="mb-3 mt-2">Endereço</h5>
      <Row>
        <Col xs={12} md={5} className="mb-3">
          <Form.Group>
            <Form.Label>CEP *</Form.Label>
            <InputGroup>
              <Form.Control
                value={data.endereco.cep}
                onChange={e => {
                  const v = maskCEP(e.target.value);
                  setEndereco('cep', v);
                  if (v.replace(/\D/g, '').length === 8) {
                    setEndereco('cep', v);
                  }
                }}
                isInvalid={!!errors.cep}
                placeholder="00000-000"
              />
              <Button variant="outline-secondary" onClick={buscarCEP}>Buscar</Button>
            </InputGroup>
            <FieldError msg={errors.cep} />
          </Form.Group>
        </Col>
        <Col xs={12} md={7} className="mb-3">
          <Form.Group>
            <Form.Label>Logradouro *</Form.Label>
            <Form.Control
              value={data.endereco.logradouro}
              onChange={e => setEndereco('logradouro', e.target.value)}
              isInvalid={!!errors.logradouro}
              placeholder="Rua Exemplo"
            />
            <FieldError msg={errors.logradouro} />
          </Form.Group>
        </Col>
        <Col xs={6} md={3} className="mb-3">
          <Form.Group>
            <Form.Label>Número *</Form.Label>
            <Form.Control
              value={data.endereco.numero}
              onChange={e => setEndereco('numero', e.target.value)}
              isInvalid={!!errors.numero}
              placeholder="123"
            />
            <FieldError msg={errors.numero} />
          </Form.Group>
        </Col>
        <Col xs={6} md={4} className="mb-3">
          <Form.Group>
            <Form.Label>Complemento</Form.Label>
            <Form.Control
              value={data.endereco.complemento}
              onChange={e => setEndereco('complemento', e.target.value)}
              placeholder="Apto 4"
            />
          </Form.Group>
        </Col>
        <Col xs={12} md={5} className="mb-3">
          <Form.Group>
            <Form.Label>Bairro *</Form.Label>
            <Form.Control
              value={data.endereco.bairro}
              onChange={e => setEndereco('bairro', e.target.value)}
              isInvalid={!!errors.bairro}
              placeholder="Centro"
            />
            <FieldError msg={errors.bairro} />
          </Form.Group>
        </Col>
        <Col xs={12} md={8} className="mb-3">
          <Form.Group>
            <Form.Label>Cidade *</Form.Label>
            <Form.Control
              value={data.endereco.cidade}
              onChange={e => setEndereco('cidade', e.target.value)}
              isInvalid={!!errors.cidade}
              placeholder="Belo Horizonte"
            />
            <FieldError msg={errors.cidade} />
          </Form.Group>
        </Col>
        <Col xs={12} md={4} className="mb-3">
          <Form.Group>
            <Form.Label>Estado *</Form.Label>
            <Form.Control
              value={data.endereco.estado}
              onChange={e => setEndereco('estado', e.target.value.toUpperCase().slice(0, 2))}
              isInvalid={!!errors.estado}
              placeholder="MG"
            />
            <FieldError msg={errors.estado} />
          </Form.Group>
        </Col>
      </Row>
    </>
  );
}

function StepTwo({ data, errors, set, updateCartao, addCartao, removeCartao }) {
  return (
    <>
      <h5 className="mb-3">Informações Bancárias</h5>
      <Row>
        <Col xs={12} className="mb-4">
          <Form.Group>
            <Form.Label>Banco principal *</Form.Label>
            <Form.Select
              value={data.banco}
              onChange={e => set('banco', e.target.value)}
              isInvalid={!!errors.banco}
            >
              <option value="">Selecione um banco...</option>
              {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
            </Form.Select>
            <FieldError msg={errors.banco} />
          </Form.Group>
        </Col>
      </Row>

      <h5 className="mb-3">Cartões de Crédito</h5>
      {data.cartoes.map((cartao, i) => (
        <div key={i} className="border rounded p-3 mb-3" style={{ background: '#f8f9fa' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="text-muted" style={{ fontSize: '0.9rem' }}>Cartão {i + 1}</strong>
            {i > 0 && (
              <Button variant="outline-danger" size="sm" onClick={() => removeCartao(i)}>✕</Button>
            )}
          </div>
          <Row>
            <Col xs={12} className="mb-2">
              <Form.Control
                value={cartao.modelo}
                onChange={e => updateCartao(i, 'modelo', e.target.value)}
                isInvalid={!!errors[`cartao_modelo_${i}`]}
                placeholder="Ex: Nubank Platinum"
              />
              <FieldError msg={errors[`cartao_modelo_${i}`]} />
            </Col>
            <Col xs={6} className="mb-2">
              <Form.Label style={{ fontSize: '0.85rem' }}>Fechamento (dia) *</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={31}
                value={cartao.fechamento}
                onChange={e => updateCartao(i, 'fechamento', e.target.value)}
                isInvalid={!!errors[`cartao_fechamento_${i}`]}
                placeholder="Dia"
              />
              <FieldError msg={errors[`cartao_fechamento_${i}`]} />
            </Col>
            <Col xs={6} className="mb-2">
              <Form.Label style={{ fontSize: '0.85rem' }}>Vencimento (dia) *</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={31}
                value={cartao.vencimento}
                onChange={e => updateCartao(i, 'vencimento', e.target.value)}
                isInvalid={!!errors[`cartao_vencimento_${i}`]}
                placeholder="Dia"
              />
              <FieldError msg={errors[`cartao_vencimento_${i}`]} />
            </Col>
          </Row>
        </div>
      ))}
      <Button variant="outline-dark" size="sm" onClick={addCartao} className="mb-3">+ Adicionar cartão</Button>
      <Alert variant="warning" className="py-2">
        <small>
          ⚠️ Se no seu cartão estiver escrito "melhor dia de compra", a data de fechamento é um dia antes.
          Exemplo: Melhor dia de compra = dia 20 → Fechamento = dia 19
        </small>
      </Alert>
    </>
  );
}

function StepThree({ data, errors, updateRenda, addRenda, removeRenda, updateCusto, addCusto, removeCusto }) {
  return (
    <>
      <h5 className="mb-3">Renda Mensal</h5>
      {data.rendas.map((renda, i) => (
        <div key={i} className="border rounded p-3 mb-3" style={{ background: '#f8f9fa' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="text-muted" style={{ fontSize: '0.9rem' }}>Renda {i + 1}</strong>
            {i > 0 && (
              <Button variant="outline-danger" size="sm" onClick={() => removeRenda(i)}>✕</Button>
            )}
          </div>
          <Row>
            <Col xs={12} md={7} className="mb-2">
              <Form.Control
                value={renda.tipo}
                onChange={e => updateRenda(i, 'tipo', e.target.value)}
                isInvalid={!!errors[`renda_tipo_${i}`]}
                placeholder="Ex: CLT, Freelance, Aluguel"
              />
              <FieldError msg={errors[`renda_tipo_${i}`]} />
            </Col>
            <Col xs={12} md={5} className="mb-2">
              <Form.Control
                value={renda.valor}
                onChange={e => updateRenda(i, 'valor', maskBRL(e.target.value))}
                isInvalid={!!errors[`renda_valor_${i}`]}
                placeholder="R$ 0,00"
              />
              <FieldError msg={errors[`renda_valor_${i}`]} />
            </Col>
          </Row>
        </div>
      ))}
      <Button variant="outline-dark" size="sm" onClick={addRenda} className="mb-4">+ Adicionar renda</Button>

      <h5 className="mb-3">Custos Fixos Mensais</h5>
      {data.custos_fixos.map((custo, i) => (
        <div key={i} className="border rounded p-3 mb-3" style={{ background: '#f8f9fa' }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong className="text-muted" style={{ fontSize: '0.9rem' }}>Custo {i + 1}</strong>
            {i > 0 && (
              <Button variant="outline-danger" size="sm" onClick={() => removeCusto(i)}>✕</Button>
            )}
          </div>
          <Row>
            <Col xs={12} md={5} className="mb-2">
              <Form.Control
                value={custo.nome}
                onChange={e => updateCusto(i, 'nome', e.target.value)}
                isInvalid={!!errors[`custo_nome_${i}`]}
                placeholder="Ex: Aluguel, Internet"
              />
              <FieldError msg={errors[`custo_nome_${i}`]} />
            </Col>
            <Col xs={7} md={4} className="mb-2">
              <Form.Control
                value={custo.valor}
                onChange={e => updateCusto(i, 'valor', maskBRL(e.target.value))}
                isInvalid={!!errors[`custo_valor_${i}`]}
                placeholder="R$ 0,00"
              />
              <FieldError msg={errors[`custo_valor_${i}`]} />
            </Col>
            <Col xs={5} md={3} className="mb-2">
              <Form.Select
                value={custo.metodo}
                onChange={e => updateCusto(i, 'metodo', e.target.value)}
                isInvalid={!!errors[`custo_metodo_${i}`]}
              >
                <option value="">Método</option>
                {METODOS_PAGAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
              </Form.Select>
              <FieldError msg={errors[`custo_metodo_${i}`]} />
            </Col>
          </Row>
        </div>
      ))}
      <Button variant="outline-dark" size="sm" onClick={addCusto} className="mb-2">+ Adicionar custo</Button>
    </>
  );
}

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
    if (!formData.documento_tipo) e.documento_tipo = 'Selecione o tipo';
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
    if (!formData.banco) e.banco = 'Obrigatório';
    formData.cartoes.forEach((c, i) => {
      if (!c.modelo.trim()) e[`cartao_modelo_${i}`] = 'Obrigatório';
      if (!c.fechamento) e[`cartao_fechamento_${i}`] = 'Obrigatório';
      if (!c.vencimento) e[`cartao_vencimento_${i}`] = 'Obrigatório';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    formData.rendas.forEach((r, i) => {
      if (!r.tipo.trim()) e[`renda_tipo_${i}`] = 'Obrigatório';
      if (!r.valor || r.valor === 'R$ 0,00') e[`renda_valor_${i}`] = 'Obrigatório';
    });
    formData.custos_fixos.forEach((c, i) => {
      if (!c.nome.trim()) e[`custo_nome_${i}`] = 'Obrigatório';
      if (!c.valor || c.valor === 'R$ 0,00') e[`custo_valor_${i}`] = 'Obrigatório';
      if (!c.metodo) e[`custo_metodo_${i}`] = 'Obrigatório';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    const valid = step === 1 ? validateStep1() : validateStep2();
    if (valid) { setErrors({}); setStep(s => s + 1); }
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
    if (!validateStep3()) return;
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
      <>
        <Header />
        <main className="flex-grow-1">
          <Container className="py-5 text-center">
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h2 className="mt-3">Formulário enviado com sucesso!</h2>
            <p className="text-muted">Em breve entraremos em contato.</p>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-grow-1">
        <Container className="py-5" style={{ maxWidth: '700px' }}>
          <h1 className="mb-1">Cadastro Assessoria Financeira</h1>
          <p className="text-muted mb-3">Etapa {step} de 3</p>

          <div className="d-flex mb-4 gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: s <= step ? '#212529' : '#dee2e6',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          {step === 1 && (
            <StepOne
              data={formData}
              errors={errors}
              set={set}
              setEndereco={setEndereco}
              buscarCEP={handleBuscarCEP}
            />
          )}
          {step === 2 && (
            <StepTwo
              data={formData}
              errors={errors}
              set={set}
              updateCartao={updateCartao}
              addCartao={addCartao}
              removeCartao={removeCartao}
            />
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

          {submitError && <Alert variant="danger" className="mt-3">{submitError}</Alert>}

          <div className="d-flex justify-content-between mt-4">
            {step > 1
              ? <Button variant="outline-dark" onClick={back}>← Voltar</Button>
              : <div />}
            {step < 3
              ? <Button variant="dark" onClick={next}>Próximo →</Button>
              : <Button variant="dark" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar'}
              </Button>}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export default Formulario;
