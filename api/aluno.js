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

    // 1. Cadastrar Nova Dúvida
    if (req.method === 'POST' && (action === 'criarDuvida' || action === 'enviarDuvida')) {
      const alunoNick = body.alunoNick || body.nick;
      const { titulo, pergunta } = body;

      if (!alunoNick || !titulo || !pergunta) {
        return res.status(400).json({ error: 'Preencha todos os campos para enviar a dúvida.' });
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
      if (!alunoNick) return res.status(400).json({ error: 'Nick não informado.' });

      const snap = await db.collection('duvidas')
        .where('alunoNickBusca', '==', String(alunoNick).trim().toLowerCase())
        .get();

      const duvidas = snap.docs.map(d => ({
        id: d.id,
        alunoNick: d.data().alunoNick,
        titulo: d.data().titulo,
        pergunta: d.data().pergunta,
        status: d.data().status || 'Pendente',
        avaliadorNick: d.data().avaliadorNick || null,
        resposta: d.data().resposta || null
      }));
      return res.status(200).json({ duvidas });
    }

    // 3. Listar TODAS as Dúvidas (Comunidade)
    if (req.method === 'GET' && action === 'todasDuvidas') {
      const snap = await db.collection('duvidas').orderBy('criadoEm', 'desc').get();
      const duvidas = snap.docs.map(d => ({
        id: d.id,
        alunoNick: d.data().alunoNick,
        titulo: d.data().titulo,
        pergunta: d.data().pergunta,
        status: d.data().status || 'Pendente',
        avaliadorNick: d.data().avaliadorNick || null,
        resposta: d.data().resposta || null
      }));
      return res.status(200).json({ duvidas });
    }

    // 4. Listar Minhas Avaliações e Resultados
    if (req.method === 'GET' && action === 'minhasAvaliacoes') {
      const nick = req.query.nick || req.query.alunoNick;
      if (!nick) return res.status(400).json({ error: 'Nick não informado.' });

      const snap = await db.collection('provas')
        .where('candidatoNickBusca', '==', String(nick).trim().toLowerCase())
        .get();

      const provas = snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) }));
      return res.status(200).json({ provas });
    }

    // 5. Avaliações Disponíveis para Iniciar
    if (req.method === 'GET' && action === 'avaliacoesDisponiveis') {
      const nick = req.query.nick;
      if (!nick) return res.status(400).json({ error: 'Nick não informado.' });

      const snap = await db.collection('provas')
        .where('candidatoNickBusca', '==', String(nick).trim().toLowerCase())
        .where('status', 'in', ['Pendente', 'Em Andamento'])
        .get();

      const disponiveis = snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) }));
      return res.status(200).json({ disponiveis });
    }

    // 6. Buscar Avaliação pelo Token
    if (req.method === 'GET' && action === 'buscarProva') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Informe a Avaliação.' });

      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Avaliação não encontrada ou inválida.' });

      const docRef = snap.docs[0].ref;
      const dadosProva = snap.docs[0].data();

      if (dadosProva.status === 'Cancelada') {
        return res.status(400).json({ error: 'Esta prova foi cancelada pelo avaliador.' });
      }

      if (dadosProva.questoesJson && dadosProva.questoesJson.length > 0) {
        return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva(dadosProva) } });
      }

      const todasSnap = await db.collection('questoes').get();
      const todas = todasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (todas.length === 0) {
        return res.status(400).json({ error: 'O banco de questões está vazio. Avise a gestão.' });
      }

      const sorteadas = todas.sort(() => Math.random() - 0.5).slice(0, 10);

      await docRef.update({ questoesJson: sorteadas, status: 'Em Andamento' });

      dadosProva.questoesJson = sorteadas;
      dadosProva.status = 'Em Andamento';

      return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva(dadosProva) } });
    }

    // 7. Submeter Respostas da Prova
    if (req.method === 'POST' && action === 'submeterProva') {
      const { token, respostas } = body;
      if (!token || !respostas) {
        return res.status(400).json({ error: 'Dados incompletos para envio da prova.' });
      }

      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Avaliação não encontrada.' });

      await snap.docs[0].ref.update({
        respostasJson: respostas,
        status: 'Submetido',
        submetidoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Avaliação entregue com sucesso!' });
    }

    return res.status(400).json({ error: 'Ação não reconhecida.' });
  } catch (err) {
    console.error('Erro na API do Aluno:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
