import { sql } from './_db.js';

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'dashboard') {
      const usuarios = await sql`SELECT id, nome, nick_policial, role FROM usuarios ORDER BY id DESC`;
      const questoes = await sql`SELECT id, categoria, titulo, enunciado FROM questoes ORDER BY id DESC`;
      const relatorios = await sql`
        SELECT p.id, p.candidato_nick, p.avaliador_nick, p.nota, p.status, p.corrigido_em
        FROM provas p ORDER BY p.criado_em DESC
      `;

      return res.status(200).json({ usuarios, questoes, relatorios });
    }

    if (req.method === 'POST' && action === 'cadastrarUsuario') {
      const { nome, nick, senha, role } = req.body;
      await sql`
        INSERT INTO usuarios (nome, nick_policial, senha, role)
        VALUES (${nome}, ${nick}, ${senha}, ${role})
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'removerUsuario') {
      const { id } = req.body;
      await sql`DELETE FROM usuarios WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'cadastrarQuestao') {
      const { categoria, titulo, enunciado, gabarito } = req.body;
      await sql`
        INSERT INTO questoes (categoria, titulo, enunciado, gabarito_esperado)
        VALUES (${categoria}, ${titulo}, ${enunciado}, ${gabarito})
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirQuestao') {
      const { id } = req.body;
      await sql`DELETE FROM questoes WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não permitida' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
