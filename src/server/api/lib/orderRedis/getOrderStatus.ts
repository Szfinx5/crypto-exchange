import type { Status } from "@server/api/const/status";
import type { Redis } from "ioredis";

export const getOrderStatus = async (orderId: string, redis: Redis) =>
	(await redis.get(orderId)) as Status | null;
