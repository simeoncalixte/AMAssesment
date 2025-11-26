import { createServer } from './server';
import listenMock from '../mock-server';

const start = async (): Promise<void> => {
  try {
    const server = await createServer();
    listenMock();
    await server.listen({ port: 3000 });
    console.log('Server listening on port 3000');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();