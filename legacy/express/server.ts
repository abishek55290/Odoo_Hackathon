import { createApp } from './app';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { logger } from '@/lib/logger';

const app = createApp();

async function main() {
  try {
    // Verify database connectivity before accepting traffic
    await prisma.$connect();
    logger.info('Database connected');

    const server = app.listen(env.PORT, () => {
      logger.info(`Server listening`, {
        port: env.PORT,
        env: env.NODE_ENV,
        url: `http://localhost:${env.PORT}`,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Goodbye.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Failed to start server', { error: String(err) });
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
