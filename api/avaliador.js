import { sql } from './_db.js';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 1. Gerar Token / Cadastrar Avaliado
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = req.body;
      const cand = await sql`SELECT id FROM usuarios WHERE nick_policial = ${nickCandidato} AND role = 'candidato'`;
      if (cand.length === 0) return res.status(404).json({ error: 'Candidato não encontrado.' });

      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await sql`
        INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status)
        VALUES (${token}, ${nickCandidato}, ${nickAvaliador}, 'Pendente')
      `;
      return res.status(200).json({ token });
    }

    // 2. Ver Tokens Gerados e Avaliações Enviadas
    if (req.method === 'GET' && action === 'listarProvas') {
      const { nick } = req.query;
      const provas = await sql`
        SELECT * FROM provas WHERE avaliador_nick = ${nick} ORDER BY criado_em DESC
      `;
      const questoes = await sql`SELECT * FROM questoes ORDER BY id ASC`;
      return res.status(200).json({ provas, questoes });
    }

    // 3. Submeter Correção (Nota e Feedback)
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = req.body;
      await sql`
        UPDATE provas
        SET nota = ${nota}, feedback_avaliador = ${feedback}, status = 'Corrigido', corrigido_em = NOW()
        WHERE id = ${provaId}
      `;
      return res.status(200).json({ success: true, message: 'Avaliação corrigida com sucesso!' });
    }

    // 4. Listar Todas as Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const duvidas = await sql`SELECT * FROM duvidas ORDER BY criado_em DESC`;
      return res.status(200).json({ duvidas });
    }

    // 5. Assumir Dúvida
    if (req.method === 'POST' && action === 'assumirDuvida') {
      const { id, nickAvaliador } = req.body;
      await sql`
        UPDATE duvidas SET avaliador_nick = ${nickAvaliador}, status = 'Em Andamento' WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    }

    // 6. Responder Dúvida
    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta } = req.body;
      await sql`
        UPDATE duvidas SET resposta = ${resposta}, status = 'Respondida', respondido_em = NOW() WHERE id = ${id}
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
