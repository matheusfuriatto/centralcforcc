const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

// Documentos Padrão Iniciais do Sistema
const DOCUMENTOS_PADRAO = [
  { titulo: 'Código de Conduta Militar - Disposições Gerais', url: 'https://www.policiarcc.com/t39237-codigo-de-conduta-militar-disposicoes-gerais', categoria: 'Conduta' },
  { titulo: 'Código de Conduta Militar - Disposições Complementares', url: 'https://www.policiarcc.com/t39236-codigo-de-conduta-militar-disposicoes-complementares', categoria: 'Conduta' },
  { titulo: 'Anexo II - Política de Baixa, Aposentadoria e Reintegração', url: 'https://www.policiarcc.com/t39235-anexo-ii-politica-de-baixa-aposentadoria-e-reintegracao', categoria: 'Diretrizes' },
  { titulo: 'Anexo I - Normas para nicknames, emblemas, missões e fardas', url: 'https://www.policiarcc.com/t39234-anexo-i-normas-para-nicknames-emblemas-missoes-e-fardas', categoria: 'Diretrizes' },
  { titulo: 'Código Penal Militar e Anexos', url: 'https://www.policiarcc.com/f145-codigo-penal-militar-e-anexos', categoria: 'Penal' },
  { titulo: 'Código Penal Militar', url: 'https://www.policiarcc.com/t39240-codigo-penal-militar', categoria: 'Penal' },
  { titulo: 'Anexo II - Política de Exoneração', url: 'https://www.policiarcc.com/t39239-anexo-ii-politica-de-exoneracao', categoria: 'Diretrizes' },
  { titulo: 'Anexo I - Punições', url: 'https://www.policiarcc.com/t39238-anexo-i-punicoes', categoria: 'Penal' },
  { titulo: 'Código de Comando do Batalhão', url: 'https://www.policiarcc.com/t39241-codigo-de-comando-do-batalhao', categoria: 'Comando' },
  { titulo: 'Anexo I - Manual de Utilização do Chooser', url: 'https://www.policiarcc.com/t28883-anexo-i-manual-de-utilizacao-do-chooser', categoria: 'Manuais' },
  { titulo: 'Plano de Controle Emergencial', url: 'https://www.policiarcc.com/t29569-plano-de-controle-emergencial', categoria: 'Estratégia' }
];

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const action = req.query ? req.query.action : null;

  try {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }

    // Inicialização do Banco de Documentos caso esteja vazio
    if (req.method === 'GET' && action === 'inicializarDocumentos') {
      const snap = await db.collection('documentos').get();
      if (snap.empty) {
        for (const doc of DOCUMENTOS_PADRAO) {
          await db.collection('documentos').add({ ...doc, criadoEm: FieldValue.serverTimestamp() });
        }
      }
      return res.status(200).json({ success: true, message: 'Documentos inicializados' });
    }

    // Listar Documentos
    if (req.method === 'GET' && action === 'listarDocumentos') {
      const snap = await db.collection('documentos').get();
      const documentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ documentos });
    }

    // Adicionar Documento
    if (req.method === 'POST' && action === 'cadastrarDocumento') {
      const { titulo, url, categoria } = body;
      if (!titulo || !url) return res.status(400).json({ error: 'Título e URL obrigatórios.' });

      await db.collection('documentos').add({
        titulo: titulo.trim(),
        url: url.trim(),
        categoria: categoria || 'Geral',
        criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    // Excluir Documento
    if (req.method === 'DELETE' && action === 'excluirDocumento') {
      const { id } = body;
      await db.collection('documentos').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    // Ações padrão de Usuários/Questões/Métricas...
    if (req.method === 'GET' && action === 'listarUsuarios') {
      const snap = await db.collection('usuarios').get();
      const usuarios = snap.docs.map(d => ({ id: d.id, nick_policial: d.data().nickPolicial, nome: d.data().nome, role: d.data().role }));
      return res.status(200).json({ usuarios });
    }

    if (req.method === 'POST' && action === 'cadastrarUsuario') {
      const { nome, nick, senha, role } = body;
      const senhaHash = await bcrypt.hash(senha, 10);
      await db.collection('usuarios').add({
        nome, nickPolicial: nick, nickBusca: nick.toLowerCase(), senhaHash, role, criadoEm: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'removerUsuario') {
      await db.collection('usuarios').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET' && action === 'listarQuestoes') {
      const snap = await db.collection('questoes').get();
      const questoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ questoes });
    }

    if (req.method === 'POST' && action === 'cadastrarQuestao') {
      await db.collection('questoes').add({ ...body, criadoEm: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE' && action === 'excluirQuestao') {
      await db.collection('questoes').doc(body.id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no servidor', message: err.message });
  }
};
