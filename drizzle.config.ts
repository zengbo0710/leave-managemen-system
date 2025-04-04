import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: 'ep-proud-frost-a1bx9pnf-pooler.ap-southeast-1.aws.neon.tech',
    user: 'neondb_owner',
    password: 'npg_OjPk20aDJstd',
    database: 'neondb',
    ssl: 'require'
  }
} satisfies Config;
