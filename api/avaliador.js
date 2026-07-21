const db = require('./_db.js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { action } = req.query;

  // Tratar parsing do corpo da requisição (JSON ou String)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  try {
    // 1. Gerar Token / Cadastrar Avaliado
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;

      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';

      // Verificar se o candidato já existe
      const cand = await db.query(
        'SELECT id FROM usuarios WHERE nick_policial = $1',
        [nickLimpo]
      );

      let senhaGerada = null;

      // Se não existir, cria a conta do aluno com senha padrão
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

      // Gerar Token Único
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Inserir a prova
      await db.query(
        'INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status) VALUES ($1, $2, $3, $4)',
        [token, nickLimpo, avaliadorLimpo, 'Pendente']
      );

      return res.status(200).json({
        token,
        nick: nickLimpo,
        senhaGerada,
        message: senhaGerada
          ? `Conta criada com sucesso para ${nickLimpo}! Senha inicial: ${senhaGerada}`
          : `Token gerado para o candidato ${nickLimpo}.`
      });
    }

    // 2. Listar Provas do Avaliador
    if (req.method === 'GET' && action === 'listarProvas') {
      const { nick } = req.query;
      const nickAvaliador = nick || '';

      const provas = await db.query(
        'SELECT * FROM provas WHERE avaliador_nick = $1 ORDER BY criado_em DESC',
        [nickAvaliador]
      );
      const questoes = await db.query('SELECT * FROM questoes ORDER BY id ASC');

      return res.status(200).json({
        provas: provas.rows,
        questoes: questoes.rows
      });
    }

    // 3. Submeter Correção
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = body;

      await db.query(
        'UPDATE provas SET nota = $1, feedback_avaliador = $2, status = $3, corrigido_em = NOW() WHERE id = $4',
        [nota, feedback, 'Corrigido', provaId]
      );

      return res.status(200).json({ success: true, message: 'Avaliação corrigida!' });
    }

    // 4. Central de Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const duvidas = await db.query('SELECT * FROM duvidas ORDER BY criado_em DESC');
      return res.status(200).json({ duvidas: duvidas.rows });
    }

    if (req.method === 'POST' && action === 'assumirDuvida') {
      const { id, nickAvaliador } = body;

      await db.query(
        'UPDATE duvidas SET avaliador_nick = $1, status = $2 WHERE id = $3',
        [nickAvaliador, 'Em Andamento', id]
      );

      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta } = body;

      await db.query(
        'UPDATE duvidas SET resposta = $1, status = $2, respondido_em = NOW() WHERE id = $3',
        [resposta, 'Respondida', id]
      );

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (error) {
    console.error('Erro na API Avaliador:', error);
    return res.status(500).json({
      error: 'Erro interno no servidor',
      detalhe: error.message || String(error)
    });
  }
};
