import Redis from "ioredis";
import { env } from "~/env";

const redisUrl = env.STATUS_REDIS_URL;

let client: Redis;

const initializeRedisClient = () => {
	client = new Redis(redisUrl);

	client.on("error", (err: Error) => {
		console.error("Redis client error:", err);
	});

	client.on("connect", () => {
		console.info("Connected to Redis successfully");
	});
};

export const getRedisClient = (): Redis => {
	if (!client) {
		initializeRedisClient();
	}
	return client;
};
