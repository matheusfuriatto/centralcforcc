const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

function gerarSenhaAleatoria() {
  return Math.random().toString(36).slice(-8);
}

function normalizarQuestao(q) {
  return {
    id: q.id,
    categoria: q.categoria || 'Geral',
    titulo: q.titulo || '',
    enunciado: q.enunciado || q.titulo || '',
    gabarito_esperado: q.gabarito_esperado || q.gabaritoEsperado || q.gabarito || 'Gabarito não cadastrado'
  };
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

      let senhaGerada = null;
      const usuarioExistente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();

      if (usuarioExistente.empty) {
        senhaGerada = gerarSenhaAleatoria();
        const senhaHash = await bcrypt.hash(senhaGerada, 10);
        await db.collection('usuarios').add({
          nome: nickLimpo,
          nickPolicial: nickLimpo,
          nickBusca,
          senhaHash,
          role: 'candidato',
          statusAprovacao: 'Aprovado',
          criadoEm: FieldValue.serverTimestamp()
        });
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
        message: senhaGerada
          ? 'Nova conta criada e token liberado!'
          : 'Novo token liberado para candidato existente (a senha mantida é a cadastrada).'
      });
    }

    // 3. Listar e Revogar Tokens
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

    if (req.method === 'DELETE' && action === 'revogarToken') {
      const { id } = body;
      await db.collection('provas').doc(id).delete();
      return res.status(200).json({ success: true, message: 'Token revogado com sucesso!' });
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

    // 5. Cancelar ou Excluir Prova
    if (req.method === 'POST' && action === 'cancelarProva') {
      const { id } = body;
      await db.collection('provas').doc(id).update({ status: 'Cancelada', canceladoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirProva') {
      const { id } = body;
      await db.collection('provas').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    // 6. Provas e Correção com Garantia de Gabarito
    if (req.method === 'GET' && action === 'listarProvas') {
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({
        provas: snap.docs.map(d => {
          const data = d.data();
          const qRaw = data.questoesJson || [];
          return {
            id: d.id,
            tokenUtilizado: data.tokenUtilizado,
            candidatoNick: data.candidatoNick,
            avaliadorNick: data.avaliadorNick,
            status: data.status,
            nota: data.nota !== undefined ? data.nota : null,
            feedbackAvaliador: data.feedbackAvaliador || null,
            feedbacksQuestoes: data.feedbacksQuestoes || {},
            respostasJson: data.respostasJson || {},
            questoesJson: qRaw.map(normalizarQuestao)
          };
        })
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

    // 7. Enviar Sugestão de Questão
    if (req.method === 'POST' && action === 'sugerirQuestao') {
      const { avaliadorNick, categoria, titulo, enunciado, gabarito_esperado } = body;
      if (!enunciado || !gabarito_esperado) {
        return res.status(400).json({ error: 'Preencha enunciado e gabarito.' });
      }

      await db.collection('sugestoes_questoes').add({
        avaliadorNick: avaliadorNick || 'Avaliador',
        categoria: categoria || 'Geral',
        titulo: titulo || '',
        enunciado: enunciado.trim(),
        gabarito_esperado: gabarito_esperado.trim(),
        status: 'Pendente',
        observacaoGestor: '',
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Sugestão enviada à gestão!' });
    }

    if (req.method === 'GET' && action === 'minhasSugestoes') {
      const nick = req.query.nick;
      const snap = await db.collection('sugestoes_questoes').where('avaliadorNick', '==', nick).get();
      return res.status(200).json({ sugestoes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 8. Listar Práticas de BBCode
    if (req.method === 'GET' && action === 'listarPraticasBBCode') {
      const snap = await db.collection('praticas_bbcode').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({ praticas: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 9. Avaliar Prática de BBCode
    if (req.method === 'POST' && action === 'avaliarPraticaBBCode') {
      const { id, avaliadorNick, feedback, status } = body;
      if (!id || !feedback) return res.status(400).json({ error: 'Feedback é obrigatório.' });

      await db.collection('praticas_bbcode').doc(id).update({
        avaliadorNick: avaliadorNick || 'Avaliador',
        feedbackAvaliador: feedback.trim(),
        status: status || 'Avaliada',
        avaliadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Feedback enviado com sucesso!' });
    }

    // 10. Central de Dúvidas
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

    // 11. Documentos
    if (req.method === 'GET' && action === 'listarDocumentos') {
      const snap = await db.collection('documentos').orderBy('titulo', 'asc').get();
      return res.status(200).json({ documentos: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
