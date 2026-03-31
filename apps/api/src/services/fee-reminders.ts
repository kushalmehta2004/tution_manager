import cron from 'node-cron';
import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { runScheduledFeeReminders } from '../modules/fees/fees.service.js';

type ReminderJobData = {
  teacherId?: string;
};

let reminderQueue: Queue<ReminderJobData> | null = null;
let reminderWorker: Worker<ReminderJobData> | null = null;

function redisConnectionString(): string | null {
  return env.REDIS_URL ?? null;
}

function initQueueIfConfigured() {
  const redisUrl = redisConnectionString();
  if (!redisUrl) {
    return;
  }

  reminderQueue = new Queue<ReminderJobData>('fee-reminders', {
    connection: {
      url: redisUrl,
    },
  });

  reminderWorker = new Worker<ReminderJobData>(
    'fee-reminders',
    async (job) => {
      await runScheduledFeeReminders(job.data.teacherId);
    },
    {
      connection: {
        url: redisUrl,
      },
    },
  );

  reminderWorker.on('failed', (job, error) => {
    console.error('Fee reminder job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });
}

export function startFeeReminderScheduler() {
  initQueueIfConfigured();

  if (!cron.validate(env.FEE_REMINDER_CRON)) {
    console.warn(`Invalid FEE_REMINDER_CRON: ${env.FEE_REMINDER_CRON}. Fee reminder scheduler disabled.`);
    return;
  }

  cron.schedule(env.FEE_REMINDER_CRON, async () => {
    try {
      if (reminderQueue) {
        await reminderQueue.add('daily-reminder-run', {});
        return;
      }

      await runScheduledFeeReminders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scheduler error';
      console.error('Fee reminder scheduler run failed', message);
    }
  });

  console.log(`Fee reminder scheduler started (${env.FEE_REMINDER_CRON})`);
}
