import { z } from "zod";

export const OrderInputSchema = z.object({
	userId: z.string().uuid(),
	price: z.number().positive(),
	quantity: z.number().positive(),
	side: z.enum(["buy", "sell"]),
	market: z.literal("BTC-USDT"),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export const OrderSchema = OrderInputSchema.extend({
	id: z.string().uuid(),
	type: z.literal("market"),
});

export type Order = z.infer<typeof OrderSchema>;
