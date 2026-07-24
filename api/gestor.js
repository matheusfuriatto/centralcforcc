const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const action = req.query ? req.query.action : null;

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. IMPORTAÇÃO EM LOTE - DOCUMENTOS
    if (req.method === 'POST' && action === 'importarDocumentosLote') {
      const { itens } = body;
      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Nenhum documento válido para importação.' });
      }

      const batch = db.batch();
      itens.forEach(doc => {
        const ref = db.collection('documentos').doc();
        batch.set(ref, {
          titulo: String(doc.titulo || '').trim(),
          url: String(doc.url || '').trim(),
          categoria: String(doc.categoria || 'Geral').trim(),
          criadoEm: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      return res.status(200).json({ success: true, message: `${itens.length} documentos cadastrados com sucesso!` });
    }

    // 2. IMPORTAÇÃO EM LOTE - QUESTÕES
    if (req.method === 'POST' && action === 'importarQuestoesLote') {
      const { itens } = body;
      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Nenhuma questão válida para importação.' });
      }

      const batch = db.batch();
      itens.forEach(q => {
        const ref = db.collection('questoes').doc();
        batch.set(ref, {
          categoria: String(q.categoria || 'Geral').trim(),
          titulo: String(q.titulo || '').trim(),
          enunciado: String(q.enunciado || '').trim(),
          gabarito_esperado: String(q.gabarito_esperado || '').trim(),
          criadoEm: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      return res.status(200).json({ success: true, message: `${itens.length} questões cadastradas com sucesso!` });
    }

    // 3. IMPORTAÇÃO EM LOTE - CENÁRIOS DE SIMULADOR
    if (req.method === 'POST' && action === 'importarCenariosLote') {
      const { itens } = body;
      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Nenhum cenário válido para importação.' });
      }

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
      return res.status(200).json({ success: true, message: `${itens.length} cenários de simulador cadastrados!` });
    }

    // 4. IMPORTAÇÃO EM LOTE - USUÁRIOS
    if (req.method === 'POST' && action === 'importarUsuariosLote') {
      const { itens } = body;
      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Nenhum usuário válido para importação.' });
      }

      let cadastrados = 0;
      for (const u of itens) {
        const nick = String(u.nick || '').trim();
        if (!nick) continue;
        const nickBusca = nick.toLowerCase();
        const senha = String(u.senha || 'cfo123').trim();
        const senhaHash = await bcrypt.hash(senha, 10);

        const jaExiste = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();
        if (jaExiste.empty) {
          await db.collection('usuarios').add({
            nome: String(u.nome || nick).trim(),
            nickPolicial: nick,
            nickBusca,
            senhaHash,
            role: String(u.role || 'candidato').trim().toLowerCase(),
            statusAprovacao: 'Aprovado',
            criadoEm: FieldValue.serverTimestamp()
          });
          cadastrados++;
        }
      }

      return res.status(200).json({ success: true, message: `${cadastrados} novos usuários cadastrados em lote!` });
    }

    // AÇÕES PADRÃO ANTERIORES
    if (req.method === 'POST' && action === 'cadastrarCenarioSimulador') {
      const { tipoSimulador, npcNick, npcAvatar, falaNpc, opcoes } = body;
      await db.collection('cenarios_simuladores').add({
        tipoSimulador, npcNick: npcNick || 'Subordinado', npcAvatar: npcAvatar || 'Habbo', falaNpc: falaNpc.trim(), opcoes, criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET' && action === 'listarCenariosSimuladores') {
      const snap = await db.collection('cenarios_simuladores').orderBy('criadoEm', 'asc').get();
      return res.status(200).json({ cenarios: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'DELETE' && action === 'excluirCenarioSimulador') {
      await db.collection('cenarios_simuladores').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

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
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
