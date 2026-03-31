import { createApp } from './app.js';
import { env } from './config/env.js';
import { startFeeReminderScheduler } from './services/fee-reminders.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API server running on http://localhost:${env.PORT}`);
  startFeeReminderScheduler();
});