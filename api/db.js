const admin = require("firebase-admin");

if (!admin.apps.length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  // Se a chave estiver em Base64 (sem espaçamentos/formatos PEM diretos), decodifica
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    try {
      privateKey = Buffer.from(privateKey, "base64").toString("utf8");
    } catch (e) {
      // Se não for base64, mantém como está
    }
  }

  // Substitui literais \n por quebras de linha reais
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !privateKey
  ) {
    console.error(
      "Variáveis de ambiente do Firebase ausentes. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na Vercel.",
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

module.exports = { db, admin, FieldValue };
