<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Painel da Gestão - CFO</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    [data-theme="dark"] { background-color: #121212; color: #e0e0e0; }
    [data-theme="dark"] .card, [data-theme="dark"] .table { background-color: #1e1e1e; color: #fff; border-color: #333; }
    [data-theme="light"] { background-color: #f8f9fa; color: #212529; }

    /* Estilo do Avatar Habbo */
    .avatar-container {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.1);
      border: 2px solid #ffc107;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-container img {
      width: 54px;
      height: auto;
      margin-top: -10px;
    }
  </style>
</head>
<body class="p-3 p-md-4">
  <div class="container">
    <!-- Cabeçalho com Avatar Habbo e Usuário -->
    <header class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 pb-3 border-bottom">
      <div class="d-flex align-items-center gap-3">
        <div class="avatar-container shadow-sm">
          <img id="habboAvatar" src="" alt="Avatar Habbo" onerror="this.src='https://www.habbo.com.br/habbo-imaging/avatarimage?user=Habbo&headonly=1'">
        </div>
        <div>
          <h4 class="mb-0">Painel de Gestão CFO</h4>
          <small class="text-muted"><span id="userNick"></span> (<span id="userNome"></span>)</small>
        </div>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" onclick="toggleTheme()">🌙 / ☀️ Tema</button>
        <button class="btn btn-danger btn-sm" onclick="logout()">Sair</button>
      </div>
    </header>

    <ul class="nav nav-pills mb-4 gap-2">
      <li class="nav-item"><a class="nav-link active" data-bs-toggle="tab" href="#usuariosTab">Usuários</a></li>
      <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#questoesTab">Questões</a></li>
      <li class="nav-item"><a class="nav-link" data-bs-toggle="tab" href="#relatoriosTab">Relatório Geral</a></li>
    </ul>

    <div class="tab-content">
      <!-- Gerenciar Usuários -->
      <div class="tab-pane fade show active" id="usuariosTab">
        <div class="card p-3 mb-4">
          <h5>Cadastrar Novo Usuário</h5>
          <form onsubmit="cadastrarUsuario(event)" class="row g-2">
            <div class="col-md-3"><input type="text" id="usrNome" class="form-control" placeholder="Nome Completo" required></div>
            <div class="col-md-3"><input type="text" id="usrNick" class="form-control" placeholder="Nick Policial" required></div>
            <div class="col-md-3"><input type="password" id="usrSenha" class="form-control" placeholder="Senha" required></div>
            <div class="col-md-2">
              <select id="usrRole" class="form-select">
                <option value="candidato">Candidato / Aluno</option>
                <option value="avaliador">Avaliador</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>
            <div class="col-md-1"><button type="submit" class="btn btn-success w-100">+</button></div>
          </form>
        </div>
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr><th>Avatar</th><th>ID</th><th>Nome</th><th>Nick</th><th>Cargo</th><th>Ação</th></tr>
            </thead>
            <tbody id="tabelaUsuarios"></tbody>
          </table>
        </div>
      </div>

      <!-- Gerenciar Questões -->
      <div class="tab-pane fade" id="questoesTab">
        <div class="card p-3 mb-4">
          <h5>Cadastrar Nova Questão</h5>
          <form onsubmit="cadastrarQuestao(event)" class="vstack gap-2">
            <input type="text" id="qCategoria" class="form-control" placeholder="Categoria" required>
            <input type="text" id="qTitulo" class="form-control" placeholder="Título da Questão" required>
            <textarea id="qEnunciado" class="form-control" placeholder="Enunciado" rows="3" required></textarea>
            <textarea id="qGabarito" class="form-control" placeholder="Gabarito Esperado" rows="2" required></textarea>
            <button type="submit" class="btn btn-primary w-auto align-self-start">Cadastrar Questão</button>
          </form>
        </div>
        <div id="listaQuestoes" class="vstack gap-2"></div>
      </div>

      <!-- Relatório Geral -->
      <div class="tab-pane fade" id="relatoriosTab">
        <div class="table-responsive">
          <table class="table table-striped">
            <thead>
              <tr><th>ID</th><th>Candidato</th><th>Avaliador</th><th>Status</th><th>Nota</th></tr>
            </thead>
            <tbody id="tabelaRelatorios"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    const user = JSON.parse(sessionStorage.getItem('cfo_user') || '{}');
    if (!user.nick) window.location.href = '/index.html';

    // Carregar Informações do Usuário e Avatar do Habbo
    document.getElementById('userNick').innerText = user.nick;
    document.getElementById('userNome').innerText = user.nome || 'Gestor';
    document.getElementById('habboAvatar').src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(user.nick)}&action=std&direction=2&head_direction=2&gesture=sml&size=m`;

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
    }

    function logout() { sessionStorage.clear(); window.location.href = '/index.html'; }

    async function carregarDashboard() {
      const res = await fetch('/api/gestao?action=dashboard');
      const data = await res.json();

      // Tabela de Usuários com mini-avatars Habbo
      document.getElementById('tabelaUsuarios').innerHTML = (data.usuarios || []).map(u => `
        <tr>
          <td><img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(u.nick_policial)}&headonly=1&size=s" alt="Avatar"></td>
          <td>${u.id}</td>
          <td>${u.nome}</td>
          <td>${u.nick_policial}</td>
          <td><span class="badge bg-secondary">${u.role}</span></td>
          <td><button class="btn btn-sm btn-outline-danger" onclick="removerUsuario(${u.id})">Excluir</button></td>
        </tr>
      `).join('');

      // Lista de Questões
      document.getElementById('listaQuestoes').innerHTML = (data.questoes || []).map(q => `
        <div class="card p-3">
          <div class="d-flex justify-content-between">
            <h6>[${q.categoria}] ${q.titulo}</h6>
            <button class="btn btn-sm btn-outline-danger" onclick="excluirQuestao(${q.id})">Excluir</button>
          </div>
          <p class="mb-1">${q.enunciado}</p>
        </div>
      `).join('');

      // Tabela de Relatórios
      document.getElementById('tabelaRelatorios').innerHTML = (data.relatorios || []).map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.candidato_nick}</td>
          <td>${r.avaliador_nick || '-'}</td>
          <td><span class="badge bg-info">${r.status}</span></td>
          <td>${r.nota !== null ? r.nota : '-'}</td>
        </tr>
      `).join('');
    }

    async function cadastrarUsuario(e) {
      e.preventDefault();
      await fetch('/api/gestao?action=cadastrarUsuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: document.getElementById('usrNome').value,
          nick: document.getElementById('usrNick').value,
          senha: document.getElementById('usrSenha').value,
          role: document.getElementById('usrRole').value
        })
      });
      e.target.reset();
      carregarDashboard();
    }

    async function removerUsuario(id) {
      if (!confirm('Excluir este usuário?')) return;
      await fetch('/api/gestao?action=removerUsuario', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      carregarDashboard();
    }

    async function cadastrarQuestao(e) {
      e.preventDefault();
      await fetch('/api/gestao?action=cadastrarQuestao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria: document.getElementById('qCategoria').value,
          titulo: document.getElementById('qTitulo').value,
          enunciado: document.getElementById('qEnunciado').value,
          gabarito: document.getElementById('qGabarito').value
        })
      });
      e.target.reset();
      carregarDashboard();
    }

    async function excluirQuestao(id) {
      if (!confirm('Excluir esta questão?')) return;
      await fetch('/api/gestao?action=excluirQuestao', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      carregarDashboard();
    }

    carregarDashboard();
  </script>
</body>
</html>
