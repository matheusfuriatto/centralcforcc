const { Pool } = require('@neondatabase/serverless');

// Utiliza a URL do Neon configurada nas variáveis da Vercel ou fallback direto
const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ThY3g6wUrQKP@ep-small-breeze-acsmcqv0.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString });

module.exports = {
  query: (text, params) => pool.query(text, params)
};
