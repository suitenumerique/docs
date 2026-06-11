import { bootGateway } from '@/boot';
import { PORT } from '@/env';

const main = async () => {
  const gateway = await bootGateway();
  gateway.server.listen(PORT, () =>
    console.log('App listening on port :', PORT),
  );

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void gateway.shutdown().then(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

main().catch((error) => {
  console.error('Failed to start yhub server:', error);
  process.exit(1);
});
