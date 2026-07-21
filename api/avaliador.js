const db = require('./db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // 1. Gerar Token de Avaliação Randômica
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;

      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';

      // Gerar Token
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await db.query(
        'INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status) VALUES ($1, $2, $3, $4)',
        [token, nickLimpo, avaliadorLimpo, 'Pendente']
      );

      return res.status(200).json({
        token,
        nick: nickLimpo,
        message: `Token gerado para o candidato ${nickLimpo}!`
      });
    }

    // 2. Listar Avaliações para o Avaliador
    if (req.method === 'GET' && action === 'listarProvas') {
      const nickAvaliador = req.query.nick || '';

      const provas = await db.query(
        'SELECT * FROM provas WHERE LOWER(avaliador_nick) = LOWER($1) OR $1 = \'\' ORDER BY id DESC',
        [nickAvaliador.trim()]
      );

      return res.status(200).json({ provas: provas.rows || [] });
    }

    // 3. Atribuir Correção, Nota e Feedback à Avaliação
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = body;

      if (!provaId || nota === undefined) {
        return res.status(400).json({ error: 'ID da prova e nota são obrigatórios.' });
      }

      await db.query(
        'UPDATE provas SET nota = $1, feedback_avaliador = $2, status = $3, corrigido_em = NOW() WHERE id = $4',
        [parseFloat(nota), feedback || '', 'Corrigido', provaId]
      );

      return res.status(200).json({ success: true, message: 'Avaliação corrigida com sucesso!' });
    }

    // 4. Listar Todas as Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const duvidas = await db.query('SELECT * FROM duvidas ORDER BY id DESC');
      return res.status(200).json({ duvidas: duvidas.rows || [] });
    }

    // 5. Responder Dúvida do Aluno
    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta, nickAvaliador } = body;

      if (!id || !resposta) {
        return res.status(400).json({ error: 'ID da dúvida e resposta são necessários.' });
      }

      await db.query(
        'UPDATE duvidas SET resposta = $1, avaliador_nick = $2, status = $3, respondido_em = NOW() WHERE id = $4',
        [resposta.trim(), nickAvaliador || 'Avaliador', 'Respondida', id]
      );

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    console.error('Erro na API Avaliador:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
