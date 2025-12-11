// Prisma 7 configuration file
// Manages database connection URLs and migration settings
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // DATABASE_URL must be set in .env.local before running migrations
    url: env('DATABASE_URL', { required: true }),
  },
});
