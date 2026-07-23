const { db } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    const { usuario, senha } = body;
    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Informe usuário e senha.' });
    }

    const nickBusca = String(usuario).trim().toLowerCase();

    const snap = await db.collection('usuarios')
      .where('nickBusca', '==', nickBusca)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const doc = snap.docs[0];
    const user = doc.data();

    const senhaConfere = await bcrypt.compare(String(senha), user.senhaHash || '');
    if (!senhaConfere) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: doc.id,
        nome: user.nome,
        nick: user.nickPolicial,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Erro em api/auth.js:', err);
    return res.status(500).json({ error: 'Erro no servidor.', message: err.message });
  }
};
