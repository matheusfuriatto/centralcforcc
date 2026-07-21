const db = require('./db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { usuario, senha } = req.body;

    try {
      const result = await db.query(
        `SELECT id, nome, nick_policial, role FROM usuarios WHERE LOWER(nick_policial) = LOWER($1) AND senha = $2`,
        [usuario, senha]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      }

      const user = result.rows[0];
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          nome: user.nome,
          nick: user.nick_policial,
          role: user.role
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
};
