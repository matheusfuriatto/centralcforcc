const db = require('./db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // 1. Enviar Nova Dúvida
    if (req.method === 'POST' && action === 'criarDuvida') {
      const { alunoNick, titulo, pergunta } = body;

      if (!alunoNick || !titulo || !pergunta) {
        return res.status(400).json({ error: 'Preencha todos os campos da dúvida.' });
      }

      await db.query(
        'INSERT INTO duvidas (aluno_nick, titulo, pergunta, status) VALUES ($1, $2, $3, $4)',
        [alunoNick.trim(), titulo.trim(), pergunta.trim(), 'Pendente']
      );

      return res.status(200).json({ success: true, message: 'Dúvida enviada com sucesso!' });
    }

    // 2. Submeter Respostas da Prova pelo Token
    if (req.method === 'POST' && action === 'submeterProva') {
      const { token, respostas } = body;

      const prova = await db.query('SELECT id FROM provas WHERE token_utilizado = $1 AND status = $2', [token, 'Pendente']);

      if (!prova.rows || prova.rows.length === 0) {
        return res.status(404).json({ error: 'Token inválido ou prova já realizada.' });
      }

      await db.query(
        'UPDATE provas SET respostas_json = $1, status = $2 WHERE token_utilizado = $3',
        [JSON.stringify(respostas), 'Aguardando Correção', token]
      );

      return res.status(200).json({ success: true, message: 'Avaliação enviada para correção!' });
    }

    return res.status(400).json({ error: 'Ação inválida para o aluno.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
