const formSala = document.getElementById('form-sala');
const formReserva = document.getElementById('form-reserva');
const filtros = document.getElementById('filtros');
let salas = [];

function mensagem(texto) {
  document.getElementById('mensagem').textContent = texto;
}

async function api(url, metodo = 'GET', dados) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: dados ? JSON.stringify(dados) : undefined
  });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.erro);
  return resultado;
}

function celula(linha, texto) {
  const coluna = document.createElement('td');
  coluna.textContent = texto;
  linha.appendChild(coluna);
  return coluna;
}

function botoes(linha, tipo, id) {
  const coluna = celula(linha, '');
  for (const acao of ['Consultar', 'Editar', 'Excluir']) {
    const botao = document.createElement('button');
    botao.textContent = acao;
    botao.onclick = () => executar(tipo, id, acao);
    coluna.appendChild(botao);
  }
}

async function carregar() {
  salas = await api('/api/salas');
  const lista = document.getElementById('salas');
  lista.replaceChildren();
  const filtroSelecionado = filtros.elements.salaId.value;
  const salaSelecionada = formReserva.elements.salaId.value;
  formReserva.elements.salaId.replaceChildren(new Option('Selecione', ''));
  filtros.elements.salaId.replaceChildren(new Option('Todas', ''));
  for (const s of salas) {
    const linha = document.createElement('tr');
    celula(linha, s.nome);
    celula(linha, s.localizacao);
    celula(linha, s.capacidade);
    celula(linha, s.recursos);
    celula(linha, s.situacao);
    botoes(linha, 'salas', s.id);
    lista.appendChild(linha);
    formReserva.elements.salaId.add(new Option(s.nome + ' — ' + s.capacidade + ' pessoas — ' + s.situacao, s.id));
    filtros.elements.salaId.add(new Option(s.nome, s.id));
  }
  filtros.elements.salaId.value = filtroSelecionado;
  formReserva.elements.salaId.value = salaSelecionada;
  await listarReservas();
}

async function listarReservas() {
  const parametros = new URLSearchParams(new FormData(filtros));
  const reservas = await api('/api/reservas?' + parametros);
  const lista = document.getElementById('reservas');
  lista.replaceChildren();
  for (const r of reservas) {
    const linha = document.createElement('tr');
    celula(linha, r.aluno);
    celula(linha, salas.find(s => s.id === r.salaId)?.nome);
    celula(linha, r.data.split('-').reverse().join('/'));
    celula(linha, r.horaInicio + ' – ' + r.horaFim);
    celula(linha, r.participantes);
    const status = celula(linha, r.status);
    status.className = r.status === 'Ativa' ? 'ativa' : 'cancelada';
    botoes(linha, 'reservas', r.id);
    lista.appendChild(linha);
  }
}

async function executar(tipo, id, acao) {
  try {
    if (acao === 'Excluir') {
      if (!confirm('Confirma a exclusão deste registro?')) return;
      await api('/api/' + tipo + '/' + id, 'DELETE');
      mensagem('Registro excluído.');
      await carregar();
      return;
    }
    const registro = await api('/api/' + tipo + '/' + id);
    if (acao === 'Consultar') {
      document.getElementById('detalhes').textContent = JSON.stringify(registro, null, 2);
    } else {
      const form = tipo === 'salas' ? formSala : formReserva;
      for (const campo in registro) form.elements[campo].value = registro[campo];
      if (tipo === 'reservas') consultarFeriado();
      form.scrollIntoView();
    }
  } catch (e) { mensagem(e.message); }
}

async function salvar(evento, tipo, form) {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  const id = dados.id;
  delete dados.id;
  if (tipo === 'salas') dados.capacidade = Number(dados.capacidade);
  else {
    dados.salaId = Number(dados.salaId);
    dados.participantes = Number(dados.participantes);
  }
  try {
    await api('/api/' + tipo + (id ? '/' + id : ''), id ? 'PUT' : 'POST', dados);
    form.reset();
    mensagem('Registro salvo.');
    await carregar();
  } catch (e) { mensagem(e.message); }
}

async function consultarFeriado() {
  const data = formReserva.elements.data.value;
  const aviso = document.getElementById('feriado');
  if (!data) { aviso.textContent = ''; return; }
  aviso.textContent = 'Consultando feriados…';
  try {
    const feriados = await api('/api/feriados/' + data.slice(0, 4));
    if (formReserva.elements.data.value !== data) return;
    const feriado = feriados.find(f => f.date === data);
    aviso.textContent = feriado ? 'Feriado: ' + feriado.name + '. Você pode reservar normalmente.' : 'Nenhum feriado encontrado nesta data.';
  } catch (e) { aviso.textContent = e.message; }
}

formSala.onsubmit = e => salvar(e, 'salas', formSala);
formReserva.onsubmit = e => salvar(e, 'reservas', formReserva);
formReserva.elements.data.onchange = consultarFeriado;
formReserva.onreset = () => { document.getElementById('feriado').textContent = ''; };
filtros.onsubmit = e => { e.preventDefault(); listarReservas().catch(e => mensagem(e.message)); };
document.getElementById('limpar-filtros').onclick = () => { filtros.reset(); listarReservas().catch(e => mensagem(e.message)); };
carregar().catch(e => mensagem(e.message));
