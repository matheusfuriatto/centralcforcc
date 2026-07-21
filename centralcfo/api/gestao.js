const db = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Retorna dashboard completo
    if (req.method === 'GET' && req.query.action === 'dashboard') {
      const usuarios = await db.query(`SELECT * FROM usuarios ORDER BY id DESC`);
      const provas = await db.query(`SELECT * FROM provas_submetidas ORDER BY submetido_em DESC`);
      const questoes = await db.query(`SELECT * FROM questoes ORDER BY id ASC`);

      return res.status(200).json({
        usuarios: usuarios.rows,
        provas: provas.rows,
        questoes: questoes.rows
      });
    }

    // Cadastrar Usuário (Avaliador ou Candidato)
    if (req.method === 'POST' && req.query.action === 'cadastrarUsuario') {
      const { nome, nick, role } = req.body;
      await db.query(
        `INSERT INTO usuarios (nome, nick_policial, role) VALUES ($1, $2, $3)
         ON CONFLICT (nick_policial) DO UPDATE SET role = $3`,
        [nome, nick, role]
      );
      return res.status(200).json({ success: true });
    }

    // Remover Usuário
    if (req.method === 'DELETE' && req.query.action === 'removerUsuario') {
      const { id } = req.query;
      await db.query(`DELETE FROM usuarios WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    }

    // Cadastrar Questão
    if (req.method === 'POST' && req.query.action === 'cadastrarQuestao') {
      const { categoria, titulo, enunciado, gabarito_esperado } = req.body;
      await db.query(
        `INSERT INTO questoes (categoria, titulo, enunciado, gabarito_esperado) VALUES ($1, $2, $3, $4)`,
        [categoria, titulo, enunciado, gabarito_esperado]
      );
      return res.status(200).json({ success: true });
    }

    // Excluir Questão
    if (req.method === 'DELETE' && req.query.action === 'excluirQuestao') {
      const { id } = req.query;
      await db.query(`DELETE FROM questoes WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Ação não permitida." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
