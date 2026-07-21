const db = require('./_db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    // 1. Gerar Token / Cadastrar Avaliado
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;

      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';

      // Verificar se o usuário existe no DB Neon
      const cand = await db.query(
        'SELECT id FROM usuarios WHERE nick_policial = $1',
        [nickLimpo]
      );

      let senhaGerada = null;

      if (!cand.rows || cand.rows.length === 0) {
        senhaGerada = 'cfo123';
        await db.query(
          'INSERT INTO usuarios (nome, nick_policial, senha, role) VALUES ($1, $2, $3, $4)',
          [nickLimpo, nickLimpo, senhaGerada, 'candidato']
        );
      } else {
        await db.query(
          'UPDATE usuarios SET role = $1 WHERE nick_policial = $2',
          ['candidato', nickLimpo]
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
          ? `Conta criada para ${nickLimpo}! Senha inicial: ${senhaGerada}`
          : `Token gerado para ${nickLimpo}.`
      });
    }

    // 2. Listar Provas
    if (req.method === 'GET' && action === 'listarProvas') {
      const nick = req.query ? req.query.nick : '';
      const provas = await db.query('SELECT * FROM provas WHERE avaliador_nick = $1 ORDER BY id DESC', [nick]);
      const questoes = await db.query('SELECT * FROM questoes ORDER BY id ASC');

      return res.status(200).json({
        provas: provas.rows || [],
        questoes: questoes.rows || []
      });
    }

    return res.status(400).json({ error: 'Ação não informada ou inválida' });
  } catch (err) {
    // Retorna a mensagem real de erro do Postgres em formato JSON
    return res.status(500).json({
      error: 'Erro na execução da Serverless Function',
      message: err.message,
      stack: err.stack
    });
  }
};
