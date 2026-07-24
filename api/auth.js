const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.query ? req.query.action : null;
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Login Tradicional
    if (req.method === 'POST' && (!action || action === 'login')) {
      const { usuario, senha } = body;
      if (!usuario || !senha) return res.status(400).json({ error: 'Informe usuário e senha.' });

      const nickBusca = String(usuario).trim().toLowerCase();
      const snap = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();

      if (snap.empty) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

      const doc = snap.docs[0];
      const user = doc.data();

      // Impede login de solicitações pendentes
      if (user.statusAprovacao === 'Pendente') {
        return res.status(403).json({ error: 'Sua solicitação de acesso ainda está aguardando aprovação da Gestão.' });
      }

      const senhaConfere = await bcrypt.compare(String(senha), user.senhaHash || '');
      if (!senhaConfere) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

      return res.status(200).json({
        success: true,
        user: { id: doc.id, nome: user.nome, nick: user.nickPolicial, role: user.role }
      });
    }

    // 2. Solicitar Acesso (Página do Login - "Não tem acesso?")
    if (req.method === 'POST' && action === 'solicitarAcesso') {
      const { nick, senha } = body;
      if (!nick || !senha) return res.status(400).json({ error: 'Nick e senha são obrigatórios.' });

      const nickLimpo = String(nick).trim();
      const nickBusca = nickLimpo.toLowerCase();

      const usuarioExistente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();
      if (!usuarioExistente.empty) {
        return res.status(400).json({ error: 'Já existe um cadastro ou solicitação para este Nick.' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);
      await db.collection('usuarios').add({
        nome: nickLimpo,
        nickPolicial: nickLimpo,
        nickBusca,
        senhaHash,
        role: 'candidato', // Padrão inicial
        statusAprovacao: 'Pendente', // Aguarda aprovação do Avaliador/Gestor
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Solicitação enviada! Aguarde a aprovação da Gestão/Avaliador.' });
    }

    // 3. Alterar a Própria Senha (Aluno/Avaliador/Gestor)
    if (req.method === 'POST' && action === 'alterarMinhaSenha') {
      const { nick, senhaAtual, novaSenha } = body;
      if (!nick || !novaSenha) return res.status(400).json({ error: 'Dados incompletos.' });

      const nickBusca = String(nick).trim().toLowerCase();
      const snap = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();

      if (snap.empty) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const docRef = snap.docs[0].ref;
      const user = snap.docs[0].data();

      if (senhaAtual) {
        const confere = await bcrypt.compare(String(senhaAtual), user.senhaHash || '');
        if (!confere) return res.status(400).json({ error: 'Senha atual incorreta.' });
      }

      const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
      await docRef.update({ senhaHash: novaSenhaHash });

      return res.status(200).json({ success: true, message: 'Senha alterada com sucesso!' });
    }

    return res.status(400).json({ error: 'Ação não permitida.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
