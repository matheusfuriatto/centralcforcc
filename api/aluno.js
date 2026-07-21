const db = require('./db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // 1. Cadastrar Nova Dúvida do Aluno
    if (req.method === 'POST' && action === 'criarDuvida') {
      const { alunoNick, titulo, pergunta } = body;

      if (!alunoNick || !titulo || !pergunta) {
        return res.status(400).json({ error: 'Preencha todos os campos para enviar a dúvida.' });
      }

      const result = await db.query(
        'INSERT INTO duvidas (aluno_nick, titulo, pergunta, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [alunoNick.trim(), titulo.trim(), pergunta.trim(), 'Pendente']
      );

      return res.status(200).json({ success: true, message: 'Dúvida enviada!', duvida: result.rows[0] });
    }

    // 2. Listar Dúvidas de um Aluno Específico
    if (req.method === 'GET' && action === 'minhasDuvidas') {
      const alunoNick = req.query.alunoNick;
      if (!alunoNick) return res.status(400).json({ error: 'Nick do aluno não informado.' });

      const duvidas = await db.query(
        'SELECT * FROM duvidas WHERE LOWER(aluno_nick) = LOWER($1) ORDER BY id DESC',
        [alunoNick.trim()]
      );

      return res.status(200).json({ duvidas: duvidas.rows || [] });
    }

    // 3. Buscar Avaliação pelo Token e Selecionar Questões Randômicas
    if (req.method === 'GET' && action === 'buscarProva') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Informe o Token da Avaliação.' });

      const prova = await db.query('SELECT * FROM provas WHERE token_utilizado = $1', [token.trim()]);

      if (!prova.rows || prova.rows.length === 0) {
        return res.status(404).json({ error: 'Token não encontrado ou inválido.' });
      }

      const dadosProva = prova.rows[0];

      // Se a prova já possui questões sorteadas salvas, retorna elas
      if (dadosProva.questoes_json) {
        return res.status(200).json({ prova: dadosProva });
      }

      // Se for a primeira vez que o aluno acessa, sorteia 10 questões randômicas
      const questoesRand = await db.query('SELECT * FROM questoes ORDER BY RANDOM() LIMIT 10');

      if (questoesRand.rows.length === 0) {
        return res.status(400).json({ error: 'O banco de questões está vazio. Peça ao gestor para povoar as questões.' });
      }

      // Salva as questões sorteadas na prova
      await db.query(
        'UPDATE provas SET questoes_json = $1, status = $2 WHERE token_utilizado = $3',
        [JSON.stringify(questoesRand.rows), 'Em Andamento', token.trim()]
      );

      dadosProva.questoes_json = questoesRand.rows;
      dadosProva.status = 'Em Andamento';

      return res.status(200).json({ prova: dadosProva });
    }

    // 4. Submeter Respostas da Avaliação pelo Aluno
    if (req.method === 'POST' && action === 'submeterProva') {
      const { token, respostas } = body;

      if (!token || !respostas) {
        return res.status(400).json({ error: 'Token ou respostas ausentes.' });
      }

      await db.query(
        'UPDATE provas SET respostas_json = $1, status = $2 WHERE token_utilizado = $3',
        [JSON.stringify(respostas), 'Aguardando Correção', token.trim()]
      );

      return res.status(200).json({ success: true, message: 'Avaliação entregue com sucesso!' });
    }

    return res.status(400).json({ error: 'Ação não reconhecida para Alunos.' });
  } catch (err) {
    console.error('Erro no api/aluno.js:', err);
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
