import { createApp } from './app.js';
import { createServices } from './container.js';
import { createMemoryStore } from './repositories/memoryStore.js';
import { seedDemoData } from './seed.js';

const port = Number(process.env.PORT ?? 3000);

const services = createServices({ store: createMemoryStore() });
if (process.env.SEED !== 'false') seedDemoData(services);

createApp(services).listen(port, () => {
  console.log(`Booking app running at http://localhost:${port}`);
});
