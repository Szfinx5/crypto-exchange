import { Status } from "@server/api/const/status";
import { setOrderStatus } from "@server/api/lib/orderRedis/setOrderStatus";
import type { Order, OrderInput } from "@server/api/types/order";
import chalk from "chalk";
import type { Redis } from "ioredis";
import { createExchangePostingRequest } from "../lib/api/createExchangePostRequest";
import { exchangePostingQueue } from "../lib/queue";

function getRandomUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 version 4 compliant UUID
return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  const v = c === "x" ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});
}

export const createOrders = async (input: OrderInput, redis: Redis) => {
	const id = getRandomUUID();
	const order: Order = { ...input, id, type: "market" };
	const status = Status.PENDING;
	await setOrderStatus(id, status, redis);

	/**
	 * TODO: make exchange posting and execute transactions resilient
	 * due to api call failures
	 * */
	try {
		const exchangePostingRequest = createExchangePostingRequest(order);
		console.log(chalk.blue(`Creating order: ${id}`));

		// Add job to the first queue
		const job = await exchangePostingQueue.add("exchange-posting", {
			orderId: id,
			exchangePostingRequest,
		});
		console.log(
			chalk.green(`Order ${id} queued for processing with job ID: ${job.id}`),
		);
	} catch (error) {
		console.error(chalk.red("createOrders FAILED, Error: "), error);
		await setOrderStatus(id, Status.FAILED, redis);
		throw error;
	}
	return { order, status };
};
