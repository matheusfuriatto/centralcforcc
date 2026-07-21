const db = require('./db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // 1. Gerar Token (Separado da Avaliação)
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;

      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';

      // Criar/Garantir Usuário
      const cand = await db.query('SELECT id FROM usuarios WHERE nick_policial = $1', [nickLimpo]);
      let senhaGerada = null;

      if (!cand.rows || cand.rows.length === 0) {
        senhaGerada = 'cfo123';
        await db.query(
          'INSERT INTO usuarios (nome, nick_policial, senha, role) VALUES ($1, $2, $3, $4)',
          [nickLimpo, nickLimpo, senhaGerada, 'candidato']
        );
      }

      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await db.query(
        'INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status) VALUES ($1, $2, $3, $4)',
        [token, nickLimpo, avaliadorLimpo, 'Pendente']
      );

      return res.status(200).json({
        token,
        nick: nickLimpo,
        senhaGerada,
        message: senhaGerada
          ? `Conta criada para ${nickLimpo}! Senha: ${senhaGerada}`
          : `Token gerado para ${nickLimpo}.`
      });
    }

    // 2. Listar Avaliações (Retorna todas as provas e todas as questões do banco)
    if (req.method === 'GET' && action === 'listarProvas') {
      const nick = req.query ? req.query.nick : '';

      const provas = await db.query(
        'SELECT * FROM provas WHERE avaliador_nick = $1 OR $1 = \'\' ORDER BY id DESC',
        [nick]
      );
      const questoes = await db.query('SELECT * FROM questoes ORDER BY id ASC');

      return res.status(200).json({
        provas: provas.rows || [],
        questoes: questoes.rows || []
      });
    }

    // 3. Corrigir Avaliação
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = body;

      await db.query(
        'UPDATE provas SET nota = $1, feedback_avaliador = $2, status = $3, corrigido_em = NOW() WHERE id = $4',
        [nota, feedback, 'Corrigido', provaId]
      );

      return res.status(200).json({ success: true, message: 'Avaliação corrigida com sucesso!' });
    }

    // 4. Listar Dúvidas (Para o Painel do Avaliador e Aluno)
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const aluno = req.query ? req.query.alunoNick : null;

      let duvidas;
      if (aluno) {
        duvidas = await db.query('SELECT * FROM duvidas WHERE aluno_nick = $1 ORDER BY id DESC', [aluno]);
      } else {
        duvidas = await db.query('SELECT * FROM duvidas ORDER BY id DESC');
      }

      return res.status(200).json({ duvidas: duvidas.rows || [] });
    }

    // 5. Assumir Dúvida
    if (req.method === 'POST' && action === 'assumirDuvida') {
      const { id, nickAvaliador } = body;

      await db.query(
        'UPDATE duvidas SET avaliador_nick = $1, status = $2 WHERE id = $3',
        [nickAvaliador, 'Em Andamento', id]
      );

      return res.status(200).json({ success: true });
    }

    // 6. Responder Dúvida
    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta } = body;

      await db.query(
        'UPDATE duvidas SET resposta = $1, status = $2, respondido_em = NOW() WHERE id = $3',
        [resposta, 'Respondida', id]
      );

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    console.error('Erro na API Avaliador:', err);
    return res.status(500).json({
      error: 'Erro na execução da Serverless Function',
      message: err.message
    });
  }
};
