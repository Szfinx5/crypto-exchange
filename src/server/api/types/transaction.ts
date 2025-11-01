import { TransactionOperation } from "@server/api/const/transactionOperation";
import { z } from "zod";

const TransactionSchema = z.object({
	operation: z.nativeEnum(TransactionOperation),
	currency: z.string(),
	amount: z.number(),
	userId: z.string(),
	transactionId: z.string().optional(),
});

export const TransactionArraySchema = z.array(TransactionSchema);
export type Transaction = z.infer<typeof TransactionSchema>;
