function checkAuth(roleEsperada = null) {
  const user = JSON.parse(sessionStorage.getItem('cfo_user'));

  if (!user) {
    window.location.href = '/index.html';
    return null;
  }

  if (roleEsperada && user.role !== roleEsperada) {
    // Redireciona para seu próprio painel se tentar acessar rota proibida
    redirecionarPorRole(user.role);
    return null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const elName = document.getElementById('user-display-name');
    const elRole = document.getElementById('user-role-badge');
    if (elName) elName.innerText = `${user.nome} (${user.nick})`;
    if (elRole) elRole.innerText = `ACESSO: ${user.role.toUpperCase()}`;
  });

  return user;
}

function redirecionarPorRole(role) {
  if (role === 'candidato') window.location.href = '/aluno.html';
  else if (role === 'avaliador') window.location.href = '/avaliador.html';
  else if (role === 'gestor') window.location.href = '/gestao.html';
}

function logout() {
  sessionStorage.removeItem('cfo_user');
  window.location.href = '/index.html';
}
