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

    // 1. Habbo Profile
    if (req.method === 'GET' && action === 'habboProfile') {
      const nick = req.query.nick;
      if (!nick) return res.status(400).json({ error: 'Nick não informado' });

      try {
        const response = await fetch(`https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`);
        if (!response.ok) return res.status(200).json({ online: false, lastAccess: 'Não encontrado' });
        const data = await response.json();
        return res.status(200).json({
          online: data.online || false,
          lastAccess: data.lastAccessTime ? new Date(data.lastAccessTime).toLocaleString('pt-BR') : 'Privado/Indisponível'
        });
      } catch (e) {
        return res.status(200).json({ online: false, lastAccess: 'Indisponível' });
      }
    }

    // 2. Gerar Token e Senha
    if (req.method === 'POST' && action === 'gerarToken') {
      const { nickAvaliador, nickCandidato } = body;
      if (!nickCandidato || !String(nickCandidato).trim()) {
        return res.status(400).json({ error: 'Informe o nick do candidato.' });
      }

      const nickLimpo = String(nickCandidato).trim();
      const nickBusca = nickLimpo.toLowerCase();
      const avaliadorLimpo = nickAvaliador ? String(nickAvaliador).trim() : 'Avaliador';
      const token = 'CFO-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      const senhaGerada = gerarSenhaAleatoria();
      const senhaHash = await bcrypt.hash(senhaGerada, 10);

      const usuarioExistente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();

      if (usuarioExistente.empty) {
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
        senhaGerada,
        message: 'Token gerado com sucesso!'
      });
    }

    // 3. Listar Tokens Emitidos
    if (req.method === 'GET' && action === 'listarTokens') {
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      const tokens = snap.docs.map(d => ({
        id: d.id,
        token_utilizado: d.data().tokenUtilizado,
        candidato_nick: d.data().candidatoNick,
        avaliador_nick: d.data().avaliadorNick,
        status: d.data().status,
        criado_em: d.data().criadoEm
      }));
      return res.status(200).json({ tokens });
    }

    // 4. Solicitações de Acesso
    if (req.method === 'GET' && action === 'listarSolicitacoes') {
      const snap = await db.collection('usuarios').where('statusAprovacao', '==', 'Pendente').get();
      return res.status(200).json({ solicitacoes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST' && action === 'aprovarSolicitacao') {
      const { id, role } = body;
      await db.collection('usuarios').doc(id).update({ role, statusAprovacao: 'Aprovado', aprovadoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'recusarSolicitacao') {
      await db.collection('usuarios').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    // 5. Provas e Correção
    if (req.method === 'GET' && action === 'listarProvas') {
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({
        provas: snap.docs.map(d => ({
          id: d.id,
          tokenUtilizado: d.data().tokenUtilizado,
          candidatoNick: d.data().candidatoNick,
          avaliadorNick: d.data().avaliadorNick,
          status: d.data().status,
          nota: d.data().nota !== undefined ? d.data().nota : null,
          feedbackAvaliador: d.data().feedbackAvaliador || null,
          feedbacksQuestoes: d.data().feedbacksQuestoes || {},
          respostasJson: d.data().respostasJson || {},
          questoesJson: d.data().questoesJson || []
        }))
      });
    }

    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedbackGeral, feedbacksQuestoes } = body;
      await db.collection('provas').doc(provaId).update({
        nota: parseFloat(nota),
        feedbackAvaliador: feedbackGeral || '',
        feedbacksQuestoes: feedbacksQuestoes || {},
        status: 'Corrigido',
        corrigidoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    // 6. Central de Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const snap = await db.collection('duvidas').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({ duvidas: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST' && action === 'assumirDuvida') {
      await db.collection('duvidas').doc(body.id).update({ avaliadorNick: body.nickAvaliador || 'Avaliador', status: 'Em Andamento' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'responderDuvida') {
      await db.collection('duvidas').doc(body.id).update({ resposta: body.resposta.trim(), avaliadorNick: body.nickAvaliador || 'Avaliador', status: 'Respondida', respondidoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    // 7. Central de Documentos
    if (req.method === 'GET' && action === 'listarDocumentos') {
      const snap = await db.collection('documentos').orderBy('titulo', 'asc').get();
      return res.status(200).json({ documentos: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 8. Análise Estatística / Índice de Erros por Questão
    if (req.method === 'GET' && action === 'analiseQuestoes') {
      const snapProvas = await db.collection('provas').where('status', '==', 'Corrigido').get();
      const contagem = {};

      snapProvas.docs.forEach(doc => {
        const p = doc.data();
        const questoes = p.questoesJson || [];
        const fbs = p.feedbacksQuestoes || {};

        questoes.forEach(q => {
          if (!contagem[q.id]) {
            contagem[q.id] = { id: q.id, enunciado: q.enunciado || q.titulo, totalRespostas: 0, errosObs: 0 };
          }
          contagem[q.id].totalRespostas++;
          if (fbs[q.id] && fbs[q.id].length > 0) {
            contagem[q.id].errosObs++;
          }
        });
      });

      return res.status(200).json({ estatisticas: Object.values(contagem) });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
