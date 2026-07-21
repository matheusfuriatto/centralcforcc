const db = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'historico') {
      const { nick } = req.query;
      const result = await db.query(
        `SELECT id, token_utilizado, nota, status, feedback_avaliador, submetido_em
         FROM provas_submetidas
         WHERE LOWER(candidato_nick) = LOWER($1)
         ORDER BY submetido_em DESC`,
        [nick]
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST' && action === 'iniciar') {
      const { nick, token } = req.body;
      const tokenCheck = await db.query(
        `SELECT * FROM tokens_prova WHERE token = $1 AND LOWER(candidato_nick) = LOWER($2) AND usado = FALSE`,
        [token, nick]
      );

      if (tokenCheck.rows.length === 0) {
        return res.status(400).json({ error: "Token inválido, expirado ou não pertence a este candidato." });
      }

      const questoes = await db.query(`SELECT id, categoria, titulo, enunciado FROM questoes`);
      return res.status(200).json({ status: "OK", questoes: questoes.rows });
    }

    if (req.method === 'POST' && action === 'submeter') {
      const { nick, token, respostas } = req.body;

      await db.query(
        `INSERT INTO provas_submetidas (candidato_nick, token_utilizado, respostas_json, status)
         VALUES ($1, $2, $3, 'Pendente')`,
        [nick, token, JSON.stringify(respostas)]
      );

      await db.query(`UPDATE tokens_prova SET usado = TRUE WHERE token = $1`, [token]);

      return res.status(200).json({ success: true, message: "Prova submetida para correção com sucesso!" });
    }

    return res.status(400).json({ error: "Ação não reconhecida." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
