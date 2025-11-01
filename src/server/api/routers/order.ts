import { createOrders } from "@server/api/services/createOrders";
import { OrderInputSchema } from "@server/api/types/order";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const orderRouter = createTRPCRouter({
	create: publicProcedure
		.input(OrderInputSchema)
		.mutation(async ({ input, ctx }) => {
			const { redis } = ctx;
			return createOrders(input, redis);
		}),

	get: publicProcedure.query(() => {
		return null;
	}),
});
