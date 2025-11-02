import { Status } from "@server/api/const/status";
import { setOrderStatus } from "@server/api/lib/orderRedis/setOrderStatus";
import type { Order, OrderInput } from "@server/api/types/order";
import type { Redis } from "ioredis";
import { createExchangePostingRequest } from "../lib/api/createExchangePostRequest";
import { createExchangePosting } from "./exchangeCalls/exchangePosting";
import { getCurrenciesFromMarket } from "../util/getCurrencies";
import { createExecuteTransactionsRequest } from "../lib/api/createExecuteTransactionsRequest";
import type { ExchangeOperation } from "../types/exchangeOperation";
import { executeTransactions } from "./exchangeCalls/executeTransactions";
import chalk from "chalk";
import { exchangePostingQueue } from "../lib/queue";

export const createOrders = async (input: OrderInput, redis: Redis) => {
  const id = crypto.randomUUID();
  const order: Order = { ...input, id, type: "market" };
  const status = Status.PENDING;
  await setOrderStatus(id, status, redis);

  /**
   * TODO: make exchange posting and execute transactions resilient
   * due to api call failures
   * */
  try {
    const exchangePostingRequest = createExchangePostingRequest(order);
     console.log(chalk.blue(`Creating order: ${id}`));

     // Add job to the first queue
    const job = await exchangePostingQueue.add("exchange-posting", {
      orderId: id,
      exchangePostingRequest,
    });
    console.log(chalk.green(`Order ${id} queued for processing with job ID: ${job.id}`));

    // const exchangePostingResponse = await createExchangePosting(
    //   exchangePostingRequest
    // );
    // console.log("exchangePostingResponse:", exchangePostingResponse);
    // if (exchangePostingResponse) {
    //   console.log(chalk.green("exchangePostingResponse SUCCESS"));
    //   const [sellerCurrency, buyerCurrency] = getCurrenciesFromMarket(
    //     order.market
    //   );

    //   const seller: ExchangeOperation = {
    //     amount: Number.parseFloat(exchangePostingResponse.filledSize),
    //     userId: exchangePostingResponse.otherUserId,
    //     currency: sellerCurrency,
    //   };
    //   const buyer: ExchangeOperation = {
    //     amount: Number.parseFloat(exchangePostingResponse.filledFunds),
    //     userId: exchangePostingResponse.buyerUserId,
    //     currency: buyerCurrency,
    //   };
    //   const executeTransactionsRequestBody = createExecuteTransactionsRequest(
    //     seller,
    //     buyer
    //   );
    //   console.log(chalk.blue("executeTransactions"));
    //   const executeTransactionsResponse = await executeTransactions(
    //     executeTransactionsRequestBody
    //   );
    //   console.log("executeTransactionsResponse:", executeTransactionsResponse);
    //   if (executeTransactionsResponse) {
    //     console.log(chalk.green("executeTransactionsResponse SUCCESS"));
    //     await setOrderStatus(id, Status.COMPLETED, redis);
    //   } else {
    //     console.log(
    //       chalk.red("executeTransactions FAILED, Response: "),
    //       executeTransactionsResponse
    //     );
    //     await setOrderStatus(id, Status.FAILED, redis);
    //   }
    // } else {
    //   console.log(chalk.red("exchangePostingResponse FAILED"));
    //   await setOrderStatus(id, Status.FAILED, redis);
    // }
  } catch (error) {
    console.error(chalk.red("createOrders FAILED, Error: "), error);
    await setOrderStatus(id, Status.FAILED, redis);
    throw error;
  }
  return { order, status };
};
