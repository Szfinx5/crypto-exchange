import type { Status } from "@server/api/const/status";
import type { Redis } from "ioredis";

export const setOrderStatus = async (
	orderId: string,
	status: Status,
	redis: Redis,
) => await redis.set(orderId, status);
