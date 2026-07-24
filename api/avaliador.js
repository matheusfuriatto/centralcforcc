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

    // 1. HABBO PROFILE
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

    // 2. GERAR AVALIAÇÃO
    if (req.method === 'POST' && (action === 'gerarAvaliacao' || action === 'gerarToken')) {
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
          ? 'Avaliação liberada e conta criada com sucesso!'
          : 'Nova avaliação liberada para o candidato (mantida a senha existente).'
      });
    }

    // 3. TOKENS EMITIDOS
    if (req.method === 'GET' && action === 'listarTokens') {
      const snap = await db.collection('provas').get();
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
      await db.collection('provas').doc(body.id).delete();
      return res.status(200).json({ success: true, message: 'Avaliação revogada!' });
    }

    // 4. SOLICITAÇÕES DE ACESSO
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

    // 5. PROVAS E CORREÇÃO
    if (req.method === 'GET' && action === 'listarProvas') {
      const snap = await db.collection('provas').get();
      const provas = snap.docs.map(d => {
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
          notasQuestoes: data.notasQuestoes || {},
          respostasJson: data.respostasJson || {},
          questoesJson: qRaw.map(normalizarQuestao),
          criadoEm: data.criadoEm
        };
      });
      provas.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      return res.status(200).json({ provas });
    }

    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedbackGeral, feedbacksQuestoes, notasQuestoes } = body;
      await db.collection('provas').doc(provaId).update({
        nota: parseFloat(nota),
        feedbackAvaliador: feedbackGeral || '',
        feedbacksQuestoes: feedbacksQuestoes || {},
        notasQuestoes: notasQuestoes || {},
        status: 'Corrigido',
        corrigidoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Correção salva!' });
    }

    if (req.method === 'POST' && action === 'cancelarProva') {
      await db.collection('provas').doc(body.id).update({ status: 'Cancelada', canceladoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirProva') {
      await db.collection('provas').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    // 6. SUGERIR QUESTÃO
    if (req.method === 'POST' && action === 'sugerirQuestao') {
      const { avaliadorNick, categoria, titulo, enunciado, gabarito_esperado } = body;
      if (!enunciado || !gabarito_esperado) return res.status(400).json({ error: 'Preencha enunciado e gabarito.' });

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
      return res.status(200).json({ success: true, message: 'Sugestão de questão enviada!' });
    }

    // 7. SUGERIR CENÁRIO DE SIMULADOR (NOVO)
    if (req.method === 'POST' && action === 'sugerirCenarioSimulador') {
      const { avaliadorNick, tipoSimulador, npcNick, npcAvatar, falaNpc, opcoes } = body;
      if (!falaNpc || !opcoes || opcoes.length === 0) return res.status(400).json({ error: 'Preencha os campos da situação.' });

      await db.collection('sugestoes_simuladores').add({
        avaliadorNick: avaliadorNick || 'Avaliador',
        tipoSimulador: tipoSimulador || 'pulso',
        npcNick: npcNick || 'Subordinado',
        npcAvatar: npcAvatar || 'Habbo',
        falaNpc: falaNpc.trim(),
        opcoes,
        status: 'Pendente',
        observacaoGestor: '',
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Sugestão de cenário enviada à gestão!' });
    }

    // 8. MINHAS SUGESTÕES DE QUESTÃO E SIMULADOR
    if (req.method === 'GET' && action === 'minhasSugestoes') {
      const nick = req.query.nick;
      const snapQ = await db.collection('sugestoes_questoes').where('avaliadorNick', '==', nick).get();
      const snapS = await db.collection('sugestoes_simuladores').where('avaliadorNick', '==', nick).get();

      const questoes = snapQ.docs.map(d => ({ id: d.id, tipoConteudo: 'questao', ...d.data() }));
      const simuladores = snapS.docs.map(d => ({ id: d.id, tipoConteudo: 'simulador', ...d.data() }));

      return res.status(200).json({ sugestoes: [...questoes, ...simuladores] });
    }

    // 9. RELATÓRIO DOS SIMULADORES
    if (req.method === 'GET' && action === 'listarResultadosSimuladores') {
      const snap = await db.collection('simulacoes_resultados').get();
      const resultados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      resultados.sort((a, b) => (b.realizadoEm?.toMillis?.() || 0) - (a.realizadoEm?.toMillis?.() || 0));
      return res.status(200).json({ resultados });
    }

    // 10. CENTRAL DE DÚVIDAS
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const snap = await db.collection('duvidas').get();
      const duvidas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ duvidas });
    }

    if (req.method === 'POST' && action === 'assumirDuvida') {
      await db.collection('duvidas').doc(body.id).update({ avaliadorNick: body.nickAvaliador || 'Avaliador', status: 'Em Andamento' });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'responderDuvida') {
      await db.collection('duvidas').doc(body.id).update({ resposta: body.resposta.trim(), avaliadorNick: body.nickAvaliador || 'Avaliador', status: 'Respondida', respondidoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    // 11. DOCUMENTOS
    if (req.method === 'GET' && action === 'listarDocumentos') {
      const snap = await db.collection('documentos').get();
      const documentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ documentos });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    console.error('Erro na API Avaliador:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
