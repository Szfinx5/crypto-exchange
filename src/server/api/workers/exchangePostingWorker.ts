import "dotenv/config";
import { type Job, Worker } from "bullmq";
import chalk from "chalk";
import Redis from "ioredis";
import { env } from "../../../env.js";
import { Status } from "../const/status.ts";
import { createExecuteTransactionsRequest } from "../lib/api/createExecuteTransactionsRequest.ts";
import { setOrderStatus } from "../lib/orderRedis/setOrderStatus.ts";
import {
	type ExchangePostingJobData,
	executeTransactionsQueue,
} from "../lib/queue.ts";
import { createExchangePosting } from "../services/exchangeCalls/exchangePosting.ts";
import type { ExchangeOperation } from "../types/exchangeOperation.ts";
import { getCurrenciesFromMarket } from "../util/getCurrencies.ts";

// Separate Redis connections for worker and status
const workerRedis = new Redis(env.QUEUE_REDIS_URL, {
	maxRetriesPerRequest: null,
});
const statusRedis = new Redis(env.STATUS_REDIS_URL, {
	maxRetriesPerRequest: null,
});

// Worker for "exchange-posting" jobs
export const exchangePostingWorker = new Worker(
	"exchange-posting",
	async (job: Job<ExchangePostingJobData>) => {
		const { orderId, exchangePostingRequest } = job.data;
		console.log(
			chalk.blue(
				`Processing exchange posting for order: ${orderId}, attempt: ${job.attemptsMade + 1}`,
			),
		);
		try {
			// Update status to IN_PROGRESS and make the API call
			await setOrderStatus(orderId, Status.IN_PROGRESS, statusRedis);
			const exchangePostingResponse = await createExchangePosting(
				exchangePostingRequest,
			);
			if (!exchangePostingResponse)
				throw new Error("Exchange posting response is null");
			console.log(
				chalk.green(`Exchange posting successful for order: ${orderId}`),
			);

			// Format transaction currencies
			const [sellerCurrency, buyerCurrency] = getCurrenciesFromMarket(
				exchangePostingRequest.market,
			);
			const seller: ExchangeOperation = {
				amount: Number.parseFloat(exchangePostingResponse.filledSize),
				userId: exchangePostingResponse.otherUserId,
				currency: sellerCurrency,
			};
			const buyer: ExchangeOperation = {
				amount: Number.parseFloat(exchangePostingResponse.filledFunds),
				userId: exchangePostingResponse.buyerUserId,
				currency: buyerCurrency,
			};
			const executeTransactionsRequestBody = createExecuteTransactionsRequest(
				seller,
				buyer,
			);

			// Add job to execute transactions queue
			await executeTransactionsQueue.add(
				"execute-transactions",
				{ orderId, executeTransactionsRequest: executeTransactionsRequestBody },
				{ delay: 1000 },
			);
			return {
				exchangePostingResponse,
				executeTransactionsRequest: executeTransactionsRequestBody,
			};
		} catch (error) {
			console.error(
				chalk.red(
					`Exchange posting failed for order: ${orderId}, attempt: ${job.attemptsMade + 1}`,
				),
				error,
			);

			// Update status to FAILED on error
			await setOrderStatus(orderId, Status.FAILED, statusRedis);
			throw error;
		}
	},
	{ connection: workerRedis, concurrency: 5 },
);

// Logging for job events
exchangePostingWorker.on("completed", (job) => {
	console.log(
		chalk.green(
			`Exchange posting job ${job.id} completed for order: ${job.data.orderId}`,
		),
	);
});
exchangePostingWorker.on("failed", (job, err) => {
	console.error(
		chalk.red(
			`Exchange posting job ${job?.id} failed for order: ${job?.data.orderId}`,
		),
		err,
	);
});
exchangePostingWorker.on("stalled", (jobId) => {
	console.warn(
		chalk.yellow(`Exchange posting job ${jobId} stalled and will be retried.`),
	);
});
exchangePostingWorker.on("error", (err) => {
	console.error(chalk.red("Worker encountered an error:"), err);
});
process.on("uncaughtException", (err) => {
	console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
	console.error("Unhandled Rejection:", reason);
});

process.on("SIGTERM", () => exchangePostingWorker.close());
process.on("SIGINT", () => exchangePostingWorker.close());
