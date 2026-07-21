const db = require('./db.js');

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 1. Minhas Avaliações (Finalizadas / Em Avaliação)
    if (req.method === 'GET' && action === 'minhasAvaliacoes') {
      const { nick } = req.query;
      const provas = await sql`
        SELECT p.id, p.token_utilizado, p.status, p.nota, p.feedback_avaliador, p.respostas_json, p.criado_em, p.corrigido_em
        FROM provas p
        WHERE p.candidato_nick = ${nick}
        ORDER BY p.criado_em DESC
      `;
      const questoes = await sql`SELECT id, categoria, titulo, enunciado, gabarito_esperado FROM questoes`;
      return res.status(200).json({ provas, questoes });
    }

    // 2. Enviar Nova Dúvida
    if (req.method === 'POST' && action === 'enviarDuvida') {
      const { nick, titulo, pergunta } = req.body;
      await sql`
        INSERT INTO duvidas (aluno_nick, titulo, pergunta)
        VALUES (${nick}, ${titulo}, ${pergunta})
      `;
      return res.status(200).json({ success: true, message: 'Dúvida enviada com sucesso!' });
    }

    // 3. Minhas Dúvidas
    if (req.method === 'GET' && action === 'minhasDuvidas') {
      const { nick } = req.query;
      const duvidas = await sql`
        SELECT * FROM duvidas WHERE aluno_nick = ${nick} ORDER BY criado_em DESC
      `;
      return res.status(200).json({ duvidas });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
