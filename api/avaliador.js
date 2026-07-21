import { sql } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const { action } = req.query;

  // Processar body
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
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'MatheusLatrel';

      // Checar se o usuário já existe
      const cand = await sql`
        SELECT id FROM usuarios WHERE nick_policial = ${nickLimpo}
      `;

      let senhaGerada = null;

      if (cand.length === 0) {
        senhaGerada = 'cfo123';
        await sql`
          INSERT INTO usuarios (nome, nick_policial, senha, role)
          VALUES (${nickLimpo}, ${nickLimpo}, ${senhaGerada}, 'candidato')
        `;
      } else {
        await sql`
          UPDATE usuarios SET role = 'candidato' WHERE nick_policial = ${nickLimpo}
        `;
      }

      // Gerar Token
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Gravar na tabela de provas
      await sql`
        INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status)
        VALUES (${token}, ${nickLimpo}, ${avaliadorLimpo}, 'Pendente')
      `;

      return res.status(200).json({
        token,
        nick: nickLimpo,
        senhaGerada,
        message: senhaGerada
          ? `Conta criada para ${nickLimpo}! Senha: ${senhaGerada}`
          : `Token gerado para ${nickLimpo}.`
      });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (error) {
    console.error('Erro no Backend:', error);
    return res.status(500).json({
      error: 'Erro no Banco de Dados',
      detalhe: error.message || String(error)
    });
  }
}
