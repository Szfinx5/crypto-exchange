import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "~/env";
import chalk from "chalk";

// Shared Redis connection for all queues
const queueRedis = new Redis(env.QUEUE_REDIS_URL, { maxRetriesPerRequest: null });

export interface ExchangePostingJobData {
  orderId: string;
  exchangePostingRequest: any;
}
export interface ExecuteTransactionsJobData {
  orderId: string;
  executeTransactionsRequest: any;
}

// Define the two queues
export const exchangePostingQueue = new Queue("exchange-posting", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});
export const executeTransactionsQueue = new Queue("execute-transactions", {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

// Graceful shutdown for local dev
export const closeQueues = async () => {
  console.log(chalk.yellow("Closing queues..."));
  await exchangePostingQueue.close();
  await executeTransactionsQueue.close();
  await queueRedis.quit();
};
process.on("SIGTERM", closeQueues);
process.on("SIGINT", closeQueues);