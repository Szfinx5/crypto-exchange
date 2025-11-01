import { TransactionOperation } from "@server/api/const/transactionOperation";
import type { ExchangeOperation } from "@server/api/types/exchangeOperation";
import type { Transaction } from "@server/api/types/transaction";

export const createExecuteTransactionsRequest = (
	seller: ExchangeOperation,
	buyer: ExchangeOperation,
): Transaction[] => [
	{
		operation: TransactionOperation.DECREASE,
		currency: seller.currency,
		amount: seller.amount,
		userId: seller.userId,
	},
	{
		operation: TransactionOperation.DECREASE,
		currency: buyer.currency,
		amount: buyer.amount,
		userId: buyer.userId,
	},
	{
		operation: TransactionOperation.INCREASE,
		currency: buyer.currency,
		amount: buyer.amount,
		userId: seller.userId,
	},
	{
		operation: TransactionOperation.INCREASE,
		currency: seller.currency,
		amount: seller.amount,
		userId: buyer.userId,
	},
];
