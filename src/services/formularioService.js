export async function buscarCEP(cep) {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();
  if (data.erro) throw new Error('CEP não encontrado');
  return {
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    cidade: data.localidade || '',
    estado: data.uf || '',
  };
}

export async function enviarFormulario(formData) {
  const res = await fetch(process.env.REACT_APP_ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  if (!res.ok) throw new Error('Erro ao enviar. Tente novamente.');
}
