const http = require('http');
const fs = require('fs');
const path = require('path');

const arquivo = path.join(__dirname, 'data', 'db.json');
let banco = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

function erro(mensagem, status = 400) {
  const e = new Error(mensagem);
  e.status = status;
  throw e;
}

function obrigatorios(dados, campos) {
  for (const campo of campos) {
    if (dados[campo] === undefined || dados[campo] === null || String(dados[campo]).trim() === '') {
      erro('Preencha o campo: ' + campo);
    }
  }
}

async function lerDados(req) {
  let corpo = '';
  for await (const parte of req) corpo += parte;
  try {
    const dados = JSON.parse(corpo);
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error();
    return dados;
  } catch {
    erro('JSON inválido.');
  }
}

function dataValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const dia = new Date(data + 'T12:00:00Z');
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === data;
}

function validarSala(dados) {
  obrigatorios(dados, ['nome', 'localizacao', 'capacidade', 'recursos', 'situacao']);
  if (!Number.isInteger(dados.capacidade) || dados.capacidade < 1) erro('Capacidade deve ser um inteiro positivo.');
  if (!['Disponível', 'Inativa'].includes(dados.situacao)) erro('Situação inválida.');
  return { nome: dados.nome.trim(), localizacao: dados.localizacao.trim(), capacidade: dados.capacidade, recursos: dados.recursos.trim(), situacao: dados.situacao };
}

function validarReserva(dados, id) {
  obrigatorios(dados, ['aluno', 'email', 'salaId', 'data', 'horaInicio', 'horaFim', 'participantes', 'finalidade', 'status']);
  const sala = banco.salas.find(s => s.id === dados.salaId);
  if (!sala) erro('Sala não encontrada.');
  if (!['Ativa', 'Cancelada'].includes(dados.status)) erro('Status inválido.');
  // Uma reserva existente pode ser cancelada mesmo se a sala estiver inativa.
  const anterior = banco.reservas.find(r => r.id === id);
  if (sala.situacao === 'Inativa' && !(anterior && anterior.salaId === sala.id && dados.status === 'Cancelada')) erro('Sala inativa não pode receber reservas.', 409);
  if (!dataValida(dados.data)) erro('Data inválida.');
  if (![dados.horaInicio, dados.horaFim].every(h => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h))) erro('Horário inválido.');
  if (dados.horaFim <= dados.horaInicio) erro('Horário final deve ser posterior ao inicial.');
  if (!Number.isInteger(dados.participantes) || dados.participantes < 1) erro('Participantes deve ser um inteiro positivo.');
  if (dados.participantes > sala.capacidade) erro('Quantidade de participantes excede a capacidade da sala.');
  if (dados.status === 'Ativa') {
    const conflito = banco.reservas.some(r => r.id !== id && r.salaId === sala.id && r.data === dados.data && r.status === 'Ativa' && dados.horaInicio < r.horaFim && dados.horaFim > r.horaInicio);
    if (conflito) erro('A sala já possui reserva ativa neste horário.', 409);
  }
  return { aluno: dados.aluno.trim(), email: dados.email.trim(), salaId: sala.id, data: dados.data, horaInicio: dados.horaInicio, horaFim: dados.horaFim, participantes: dados.participantes, finalidade: dados.finalidade.trim(), status: dados.status };
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const partes = url.pathname.split('/').filter(Boolean);

    if (partes[0] === 'api' && partes[1] === 'feriados' && partes.length === 3) {
      if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
      if (!/^\d{4}$/.test(partes[2])) return responder(res, 400, { erro: 'Ano inválido.' });
      try {
        const resposta = await fetch('https://brasilapi.com.br/api/feriados/v1/' + partes[2]);
        if (!resposta.ok) throw new Error();
        const dados = await resposta.json();
        if (!Array.isArray(dados)) throw new Error();
        return responder(res, 200, dados);
      } catch {
        return responder(res, 502, { erro: 'Não foi possível consultar os feriados. Você pode continuar a reserva.' });
      }
    }

    if (partes[0] === 'api') {
      const tipo = partes[1];
      const id = partes[2] ? Number(partes[2]) : null;
      if (!['salas', 'reservas'].includes(tipo) || partes.length > 3 || (partes[2] && (!Number.isInteger(id) || id < 1))) {
        return responder(res, 404, { erro: 'Rota não encontrada.' });
      }
      const registro = banco[tipo].find(item => item.id === id);
      if (id !== null && !registro) return responder(res, 404, { erro: 'Registro não encontrado.' });

      if (req.method === 'GET') {
        if (id !== null) return responder(res, 200, registro);
        let lista = banco[tipo];
        if (tipo === 'reservas') {
          const data = url.searchParams.get('data');
          const salaId = url.searchParams.get('salaId');
          const status = url.searchParams.get('status');
          lista = lista.filter(r => (!data || r.data === data) && (!salaId || r.salaId === Number(salaId)) && (!status || r.status === status));
        }
        return responder(res, 200, lista);
      }

      if (req.method === 'DELETE' && id !== null) {
        if (tipo === 'salas' && banco.reservas.some(r => r.salaId === id)) erro('Sala possui reservas vinculadas.', 409);
        const novoBanco = { ...banco, [tipo]: banco[tipo].filter(item => item.id !== id) };
        fs.writeFileSync(arquivo, JSON.stringify(novoBanco, null, 2));
        banco = novoBanco;
        return responder(res, 200, { mensagem: 'Registro excluído.' });
      }

      if ((req.method === 'POST' && id === null) || (req.method === 'PUT' && id !== null)) {
        const dados = await lerDados(req);
        if (id !== null && !banco[tipo].some(item => item.id === id)) return responder(res, 404, { erro: 'Registro não encontrado.' });
        const validado = tipo === 'salas' ? validarSala(dados) : validarReserva(dados, id);
        const contador = tipo === 'salas' ? 'proximaSala' : 'proximaReserva';
        const novo = { id: id === null ? banco[contador] : id, ...validado };
        const novoBanco = { ...banco };
        if (id === null) {
          novoBanco[tipo] = [...banco[tipo], novo];
          novoBanco[contador]++;
        } else {
          novoBanco[tipo] = banco[tipo].map(item => item.id === id ? novo : item);
        }
        fs.writeFileSync(arquivo, JSON.stringify(novoBanco, null, 2));
        banco = novoBanco;
        return responder(res, id === null ? 201 : 200, novo);
      }
      return responder(res, 405, { erro: 'Método não permitido nesta rota.' });
    }

    const paginas = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/script.js': ['script.js', 'text/javascript'] };
    const pagina = paginas[url.pathname];
    if (!pagina) return responder(res, 404, { erro: 'Página não encontrada.' });
    if (req.method !== 'GET') return responder(res, 405, { erro: 'Método não permitido.' });
    const conteudo = fs.readFileSync(path.join(__dirname, 'public', pagina[0]));
    res.writeHead(200, { 'Content-Type': pagina[1] + '; charset=utf-8' });
    res.end(conteudo);
  } catch (e) {
    responder(res, e.status || 500, { erro: e.status ? e.message : 'Não foi possível concluir a operação.' });
  }
});

servidor.listen(3000, () => console.log('Acesse http://localhost:3000'));
