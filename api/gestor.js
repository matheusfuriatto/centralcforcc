const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const action = req.query ? req.query.action : null;

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. LISTAR SUGESTÕES DE QUESTÕES (SEGURO)
    if (req.method === 'GET' && action === 'listarSugestoes') {
      const snap = await db.collection('sugestoes_questoes').get();
      const sugestoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      sugestoes.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      return res.status(200).json({ sugestoes });
    }

    // 2. LISTAR SUGESTÕES DE SIMULADORES (SEGURO)
    if (req.method === 'GET' && action === 'listarSugestoesSimuladores') {
      const snap = await db.collection('sugestoes_simuladores').get();
      const sugestoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      sugestoes.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      return res.status(200).json({ sugestoes });
    }

    // 3. AVALIAR SUGESTÃO DE QUESTÃO
    if (req.method === 'POST' && action === 'avaliarSugestao') {
      const { id, acao, observacao } = body;
      const ref = db.collection('sugestoes_questoes').doc(id);
      const doc = await ref.get();

      if (!doc.exists) return res.status(404).json({ error: 'Sugestão não encontrada.' });
      const dados = doc.data();

      if (acao === 'aprovar') {
        await db.collection('questoes').add({
          categoria: dados.categoria || 'Geral',
          titulo: dados.titulo || '',
          enunciado: dados.enunciado || '',
          gabarito_esperado: dados.gabarito_esperado || '',
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

      return res.status(200).json({ success: true, message: 'Avaliação da sugestão gravada!' });
    }

    // 4. AVALIAR SUGESTÃO DE SIMULADOR
    if (req.method === 'POST' && action === 'avaliarSugestaoSimulador') {
      const { id, acao, observacao } = body;
      const ref = db.collection('sugestoes_simuladores').doc(id);
      const doc = await ref.get();

      if (!doc.exists) return res.status(404).json({ error: 'Sugestão não encontrada.' });
      const dados = doc.data();

      if (acao === 'aprovar') {
        await db.collection('cenarios_simuladores').add({
          tipoSimulador: dados.tipoSimulador || 'pulso',
          npcNick: dados.npcNick || 'Subordinado',
          npcAvatar: dados.npcAvatar || 'Habbo',
          falaNpc: dados.falaNpc || '',
          opcoes: dados.opcoes || [],
          criadoEm: FieldValue.serverTimestamp()
        });

        await ref.update({
          status: 'Aprovada',
          observacaoGestor: observacao || 'Cenário aprovado e injetado no simulador!',
          analisadoEm: FieldValue.serverTimestamp()
        });
      } else {
        await ref.update({
          status: 'Reprovada',
          observacaoGestor: observacao || 'Sugestão de cenário recusada.',
          analisadoEm: FieldValue.serverTimestamp()
        });
      }

      return res.status(200).json({ success: true, message: 'Sugestão de simulador processada!' });
    }

    // 5. BANCO DE QUESTÕES (LISTAGEM DIRETA E SEGURA)
    if (req.method === 'GET' && action === 'listarQuestoes') {
      const snap = await db.collection('questoes').get();
      const questoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      questoes.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      return res.status(200).json({ questoes });
    }

    if (req.method === 'POST' && action === 'cadastrarQuestao') {
      const { categoria, titulo, enunciado, gabarito_esperado } = body;
      if (!enunciado) return res.status(400).json({ error: 'Enunciado é obrigatório.' });

      await db.collection('questoes').add({
        categoria: categoria || 'Geral',
        titulo: titulo || '',
        enunciado: enunciado.trim(),
        gabarito_esperado: gabarito_esperado ? gabarito_esperado.trim() : '',
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Questão cadastrada no banco!' });
    }

    if (req.method === 'DELETE' && action === 'excluirQuestao') {
      await db.collection('questoes').doc(body.id).delete();
      return res.status(200).json({ success: true, message: 'Questão removida.' });
    }

    // 6. CENTRAL DE DOCUMENTOS (LISTAGEM DIRETA E SEGURA)
    if (req.method === 'GET' && action === 'listarDocumentos') {
      const snap = await db.collection('documentos').get();
      const documentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ documentos });
    }

    if (req.method === 'POST' && action === 'cadastrarDocumento') {
      const { titulo, url, categoria } = body;
      if (!titulo || !url) return res.status(400).json({ error: 'Título e URL são obrigatórios.' });

      await db.collection('documentos').add({
        titulo: titulo.trim(),
        url: url.trim(),
        categoria: categoria || 'Geral',
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Documento adicionado!' });
    }

    if (req.method === 'DELETE' && action === 'excluirDocumento') {
      await db.collection('documentos').doc(body.id).delete();
      return res.status(200).json({ success: true, message: 'Documento excluído.' });
    }

    // 7. CENÁRIOS DE SIMULADORES
    if (req.method === 'POST' && action === 'cadastrarCenarioSimulador') {
      const { tipoSimulador, npcNick, npcAvatar, falaNpc, opcoes } = body;
      await db.collection('cenarios_simuladores').add({
        tipoSimulador,
        npcNick: npcNick || 'Subordinado',
        npcAvatar: npcAvatar || 'Habbo',
        falaNpc: falaNpc.trim(),
        opcoes,
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, message: 'Cenário cadastrado!' });
    }

    if (req.method === 'GET' && action === 'listarCenariosSimuladores') {
      const snap = await db.collection('cenarios_simuladores').get();
      const cenarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ cenarios });
    }

    if (req.method === 'DELETE' && action === 'excluirCenarioSimulador') {
      await db.collection('cenarios_simuladores').doc(body.id).delete();
      return res.status(200).json({ success: true, message: 'Cenário removido.' });
    }

    // 8. IMPORTAÇÕES EM LOTE
    if (req.method === 'POST' && action === 'importarDocumentosLote') {
      const { itens } = body;
      const batch = db.batch();
      itens.forEach(doc => {
        const ref = db.collection('documentos').doc();
        batch.set(ref, { titulo: String(doc.titulo || '').trim(), url: String(doc.url || '').trim(), categoria: String(doc.categoria || 'Geral').trim(), criadoEm: FieldValue.serverTimestamp() });
      });
      await batch.commit();
      return res.status(200).json({ success: true, message: `${itens.length} documentos importados!` });
    }

    if (req.method === 'POST' && action === 'importarQuestoesLote') {
      const { itens } = body;
      const batch = db.batch();
      itens.forEach(q => {
        const ref = db.collection('questoes').doc();
        batch.set(ref, { categoria: String(q.categoria || 'Geral').trim(), titulo: String(q.titulo || '').trim(), enunciado: String(q.enunciado || '').trim(), gabarito_esperado: String(q.gabarito_esperado || '').trim(), criadoEm: FieldValue.serverTimestamp() });
      });
      await batch.commit();
      return res.status(200).json({ success: true, message: `${itens.length} questões importadas!` });
    }

    if (req.method === 'POST' && action === 'importarCenariosLote') {
      const { itens } = body;
      const batch = db.batch();
      itens.forEach(c => {
        const ref = db.collection('cenarios_simuladores').doc();
        batch.set(ref, {
          tipoSimulador: String(c.tipoSimulador || 'pulso').trim().toLowerCase(),
          npcNick: String(c.npcNick || 'Subordinado').trim(),
          npcAvatar: String(c.npcAvatar || 'Habbo').trim(),
          falaNpc: String(c.falaNpc || '').trim(),
          opcoes: [
            { texto: String(c.opt1Texto || ''), tipo: "pulso", falaPlayer: String(c.opt1Texto || ''), feedback: String(c.opt1Feedback || '') },
            { texto: String(c.opt2Texto || ''), tipo: "rudeza", falaPlayer: String(c.opt2Texto || ''), feedback: String(c.opt2Feedback || '') },
            { texto: String(c.opt3Texto || ''), tipo: "passividade", falaPlayer: String(c.opt3Texto || ''), feedback: String(c.opt3Feedback || '') }
          ],
          criadoEm: FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      return res.status(200).json({ success: true, message: `${itens.length} cenários de simulador importados!` });
    }

    if (req.method === 'POST' && action === 'importarUsuariosLote') {
      const { itens } = body;
      let cadastrados = 0;
      for (const u of itens) {
        const nick = String(u.nick || '').trim();
        if (!nick) continue;
        const nickBusca = nick.toLowerCase();
        const senha = String(u.senha || 'cfo123').trim();
        const senhaHash = await bcrypt.hash(senha, 10);

        const jaExiste = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();
        if (jaExiste.empty) {
          await db.collection('usuarios').add({ nome: String(u.nome || nick).trim(), nickPolicial: nick, nickBusca, senhaHash, role: String(u.role || 'candidato').trim().toLowerCase(), statusAprovacao: 'Aprovado', criadoEm: FieldValue.serverTimestamp() });
          cadastrados++;
        }
      }
      return res.status(200).json({ success: true, message: `${cadastrados} novos usuários importados!` });
    }

    // 9. USUÁRIOS
    if (req.method === 'GET' && action === 'listarUsuarios') {
      const snap = await db.collection('usuarios').get();
      return res.status(200).json({ usuarios: snap.docs.map(d => ({ id: d.id, nick_policial: d.data().nickPolicial, nome: d.data().nome, role: d.data().role })) });
    }

    if (req.method === 'POST' && action === 'cadastrarUsuario') {
      const { nome, nick, senha, role } = body;
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.collection('usuarios').add({ nome, nickPolicial: nick, nickBusca: nick.toLowerCase(), senhaHash, role, statusAprovacao: 'Aprovado', criadoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'removerUsuario') {
      await db.collection('usuarios').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    console.error('Erro na API do Gestor:', err);
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
