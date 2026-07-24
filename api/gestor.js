const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const action = req.query ? req.query.action : null;

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Cadastrar Cenário de Simulador (Pulso Firme / Tempo & Produtividade)
    if (req.method === 'POST' && action === 'cadastrarCenarioSimulador') {
      const { tipoSimulador, npcNick, npcAvatar, falaNpc, opcoes } = body;
      if (!tipoSimulador || !falaNpc || !opcoes || opcoes.length === 0) {
        return res.status(400).json({ error: 'Preencha todos os campos do cenário.' });
      }

      await db.collection('cenarios_simuladores').add({
        tipoSimulador, // 'pulso' ou 'tempo'
        npcNick: npcNick || 'Subordinado',
        npcAvatar: npcAvatar || 'Habbo',
        falaNpc: falaNpc.trim(),
        opcoes,
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Cenário adicionado ao simulador!' });
    }

    // 2. Listar Cenários de Simuladores
    if (req.method === 'GET' && action === 'listarCenariosSimuladores') {
      const snap = await db.collection('cenarios_simuladores').orderBy('criadoEm', 'asc').get();
      return res.status(200).json({ cenarios: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    // 3. Excluir Cenário de Simulador
    if (req.method === 'DELETE' && action === 'excluirCenarioSimulador') {
      await db.collection('cenarios_simuladores').doc(body.id).delete();
      return res.status(200).json({ success: true, message: 'Cenário removido.' });
    }

    // 4. Listar e Avaliar Sugestões
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

    // 5. Usuários
    if (req.method === 'GET' && action === 'listarUsuarios') {
      const snap = await db.collection('usuarios').get();
      return res.status(200).json({ usuarios: snap.docs.map(d => ({ id: d.id, nick_policial: d.data().nickPolicial, nome: d.data().nome, role: d.data().role })) });
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

    // 6. Banco de Questões
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

    // 7. Documentos
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
