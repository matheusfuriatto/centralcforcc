import { neon } from '@neondatabase/serverless';

// String de conexão direta para ambiente de testes/desenvolvimento
const DATABASE_URL = 'postgresql://neondb_owner:npg_ThY3g6wUrQKP@ep-small-breeze-acsmcqv0.sa-east-1.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(DATABASE_URL);
