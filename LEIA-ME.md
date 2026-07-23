# Central CFO — Migração para Firebase

## O que mudou

- **Banco de dados**: saiu Postgres/Neon, entrou **Firestore** (Firebase). Não usa mais `pg` nem `@vercel/postgres`.
- **Senhas**: agora armazenadas com hash `bcrypt` (nunca mais em texto puro). Contas antigas do Postgres **não migram automaticamente** — os usuários precisam ser recriados pelo painel do gestor.
- **Arquivos duplicados removidos**: `gestao.js` (que na verdade era HTML quebrado) e `candidato.js` (duplicava `aluno.js`) foram eliminados. `aluno.js` agora cobre tudo (dúvidas + avaliações do candidato).
- **API do gestor criada do zero** (`/api/gestor.js`) — antes o `gestao.html` chamava rotas que não existiam.
- **Nova funcionalidade**: o aluno agora tem uma aba "Realizar Avaliação" para digitar o token, responder as questões e enviar — isso não existia na interface antes, só na API.
- **Bug de status corrigido**: o envio da prova agora marca `Submetido` (antes marcava `Aguardando Correção`, e o avaliador só reconhecia `Submetido` — a correção nunca aparecia).
- **`gerarToken`** agora cria a conta do candidato automaticamente (com senha temporária exibida uma única vez), preenchendo a lacuna que existia entre gerar o token e o candidato conseguir logar.
- Todas as páginas usam `checkAuth(role)` centralizado — antes cada página fazia sua própria verificação manual e inconsistente.

## Passo a passo para colocar no ar

### 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e crie um projeto novo.
2. Ative o **Firestore Database** (modo produção).
3. Vá em **Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Isso baixa um JSON.

### 2. Configurar variáveis de ambiente na Vercel
No painel do seu projeto na Vercel, em **Settings → Environment Variables**, adicione (veja `.env.example`):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (cole o valor exatamente como está no JSON baixado, incluindo os `\n`)

### 3. Instalar dependências
```bash
npm install
```

### 4. Criar o primeiro usuário gestor
Como o sistema é novo, ainda não existe nenhum usuário. Já incluí o arquivo `seed.js` na raiz do projeto para isso. Rode **uma única vez**, localmente:

1. Crie um arquivo `.env` na raiz do projeto (copie o `.env.example`) com suas credenciais do Firebase.
2. Abra `seed.js` e troque o `NICK` e a `SENHA` padrão pelos que você quer usar de verdade.
3. Instale o `dotenv` (já está no `package.json` como devDependency): `npm install`
4. Rode:
   ```bash
   node -r dotenv/config seed.js
   ```
5. Confira no console: deve aparecer "✅ Gestor criado com sucesso!".

Depois disso, use o painel do gestor (`gestao.html`) para cadastrar avaliadores e outros gestores — não precisa mais rodar scripts manuais. Recomendo trocar a senha padrão do `admin` logo em seguida (crie outro gestor com senha definitiva e remova o `admin` pelo painel).

### 5. Deploy
```bash
vercel --prod
```

## Estrutura de dados no Firestore

- **usuarios**: `{ nome, nickPolicial, nickBusca, senhaHash, role, criadoEm }`
- **questoes**: `{ categoria, titulo, enunciado, gabaritoEsperado, criadoEm }`
- **provas**: `{ tokenUtilizado, candidatoNick, candidatoNickBusca, avaliadorNick, status, questoesJson, respostasJson, nota, feedbackAvaliador, criadoEm, corrigidoEm }`
- **duvidas**: `{ alunoNick, alunoNickBusca, titulo, pergunta, status, avaliadorNick, resposta, criadoEm, respondidoEm }`

`status` de uma prova segue: `Pendente` → `Em Andamento` → `Submetido` → `Corrigido`.

## ⚠️ Ainda pendente (recomendo resolver antes de ir para produção)

1. **Índices do Firestore**: as queries com `where` + `orderBy` combinados (ex: `minhasAvaliacoes`, `minhasDuvidas`) vão pedir a criação de um índice composto na primeira execução. O Firestore mostra um link direto no erro do console da Vercel — é só clicar para criar.
2. **Regras de segurança do Firestore**: como todo acesso é só pela API (que usa a chave de admin), configure as regras do Firestore para **negar tudo** direto do client:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
3. **Autenticação continua "fraca" por design** (a seu pedido): qualquer pessoa que descubra a URL de uma rota de API pode chamá-la diretamente sem sessão de servidor, contanto que saiba os parâmetros — o `sessionStorage` só controla o *front-end*. Se algum dia quiser travar isso melhor sem trocar toda a arquitetura, dá pra adicionar um token simples de sessão sem precisar de JWT completo.
4. Rotacione a senha do banco Postgres antigo que estava exposta no código — mesmo saindo de uso, ela ficou em texto puro no histórico do repositório.
