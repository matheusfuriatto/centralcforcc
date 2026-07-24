const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const action = req.query ? req.query.action : null;

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Listar e Avaliar Sugestões de Questões dos Avaliadores
    if (req.method === 'GET' && action === 'listarSugestoes') {
      const snap = await db.collection('sugestoes_questoes').orderBy('criadoEm', 'desc').get();
      return res.status(200).json({ sugestoes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST' && action === 'avaliarSugestao') {
      const { id, acao, observacao } = body;
      const ref = db.collection('sugestoes_questoes').doc(id);
      const doc = await ref.get();

      if (!doc.exists) return res.status(404).json({ error: 'Sugestão não encontrada.' });

      const dados = doc.data();

      if (acao === 'aprovar') {
        // Copia a questão para o banco oficial
        await db.collection('questoes').add({
          categoria: dados.categoria,
          titulo: dados.titulo,
          enunciado: dados.enunciado,
          gabarito_esperado: dados.gabarito_esperado,
          criadoEm: FieldValue.serverTimestamp()
        });

        await ref.update({
          status: 'Aprovada',
          observacaoGestor: observacao || 'Questão aprovada e adicionada ao banco oficial.',
          analisadoEm: FieldValue.serverTimestamp()
        });
      } else {
        await ref.update({
          status: 'Reprovada',
          observacaoGestor: observacao || 'Sugestão recusada pela gestão.',
          analisadoEm: FieldValue.serverTimestamp()
        });
      }

      return res.status(200).json({ success: true });
    }

    // 2. Análise Estatística / Índice de Erros por Questão
    if (req.method === 'GET' && action === 'analiseQuestoes') {
      const snapProvas = await db.collection('provas').where('status', '==', 'Corrigido').get();
      const contagem = {};

      snapProvas.docs.forEach(doc => {
        const p = doc.data();
        const questoes = p.questoesJson || [];
        const fbs = p.feedbacksQuestoes || {};

        questoes.forEach(q => {
          if (!contagem[q.id]) {
            contagem[q.id] = { id: q.id, enunciado: q.enunciado || q.titulo, categoria: q.categoria || 'Geral', totalRespostas: 0, errosObs: 0 };
          }
          contagem[q.id].totalRespostas++;
          if (fbs[q.id] && fbs[q.id].trim().length > 0) {
            contagem[q.id].errosObs++;
          }
        });
      });

      return res.status(200).json({ estatisticas: Object.values(contagem) });
    }

    // 3. Usuários e Permissões
    if (req.method === 'GET' && action === 'listarUsuarios') {
      const snap = await db.collection('usuarios').get();
      const usuarios = snap.docs.map(d => ({ id: d.id, nick_policial: d.data().nickPolicial, nome: d.data().nome, role: d.data().role }));
      return res.status(200).json({ usuarios });
    }

    if (req.method === 'POST' && action === 'cadastrarUsuario') {
      const { nome, nick, senha, role } = body;
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.collection('usuarios').add({
        nome, nickPolicial: nick, nickBusca: nick.toLowerCase(), senhaHash, role, statusAprovacao: 'Aprovado', criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'removerUsuario') {
      await db.collection('usuarios').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    // 4. Banco de Questões Direto
    if (req.method === 'GET' && action === 'listarQuestoes') {
      const snap = await db.collection('questoes').get();
      return res.status(200).json({ questoes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST' && action === 'cadastrarQuestao') {
      await db.collection('questoes').add({ ...body, criadoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirQuestao') {
      await db.collection('questoes').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    // 5. Documentos
    if (req.method === 'POST' && action === 'cadastrarDocumento') {
      await db.collection('documentos').add({ ...body, criadoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirDocumento') {
      await db.collection('documentos').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
