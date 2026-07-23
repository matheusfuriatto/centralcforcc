const { db, FieldValue } = require('./db.js');

function mapProva(p) {
  return {
    token_utilizado: p.tokenUtilizado,
    candidato_nick: p.candidatoNick,
    status: p.status,
    nota: p.nota !== undefined ? p.nota : null,
    feedback_avaliador: p.feedbackAvaliador || null,
    respostas_json: p.respostasJson || null,
    questoes_json: p.questoesJson || null
  };
}

function mapDuvida(d) {
  return {
    titulo: d.titulo,
    pergunta: d.pergunta,
    status: d.status,
    avaliador_nick: d.avaliadorNick || null,
    resposta: d.resposta || null
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Cadastrar Nova Dúvida do Aluno
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

      return res.status(200).json({ success: true, message: 'Dúvida enviada!', id: doc.id });
    }

    // 2. Listar Dúvidas de um Aluno Específico
    if (req.method === 'GET' && action === 'minhasDuvidas') {
      const alunoNick = req.query.alunoNick || req.query.nick;
      if (!alunoNick) return res.status(400).json({ error: 'Nick do aluno não informado.' });

      const snap = await db.collection('duvidas')
        .where('alunoNickBusca', '==', String(alunoNick).trim().toLowerCase())
        .orderBy('criadoEm', 'desc')
        .get();

      const duvidas = snap.docs.map(d => ({ id: d.id, ...mapDuvida(d.data()) }));
      return res.status(200).json({ duvidas });
    }

    // 3. Minhas Avaliações (Em Andamento / Corrigidas)
    if (req.method === 'GET' && action === 'minhasAvaliacoes') {
      const nick = req.query.nick || req.query.alunoNick;
      if (!nick) return res.status(400).json({ error: 'Nick não informado.' });

      const snap = await db.collection('provas')
        .where('candidatoNickBusca', '==', String(nick).trim().toLowerCase())
        .orderBy('criadoEm', 'desc')
        .get();

      const provas = snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) }));
      return res.status(200).json({ provas });
    }

    // 4. Buscar Avaliação pelo Token e Selecionar Questões Randômicas
    if (req.method === 'GET' && action === 'buscarProva') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ error: 'Informe o Token da Avaliação.' });

      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Token não encontrado ou inválido.' });

      const docRef = snap.docs[0].ref;
      const dadosProva = snap.docs[0].data();

      // Se a prova já possui questões sorteadas salvas, retorna elas
      if (dadosProva.questoesJson) {
        return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva(dadosProva) } });
      }

      // Primeiro acesso: sorteia 10 questões do banco
      const todasSnap = await db.collection('questoes').get();
      const todas = todasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (todas.length === 0) {
        return res.status(400).json({ error: 'O banco de questões está vazio. Peça ao gestor para povoar as questões.' });
      }

      const sorteadas = todas.sort(() => Math.random() - 0.5).slice(0, 10);

      await docRef.update({ questoesJson: sorteadas, status: 'Em Andamento' });

      dadosProva.questoesJson = sorteadas;
      dadosProva.status = 'Em Andamento';

      return res.status(200).json({ prova: { id: snap.docs[0].id, ...mapProva(dadosProva) } });
    }

    // 5. Submeter Respostas da Avaliação pelo Aluno
    if (req.method === 'POST' && action === 'submeterProva') {
      const { token, respostas } = body;
      if (!token || !respostas) {
        return res.status(400).json({ error: 'Token ou respostas ausentes.' });
      }

      const snap = await db.collection('provas').where('tokenUtilizado', '==', token.trim()).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'Token não encontrado.' });

      // Status "Submetido" -- é o que o painel do avaliador espera para liberar a correção
      await snap.docs[0].ref.update({ respostasJson: respostas, status: 'Submetido' });

      return res.status(200).json({ success: true, message: 'Avaliação entregue com sucesso!' });
    }

    return res.status(400).json({ error: 'Ação não reconhecida para Alunos.' });
  } catch (err) {
    console.error('Erro no api/aluno.js:', err);
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
