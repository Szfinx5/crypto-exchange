import { createOrders } from "@server/api/services/createOrders";
import { OrderInputSchema } from "@server/api/types/order";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getOrderStatus } from "../lib/orderRedis/getOrderStatus";
import { z } from "zod";

export const orderRouter = createTRPCRouter({
	create: publicProcedure
		.input(OrderInputSchema)
		.mutation(async ({ input, ctx }) => {
			const { redis } = ctx;
			return createOrders(input, redis);
		}),

		    getStatus: publicProcedure
        .input(z.object({ orderId: z.string() }))
        .query(async ({ input, ctx }) => {
            const { redis } = ctx;
            const status = await getOrderStatus(input.orderId, redis);
            return { status };
        }),

	get: publicProcedure.query(() => {
		return null;
	}),
});
