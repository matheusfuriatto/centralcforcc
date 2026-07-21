const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_ThY3g6wUrQKP@ep-small-breeze-acsmcqv0.sa-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params)
};
