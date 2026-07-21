const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ThY3g6wUrQKP@ep-small-breeze-acsmcqv0.sa-east-1.aws.neon.tech/neondb?sslmode=require";

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000, // Evita que a Vercel trave por timeout de conexão
    });
  }
  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params)
};
