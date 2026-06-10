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

export async function enviarFormulario(formData, documentoFile) {
  const fd = new FormData();

  fd.append('nome', formData.nome);
  fd.append('celular', formData.celular);
  fd.append('email', formData.email);
  fd.append('cpf', formData.cpf);
  fd.append('documento_tipo', formData.documento_tipo);
  fd.append('banco', formData.banco);

  fd.append('endereco', JSON.stringify(formData.endereco));
  fd.append('cartoes', JSON.stringify(formData.cartoes));
  fd.append('rendas', JSON.stringify(formData.rendas));
  fd.append('custos_fixos', JSON.stringify(formData.custos_fixos));

  if (documentoFile) fd.append('documento', documentoFile);

  const res = await fetch('/api/send-form', { method: 'POST', body: fd });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao enviar. Tente novamente.');
  }
}
