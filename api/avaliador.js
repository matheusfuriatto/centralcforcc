const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

function gerarSenhaAleatoria() {
  return Math.random().toString(36).slice(-8);
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // Corrigida Geração de Senha
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;
      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const nickBusca = nickLimpo.toLowerCase();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      let senhaExibicao = null;
      const usuarioExistente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();

      if (usuarioExistente.empty) {
        senhaExibicao = gerarSenhaAleatoria();
        const senhaHash = await bcrypt.hash(senhaExibicao, 10);
        await db.collection('usuarios').add({
          nome: nickLimpo,
          nickPolicial: nickLimpo,
          nickBusca,
          senhaHash,
          role: 'candidato',
          statusAprovacao: 'Aprovado',
          criadoEm: FieldValue.serverTimestamp()
        });
      } else {
        // Se a conta já existe mas o avaliador precisa passar/redefinir a senha do candidato
        senhaExibicao = gerarSenhaAleatoria();
        const senhaHash = await bcrypt.hash(senhaExibicao, 10);
        await usuarioExistente.docs[0].ref.update({ senhaHash, statusAprovacao: 'Aprovado' });
      }

      await db.collection('provas').add({
        tokenUtilizado: token,
        candidatoNick: nickLimpo,
        candidatoNickBusca: nickBusca,
        avaliadorNick: avaliadorLimpo,
        status: 'Pendente',
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        token,
        nick: nickLimpo,
        senhaGerada: senhaExibicao,
        message: `Token gerado com sucesso! Passe a senha abaixo para o candidato.`
      });
    }

    // Listar Solicitações de Acesso Pendentes
    if (req.method === 'GET' && action === 'listarSolicitacoes') {
      const snap = await db.collection('usuarios').where('statusAprovacao', '==', 'Pendente').get();
      const solicitacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ solicitacoes });
    }

    // Aprovar Solicitação de Acesso e Definir Cargo
    if (req.method === 'POST' && action === 'aprovarSolicitacao') {
      const { id, role } = body;
      if (!id || !role) return res.status(400).json({ error: 'ID e Cargo são obrigatórios.' });

      await db.collection('usuarios').doc(id).update({
        role,
        statusAprovacao: 'Aprovado',
        aprovadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Usuário aprovado com sucesso!' });
    }

    // Recusar Solicitação
    if (req.method === 'POST' && action === 'recusarSolicitacao') {
      const { id } = body;
      await db.collection('usuarios').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    // Listar Provas, Dúvidas e Documentos...
    if (req.method === 'GET' && action === 'listarProvas') {
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({ provas: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
