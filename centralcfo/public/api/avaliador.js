const db = require('./db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST' && req.query.action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = req.body;

      const avaliador = await db.query(
        `SELECT id FROM usuarios WHERE LOWER(nick_policial) = LOWER($1) AND role IN ('avaliador', 'gestor')`,
        [nickAvaliador]
      );

      if (avaliador.rows.length === 0) {
        return res.status(403).json({ error: "Credencial de Avaliador inválida ou não autorizada." });
      }

      const tokenGerado = "CFO-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      await db.query(
        `INSERT INTO tokens_prova (token, candidato_nick, avaliador_id) VALUES ($1, $2, $3)`,
        [tokenGerado, nickCandidato, avaliador.rows[0].id]
      );

      return res.status(200).json({ token: tokenGerado, candidato: nickCandidato });
    }

    if (req.method === 'GET' && req.query.action === 'listarPendentes') {
      const result = await db.query(`
        SELECT p.id, p.candidato_nick, p.token_utilizado, p.respostas_json, p.submetido_em
        FROM provas_submetidas p
        WHERE p.status = 'Pendente'
        ORDER BY p.submetido_em ASC
      `);

      const questoes = await db.query(`SELECT id, titulo, enunciado, gabarito_esperado FROM questoes`);

      return res.status(200).json({ provas: result.rows, bancoQuestoes: questoes.rows });
    }

    if (req.method === 'POST' && req.query.action === 'corrigir') {
      const { provaId, nota, feedback, nickAvaliador } = req.body;

      const avaliador = await db.query(`SELECT id FROM usuarios WHERE LOWER(nick_policial) = LOWER($1)`, [nickAvaliador]);

      await db.query(`
        UPDATE provas_submetidas
        SET nota = $1, feedback_avaliador = $2, status = 'Corrigido', avaliador_id = $3, corrigido_em = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [nota, feedback, avaliador.rows[0]?.id || null, provaId]);

      return res.status(200).json({ success: true, message: "Avaliação registrada!" });
    }

    return res.status(400).json({ error: "Ação inválida." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
