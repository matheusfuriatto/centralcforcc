const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const action = req.query ? req.query.action : null;
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // 1. Cadastrar Usuário
    if (req.method === 'POST' && action === 'cadastrarUsuario') {
      const { nome, nick, senha, role } = body;
      if (!nome || !nick || !senha || !role) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
      }

      const nickBusca = String(nick).trim().toLowerCase();
      const existente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();
      if (!existente.empty) {
        return res.status(400).json({ error: 'Já existe um usuário com esse nick.' });
      }

      const senhaHash = await bcrypt.hash(String(senha), 10);
      const doc = await db.collection('usuarios').add({
        nome: nome.trim(),
        nickPolicial: nick.trim(),
        nickBusca,
        senhaHash,
        role,
        criadoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, id: doc.id });
    }

    // 2. Listar Usuários
    if (req.method === 'GET' && action === 'listarUsuarios') {
      const snap = await db.collection('usuarios').orderBy('criadoEm', 'desc').get();
      const usuarios = snap.docs.map(d => {
        const u = d.data();
        return { id: d.id, nome: u.nome, nick_policial: u.nickPolicial, role: u.role };
      });
      return res.status(200).json({ usuarios });
    }

    // 3. Remover Usuário
    if (req.method === 'DELETE' && action === 'removerUsuario') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'ID não informado.' });
      await db.collection('usuarios').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    // 4. Cadastrar Questão
    if (req.method === 'POST' && action === 'cadastrarQuestao') {
      const { categoria, titulo, enunciado, gabarito } = body;
      if (!enunciado || !gabarito) {
        return res.status(400).json({ error: 'Preencha o enunciado e o gabarito.' });
      }
      await db.collection('questoes').add({
        categoria: categoria ? categoria.trim() : 'Geral',
        titulo: titulo ? titulo.trim() : '',
        enunciado: enunciado.trim(),
        gabaritoEsperado: gabarito.trim(),
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    // 5. Listar Questões
    if (req.method === 'GET' && action === 'listarQuestoes') {
      const snap = await db.collection('questoes').orderBy('criadoEm', 'desc').get();
      const questoes = snap.docs.map(d => {
        const q = d.data();
        return {
          id: d.id, categoria: q.categoria, titulo: q.titulo,
          enunciado: q.enunciado, gabarito_esperado: q.gabaritoEsperado
        };
      });
      return res.status(200).json({ questoes });
    }

    // 6. Excluir Questão
    if (req.method === 'DELETE' && action === 'excluirQuestao') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'ID não informado.' });
      await db.collection('questoes').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    // 7. Listar Tokens Emitidos
    if (req.method === 'GET' && action === 'listarTokens') {
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      const tokens = snap.docs.map(d => {
        const t = d.data();
        return {
          id: d.id,
          token_utilizado: t.tokenUtilizado,
          candidato_nick: t.candidatoNick,
          avaliador_gerador: t.avaliadorNick,
          status: t.status
        };
      });
      return res.status(200).json({ tokens });
    }

    // 8. Métricas Gerais
    if (req.method === 'GET' && action === 'metricas') {
      const snap = await db.collection('provas').get();
      let total = 0, pendentes = 0, somaNotas = 0, qtdNotas = 0;

      snap.forEach(d => {
        const t = d.data();
        total++;
        if (t.status === 'Submetido') pendentes++;
        if (typeof t.nota === 'number') { somaNotas += t.nota; qtdNotas++; }
      });

      return res.status(200).json({
        totalProvas: total,
        totalPendentes: pendentes,
        mediaNotas: qtdNotas ? (somaNotas / qtdNotas) : 0
      });
    }

    return res.status(400).json({ error: 'Ação não reconhecida para Gestor.' });
  } catch (err) {
    console.error('Erro em api/gestor.js:', err);
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
