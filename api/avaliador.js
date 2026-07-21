import { sql } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const { action } = req.query;

  // Tratar parsing do corpo da requisição (JSON/String)
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
    // 1. Gerar Token / Cadastrar Avaliado (Popricard88)
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;

      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';

      // Verificar se o candidato já existe
      const cand = await sql`SELECT id FROM usuarios WHERE nick_policial = ${nickLimpo}`;

      let senhaGerada = null;

      // Se não existir, cria a conta do aluno com senha padrão
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

      // Gerar Token Único
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Inserir a prova
      await sql`
        INSERT INTO provas (token_utilizado, candidato_nick, avaliador_nick, status)
        VALUES (${token}, ${nickLimpo}, ${avaliadorLimpo}, 'Pendente')
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

    // 2. Listar Provas do Avaliador
    if (req.method === 'GET' && action === 'listarProvas') {
      const { nick } = req.query;
      const nickAvaliador = nick || '';
      const provas = await sql`SELECT * FROM provas WHERE avaliador_nick = ${nickAvaliador} ORDER BY criado_em DESC`;
      const questoes = await sql`SELECT * FROM questoes ORDER BY id ASC`;
      return res.status(200).json({ provas, questoes });
    }

    // 3. Submeter Correção
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = body;
      await sql`
        UPDATE provas
        SET nota = ${nota}, feedback_avaliador = ${feedback}, status = 'Corrigido', corrigido_em = NOW()
        WHERE id = ${provaId}
      `;
      return res.status(200).json({ success: true, message: 'Avaliação corrigida!' });
    }

    // 4. Central de Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const duvidas = await sql`SELECT * FROM duvidas ORDER BY criado_em DESC`;
      return res.status(200).json({ duvidas });
    }

    if (req.method === 'POST' && action === 'assumirDuvida') {
      const { id, nickAvaliador } = body;
      await sql`UPDATE duvidas SET avaliador_nick = ${nickAvaliador}, status = 'Em Andamento' WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta } = body;
      await sql`UPDATE duvidas SET resposta = ${resposta}, status = 'Respondida', respondido_em = NOW() WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro de execução na Serverless' });
  }
}
