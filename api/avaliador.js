import { sql } from './_db.js';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // 1. Gerar Token / Cadastrar Avaliado
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = req.body;

      if (!nickCandidato || !nickCandidato.trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = nickCandidato.trim();

      // Verificar se o candidato já está cadastrado
      const cand = await sql`
        SELECT id FROM usuarios WHERE LOWER(nick_policial) = LOWER(${nickLimpo})
      `;

      let senhaGerada = null;

      // Se o usuário não existir, cria a conta como aluno automaticamente
      if (cand.length === 0) {
        senhaGerada = 'cfo123';
        await sql`
          INSERT INTO usuarios (nome, nick_policial, senha, role)
          VALUES (${nickLimpo}, ${nickLimpo}, ${senhaGerada}, 'candidato')
        `;
      } else {
        await sql`
          UPDATE usuarios SET role = 'candidato' WHERE LOWER(nick_policial) = LOWER(${nickLimpo})
        `;
      }

      // Gerar Token Único
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Cadastrar a prova
      await sql`
        INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status)
        VALUES (${token}, ${nickLimpo}, ${nickAvaliador}, 'Pendente')
      `;

      return res.status(200).json({
        token,
        nick: nickLimpo,
        senhaGerada,
        message: senhaGerada
          ? `Conta criada com sucesso para ${nickLimpo}! Senha inicial: ${senhaGerada}`
          : `Token gerado para o candidato ${nickLimpo}.`
      });
    }

    // 2. Ver Tokens Gerados e Avaliações
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

    // 4. Listar Dúvidas
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
