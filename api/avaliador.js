const { db, FieldValue } = require('./db.js');
const bcrypt = require('bcryptjs');

function gerarSenhaAleatoria() {
  return Math.random().toString(36).slice(-8);
}

function mapProva(p) {
  return {
    token_utilizado: p.tokenUtilizado,
    candidato_nick: p.candidatoNick,
    avaliador_nick: p.avaliadorNick,
    status: p.status,
    nota: p.nota !== undefined ? p.nota : null,
    feedback_avaliador: p.feedbackAvaliador || null,
    respostas_json: p.respostasJson || {},
    questoes_json: p.questoesJson || []
  };
}

function mapDuvida(d) {
  return {
    aluno_nick: d.alunoNick,
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

    // 1. Consulta Dados do Habbo (Online/Offline, Última Acesso e Avatar)
    if (req.method === 'GET' && action === 'habboProfile') {
      const nick = req.query.nick;
      if (!nick) return res.status(400).json({ error: 'Nick não informado' });

      try {
        const response = await fetch(`https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`);
        if (!response.ok) {
          return res.status(200).json({
            online: false,
            lastAccess: 'Não encontrado',
            figureString: '',
            motto: ''
          });
        }
        const data = await response.json();
        return res.status(200).json({
          online: data.online || false,
          lastAccess: data.lastAccessTime ? new Date(data.lastAccessTime).toLocaleString('pt-BR') : 'Privado/Indisponível',
          figureString: data.figureString || '',
          motto: data.motto || ''
        });
      } catch (e) {
        return res.status(200).json({ online: false, lastAccess: 'Indisponível' });
      }
    }

    // 2. Gerar Token de Avaliação
    if (req.method === 'POST' && action === 'gerarToken') {
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
          ? `Token gerado! Conta criada para ${nickLimpo}.`
          : `Token gerado para o candidato ${nickLimpo} (usuário já existente).`
      });
    }

    // 3. Listar Avaliações do Avaliador ou Gestor
    if (req.method === 'GET' && action === 'listarProvas') {
      const nickAvaliador = (req.query.nick || '').trim().toLowerCase();
      const snap = await db.collection('provas').orderBy('criadoEm', 'desc').get();
      let provas = snap.docs.map(d => ({ id: d.id, ...mapProva(d.data()) }));

      if (nickAvaliador && req.query.filtrarMeuNick === 'true') {
        provas = provas.filter(p => (p.avaliador_nick || '').toLowerCase() === nickAvaliador);
      }

      return res.status(200).json({ provas });
    }

    // 4. Corrigir Avaliação
    if (req.method === 'POST' && action === 'corrigir') {
      const { provaId, nota, feedback } = body;
      if (!provaId || nota === undefined || nota === '') {
        return res.status(400).json({ error: 'ID da prova e nota são obrigatórios.' });
      }

      await db.collection('provas').doc(provaId).update({
        nota: parseFloat(nota),
        feedbackAvaliador: feedback || '',
        status: 'Corrigido',
        corrigidoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true, message: 'Avaliação corrigida com sucesso!' });
    }

    // 5. Listar Dúvidas
    if (req.method === 'GET' && action === 'listarDuvidas') {
      const snap = await db.collection('duvidas').orderBy('criadoEm', 'desc').get();
      const duvidas = snap.docs.map(d => ({ id: d.id, ...mapDuvida(d.data()) }));
      return res.status(200).json({ duvidas });
    }

    // 6. Assumir Dúvida
    if (req.method === 'POST' && action === 'assumirDuvida') {
      const { id, nickAvaliador } = body;
      if (!id) return res.status(400).json({ error: 'ID da dúvida ausente.' });

      await db.collection('duvidas').doc(id).update({
        avaliadorNick: nickAvaliador || 'Avaliador',
        status: 'Em Andamento'
      });

      return res.status(200).json({ success: true });
    }

    // 7. Responder Dúvida
    if (req.method === 'POST' && action === 'responderDuvida') {
      const { id, resposta, nickAvaliador } = body;
      if (!id || !resposta) {
        return res.status(400).json({ error: 'ID da dúvida e resposta são necessários.' });
      }

      await db.collection('duvidas').doc(id).update({
        resposta: resposta.trim(),
        avaliadorNick: nickAvaliador || 'Avaliador',
        status: 'Respondida',
        respondidoEm: FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Ação não encontrada' });
  } catch (err) {
    console.error('Erro na API Avaliador:', err);
    return res.status(500).json({ error: 'Erro interno', message: err.message });
  }
};
