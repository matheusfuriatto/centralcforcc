function checkAuth(roleEsperada = null) {
  const user = JSON.parse(sessionStorage.getItem('cfo_user') || 'null');

  if (!user || !user.nick) {
    window.location.href = '/index.html';
    return null;
  }

  if (roleEsperada && user.role !== roleEsperada) {
    redirecionarPorRole(user.role);
    return null;
  }

  return user;
}

function redirecionarPorRole(role) {
  if (role === 'candidato') window.location.href = '/aluno.html';
  else if (role === 'avaliador') window.location.href = '/avaliador.html';
  else if (role === 'gestor') window.location.href = '/gestao.html';
  else window.location.href = '/index.html';
}

function logout() {
  sessionStorage.removeItem('cfo_user');
  window.location.href = '/index.html';
}

function habboAvatarUrl(nick) {
  return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&action=std&direction=2&head_direction=2&gesture=sml&size=m`;
}
