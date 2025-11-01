import { z } from "zod";

export const ExchangePostingRequestSchema = z.object({
	market: z.string(),
	orderType: z.string(),
	side: z.string(),
	buyerUserId: z.string(),
	buyerFunds: z.number(),
	marketPrice: z.number(),
});

export const ExchangePostingResponseSchema = z.object({
	exchangePostingId: z.string(),
	filledSize: z.string(),
	filledFunds: z.string(),
	otherUserId: z.string(),
	buyerUserId: z.string(),
	buyerFunds: z.number(),
	market: z.string(),
	marketPrice: z.number(),
	orderType: z.string(),
	side: z.string(),
});

export type ExchangePostingRequest = z.infer<
	typeof ExchangePostingRequestSchema
>;
export type ExchangePostingResponse = z.infer<
	typeof ExchangePostingResponseSchema
>;
