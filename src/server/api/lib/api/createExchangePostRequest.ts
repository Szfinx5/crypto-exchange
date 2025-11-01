import type { ExchangePostingRequest } from "@server/api/types/exchangePostingTypes";
import type { Order } from "@server/api/types/order";

export const createExchangePostingRequest = (
	order: Order,
): ExchangePostingRequest => ({
	market: order.market,
	orderType: order.type,
	side: order.side,
	buyerUserId: order.userId,
	buyerFunds: order.quantity,
	marketPrice: order.price,
});
