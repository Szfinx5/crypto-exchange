import { env } from "node:process";
import { apiCall } from "@server/api/lib/apiCall";
import {
	type Transaction,
	TransactionArraySchema,
} from "@server/api/types/transaction";

export const executeTransactions = (
	executeTransactionsRequestBody: Transaction[],
) =>
	apiCall<Transaction[], Transaction[]>(
		`${env.EXCHANGE_HOST}/execute-transactions`,
		"POST",
		TransactionArraySchema,
		executeTransactionsRequestBody,
	);
