// seed.js — cria o primeiro usuário gestor do sistema
// Rode uma única vez, localmente: node -r dotenv/config seed.js
//
// Antes de rodar:
// 1. Crie um arquivo .env na raiz do projeto (copie o .env.example) com suas credenciais do Firebase.
// 2. Troque a senha e o nick abaixo pelos que você realmente quer usar.
// 3. Rode: npm install dotenv --save-dev   (se ainda não tiver)
// 4. Rode: node -r dotenv/config seed.js

const { db, FieldValue } = require('./api/db.js');
const bcrypt = require('bcryptjs');

const NOME = 'Administrador';
const NICK = 'admin';
const SENHA = 'IJbbxpZEbVSK23cFH1r7PJmte2';

(async () => {
  try {
    const nickBusca = NICK.trim().toLowerCase();

    const existente = await db.collection('usuarios').where('nickBusca', '==', nickBusca).limit(1).get();
    if (!existente.empty) {
      console.log(`Já existe um usuário com o nick "${NICK}". Nada foi criado.`);
      process.exit(0);
    }

    const senhaHash = await bcrypt.hash(SENHA, 10);

    await db.collection('usuarios').add({
      nome: NOME,
      nickPolicial: NICK,
      nickBusca,
      senhaHash,
      role: 'gestor',
      criadoEm: FieldValue.serverTimestamp()
    });

    console.log('✅ Gestor criado com sucesso!');
    console.log(`   Nick: ${NICK}`);
    console.log(`   Senha: ${SENHA}`);
    console.log('   Troque essa senha assim que possível (crie outro gestor pelo painel e apague este, ou implemente troca de senha).');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar gestor:', err);
    process.exit(1);
  }
})();
