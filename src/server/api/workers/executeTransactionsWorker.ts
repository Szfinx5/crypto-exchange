import "dotenv/config";
import { type Job, Worker } from "bullmq";
import chalk from "chalk";
import Redis from "ioredis";
import { env } from "../../../env.js";
import { Status } from "../const/status.ts";
import { setOrderStatus } from "../lib/orderRedis/setOrderStatus.ts";
import type { ExecuteTransactionsJobData } from "../lib/queue.ts";
import { executeTransactions } from "../services/exchangeCalls/executeTransactions.ts";
import fs from "node:fs";

const workerRedis = new Redis(env.QUEUE_REDIS_URL, {
  maxRetriesPerRequest: null,
});
const statusRedis = new Redis(env.STATUS_REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Setting up logging for CloudWatch
if (env.NODE_ENV !== "test") {
  // Prevent double logging due to stdout/stderr hijack in worker
  let lastLog = "";
  const writeOnce = (chunk: any) => {
    const str = typeof chunk === "string" ? chunk : chunk.toString();
    if (str !== lastLog) {
      logStream.write(str);
      lastLog = str;
    }
  };
  const logStream = fs.createWriteStream("/var/log/worker.log", { flags: "a" });

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: any, ...args: any[]) => {
    writeOnce(chunk);
    return origStdoutWrite(chunk, ...args);
  };
  process.stderr.write = (chunk: any, ...args: any[]) => {
    writeOnce(chunk);
    return origStderrWrite(chunk, ...args);
  };
}
export const executeTransactionsWorker = new Worker(
  "execute-transactions",
  async (job: Job<ExecuteTransactionsJobData>) => {
    const { orderId, executeTransactionsRequest } = job.data;
    console.log(
      chalk.blue(`Processing execute transactions for order: ${orderId}`)
    );
    try {
      // Make the API call to execute transactions
      const executeTransactionsResponse = await executeTransactions(
        executeTransactionsRequest
      );
      if (!executeTransactionsResponse)
        throw new Error("Execute transactions response is null");
      console.log(
        chalk.green(`Execute transactions successful for order: ${orderId}`)
      );

      // Update status to COMPLETED
      await setOrderStatus(orderId, Status.COMPLETED, statusRedis);
      return { executeTransactionsResponse };
    } catch (error) {
      console.error(
        chalk.red(`Execute transactions failed for order: ${orderId}`),
        error
      );

      // Update status to FAILED on error
      await setOrderStatus(orderId, Status.FAILED, statusRedis);
      throw error;
    }
  },
  { connection: workerRedis, concurrency: 5 }
);

// Logging for job events
executeTransactionsWorker.on("completed", (job) => {
  console.log(
    chalk.green(
      `Execute transactions job ${job.id} completed for order: ${job.data.orderId}`
    )
  );
});
executeTransactionsWorker.on("failed", (job, err) => {
  console.error(
    chalk.red(
      `Execute transactions job ${job?.id} failed for order: ${job?.data.orderId}`
    ),
    err
  );
});
process.on("SIGTERM", () => executeTransactionsWorker.close());
process.on("SIGINT", () => executeTransactionsWorker.close());
