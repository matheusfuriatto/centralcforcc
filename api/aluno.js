const { db, FieldValue } = require('./db.js');

function mapProva(p) {
  return {
    token_utilizado: p.tokenUtilizado,
    candidato_nick: p.candidatoNick,
    avaliador_nick: p.avaliadorNick || 'Corpo Docente',
    status: p.status || 'Pendente',
    nota: p.nota !== undefined && p.nota !== null ? p.nota : null,
    feedback_avaliador: p.feedbackAvaliador || null,
    feedbacks_questoes: p.feedbacksQuestoes || {},
    respostas_json: p.respostasJson || {},
    questoes_json: p.questoesJson || []
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Cadastrar Dúvida
    if (req.method === 'POST' && (action === 'criarDuvida' || action === 'enviarDuvida')) {
      const alunoNick = body.alunoNick || body.nick;
      const { titulo, pergunta } = body;

      if (!alunoNick || !titulo || !pergunta) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
      }

      const doc = await db.collection('duvidas').add({
        alunoNick: String(alunoNick).trim(),
        alunoNickBusca: String(alunoNick).trim().toLowerCase(),
        titulo: titulo.trim(),
        pergunta: pergunta.trim(),
        status: 'Pendente',
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Dúvida enviada com sucesso!', id: doc.id });
    }

    // 2. Listar Minhas Dúvidas
    if (req.method === 'GET' && action === 'minhasDuvidas') {
      const alunoNick = req.query.alunoNick || req.query.nick;
      const snap = await db.collection('duvidas')
        .where('alunoNickBusca', '==', String(alunoNick).trim().toLowerCase())
        .get();

      return res.status(200).json({ duvidas: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 3. Listar TODAS as Dúvidas
    if (req.method === 'GET' && action === 'todasDuvidas') {
      const snap = await db.collection('duvidas').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({ duvidas: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 4. Listar Minhas Avaliações
    if (req.method === 'GET' && action === 'minhasAvaliacoes') {
      const nick = req.query.nick || req.query.alunoNick;
      const snap = await db.collection('provas')
        .where('candidatoNickBusca', '==', String(nick).trim().toLowerCase())
        .get();

      return res.status(200).json({ provas: snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) })) });
    }

    // 5. Avaliações Disponíveis
    if (req.method === 'GET' && action === 'avaliacoesDisponiveis') {
      const nick = req.query.nick;
      const snap = await db.collection('provas')
        .where('candidatoNickBusca', '==', String(nick).trim().toLowerCase())
        .where('status', 'in', ['Pendente', 'Em Andamento'])
        .get();

      return res.status(200).json({ disponiveis: snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) })) });
    }

    // 6. Buscar Prova pelo Token
    if (req.method === 'GET' && action === 'buscarProva') {
      const token = req.query.token;
      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Avaliação não encontrada.' });

      const docRef = snap.docs[0].ref;
      const dadosProva = snap.docs[0].data();

      if (dadosProva.status === 'Cancelada') return res.status(400).json({ error: 'Avaliação cancelada.' });
      if (dadosProva.questoesJson && dadosProva.questoesJson.length > 0) {
        return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva(dadosProva) } });
      }

      const todasSnap = await db.collection('questoes').get();
      const todas = todasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorteadas = todas.sort(() => Math.random() - 0.5).slice(0, 10);

      await docRef.update({ questoesJson: sorteadas, status: 'Em Andamento' });
      return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva({ ...dadosProva, questoesJson: sorteadas, status: 'Em Andamento' }) } });
    }

    // 7. Submeter Prova
    if (req.method === 'POST' && action === 'submeterProva') {
      const { token, respostas } = body;
      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Avaliação não encontrada.' });

      await snap.docs[0].ref.update({
        respostasJson: respostas,
        status: 'Submetido',
        submetidoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Avaliação entregue!' });
    }

    // 8. SALVAR RESULTADO DA SIMULAÇÃO DE PULSO FIRME (NOVO)
    if (req.method === 'POST' && action === 'salvarSimulacaoPulsoFirme') {
      const { nick, perfilGeral, scorePulso, scoreRudeza, scorePassividade, relatorio } = body;

      await db.collection('simulacoes_pulsofirme').add({
        alunoNick: String(nick).trim(),
        alunoNickBusca: String(nick).trim().toLowerCase(),
        perfilGeral,
        scorePulso,
        scoreRudeza,
        scorePassividade,
        relatorio,
        realizadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Simulação registrada no seu histórico!' });
    }

    // 9. HISTÓRICO DE SIMULAÇÕES DO ALUNO (NOVO)
    if (req.method === 'GET' && action === 'minhasSimulacoes') {
      const nick = req.query.nick;
      const snap = await db.collection('simulacoes_pulsofirme')
        .where('alunoNickBusca', '==', String(nick).trim().toLowerCase())
        .get();

      return res.status(200).json({ simulacoes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
