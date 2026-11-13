# Projeto 09 — Reserva de salas

Integrantes: preencher nomes e RAs.

Node.js, NPM, HTML, CSS e JavaScript, sem frameworks ou dependências externas. Requer Node.js 22 ou superior.

## Instalação e execução

Na pasta que contém app.js:

```bash
npm install
npm start
```

Abra http://localhost:3000. Cadastre uma sala antes de cadastrar reservas. Os botões Consultar, Editar e Excluir operam sobre o registro selecionado. A edição preenche o formulário; Limpar inicia um cadastro novo.

Use os filtros para consultar reservas por data, sala e status. Para cancelar uma reserva, edite seu status para Cancelada.

## Regras

- Reservas ativas da mesma sala e data não podem ter horários sobrepostos. Horários consecutivos são permitidos.
- O horário final deve ser posterior ao inicial, no mesmo dia.
- Participantes não podem ultrapassar a capacidade da sala.
- Salas inativas não recebem reservas. Uma reserva existente pode ser cancelada mesmo com a sala inativa.
- Salas com reservas vinculadas, inclusive canceladas, não podem ser excluídas.

## API

POST e PUT recebem JSON, com `Content-Type: application/json`. PUT recebe todos os campos; o ID é gerado pelo servidor.

| Método | Rota | Operação |
| --- | --- | --- |
| GET | /api/salas | Listar salas |
| GET | /api/salas/:id | Consultar sala |
| POST | /api/salas | Cadastrar sala |
| PUT | /api/salas/:id | Editar sala |
| DELETE | /api/salas/:id | Excluir sala |
| GET | /api/reservas | Listar reservas |
| GET | /api/reservas/:id | Consultar reserva |
| POST | /api/reservas | Cadastrar reserva |
| PUT | /api/reservas/:id | Editar reserva |
| DELETE | /api/reservas/:id | Excluir reserva |
| GET | /api/feriados/:ano | Consultar feriados na BrasilAPI |

Substitua `:id` pelo ID do registro e `:ano` pelo ano, por exemplo 2026.

Filtro combinado: `/api/reservas?data=2026-11-20&salaId=1&status=Ativa`. Cada filtro também pode ser usado sozinho.

Exemplo de sala:

```json
{
  "nome": "Laboratório 1",
  "localizacao": "Bloco A",
  "capacidade": 30,
  "recursos": "Computadores e projetor",
  "situacao": "Disponível"
}
```

Situação aceita: Disponível ou Inativa. Se não houver recursos, informe Nenhum.

Exemplo de reserva (use uma salaId existente):

```json
{
  "aluno": "Aluno Exemplo",
  "email": "aluno@exemplo.com",
  "salaId": 1,
  "data": "2026-11-20",
  "horaInicio": "10:00",
  "horaFim": "12:00",
  "participantes": 5,
  "finalidade": "Trabalho em grupo",
  "status": "Ativa"
}
```

Status aceito: Ativa ou Cancelada. Datas usam AAAA-MM-DD; horários usam HH:MM. Capacidade e participantes são inteiros positivos.

Respostas: 200 para consultas, edições e exclusões; 201 para cadastros; 400 para campos ou valores inválidos; 404 para registro ou rota inexistente; 405 para método não permitido; 409 para conflito, sala inativa ou exclusão de sala vinculada; 500 para falha interna; 502 para falha na consulta de feriados. Erros retornam `{"erro":"mensagem"}`. Exclusões retornam `{"mensagem":"Registro excluído."}`. Listagens retornam arrays; consultas, cadastros e edições retornam objetos.

## BrasilAPI e dados

Ao selecionar uma data, a interface chama `/api/feriados/:ano`. O servidor consulta `https://brasilapi.com.br/api/feriados/v1/{ano}`. O aviso de feriado é informativo e não impede a reserva. Se a API falhar, uma mensagem permite continuar usando o sistema. Documentação: https://brasilapi.com.br/docs

Os dados são salvos em `data/db.json` e permanecem após reiniciar. `app.js` contém o servidor e a API. A pasta public contém index.html, style.css e script.js, com comunicação por fetch().

## Entrega

Publique todos os arquivos no GitHub, incluindo package.json, package-lock.json, public e data/db.json. Cada integrante deve publicar o projeto na própria conta e entregar seu link. Mantenha o repositório acessível até o final do semestre.
