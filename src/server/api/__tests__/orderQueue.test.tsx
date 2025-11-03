import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Redis from "ioredis";
import { Worker } from "bullmq";
import { createOrders } from "../services/createOrders";
import { getOrderStatus } from "../lib/orderRedis/getOrderStatus";
import { Status } from "../const/status";
import { exchangePostingQueue, executeTransactionsQueue } from "../lib/queue";
import { setOrderStatus } from "../lib/orderRedis/setOrderStatus";
import { env } from "~/env";

// Mock API calls
vi.mock("../services/exchangeCalls/exchangePosting", () => ({
  createExchangePosting: vi.fn(),
}));
vi.mock("../services/exchangeCalls/executeTransactions", () => ({
  executeTransactions: vi.fn(),
}));

import { TransactionOperation } from "../const/transactionOperation";

const mockTransactions = [
  {
    transactionId: "tx1",
    operation: TransactionOperation.DECREASE,
    currency: "BTC",
    amount: 0.02,
    userId: "seller123",
  },
  {
    transactionId: "tx2",
    operation: TransactionOperation.DECREASE,
    currency: "USD",
    amount: 1000,
    userId: "user123",
  },
  {
    transactionId: "tx3",
    operation: TransactionOperation.INCREASE,
    currency: "USD",
    amount: 1000,
    userId: "seller123",
  },
  {
    transactionId: "tx4",
    operation: TransactionOperation.INCREASE,
    currency: "BTC",
    amount: 0.02,
    userId: "user123",
  },
];

describe("Order Queue Integration Flow", { timeout: 15000 }, () => {
  let redis: Redis;
  let workers: Worker[] = [];

  beforeAll(async () => {
    redis = new Redis(env.STATUS_REDIS_URL);
  });

  afterAll(async () => {
    await Promise.all(workers.map((w) => w.close()));
    await redis.quit();
  });

  beforeEach(async () => {
    await exchangePostingQueue.obliterate({ force: true });
    await executeTransactionsQueue.obliterate({ force: true });
    await redis.flushdb();
    await Promise.all(workers.map((w) => w.close()));
    workers = [];
    vi.clearAllMocks();
  });

  it("processes the full order queue flow and completes", async () => {
    const { createExchangePosting } = await import(
      "../services/exchangeCalls/exchangePosting"
    );
    const { executeTransactions } = await import(
      "../services/exchangeCalls/executeTransactions"
    );

    vi.mocked(createExchangePosting).mockImplementation(async (...args) => {
      return {
        exchangePostingId: "post123",
        filledSize: "0.02",
        filledFunds: "1000",
        otherUserId: "seller123",
        buyerUserId: "user123",
        buyerFunds: 1000,
        market: "BTC-USD",
        marketPrice: 50000,
        orderType: "market",
        side: "buy",
      };
    });
    vi.mocked(executeTransactions).mockImplementation(async (...args) => {
      return mockTransactions;
    });

    // Exchange posting worker
    const exchangeWorker = new Worker(
      "exchange-posting",
      async (job) => {
        const { orderId, exchangePostingRequest } = job.data;
        await setOrderStatus(orderId, Status.IN_PROGRESS, redis);
        const exchangePostingResponse = await createExchangePosting(
          exchangePostingRequest
        );
        await executeTransactionsQueue.add("execute-transactions", {
          orderId,
          executeTransactionsRequest: mockTransactions,
        });
        return { exchangePostingResponse };
      },
      { connection: await exchangePostingQueue.client }
    );
    workers.push(exchangeWorker);

    // Execute transactions worker
    const executeWorker = new Worker(
      "execute-transactions",
      async (job) => {
        const { orderId, executeTransactionsRequest } = job.data;
        await executeTransactions(executeTransactionsRequest);
        await setOrderStatus(orderId, Status.COMPLETED, redis);
        return { success: true };
      },
      { connection: await executeTransactionsQueue.client }
    );
    workers.push(executeWorker);

    // Create order
    const orderInput = {
      userId: "user123",
      market: "BTC-USDT" as const,
      side: "buy" as const,
      quantity: 1000,
      price: 50000,
    };
    const { order } = await createOrders(orderInput, redis);

    // Wait for completion
    let finalStatus: string | null = null;
    const startTime = Date.now();
    const timeout = 10000;
    while (Date.now() - startTime < timeout) {
      finalStatus = await getOrderStatus(order.id, redis);
      if (finalStatus === Status.COMPLETED) break;
      await new Promise((res) => setTimeout(res, 100));
    }

    if (finalStatus !== Status.COMPLETED) {
      const failedJobs = await exchangePostingQueue.getFailed();
      if (failedJobs.length > 0) {
        console.error(
          "ExchangePosting failed reason:",
          failedJobs[0]?.failedReason
        );
      }
      const failedExecJobs = await executeTransactionsQueue.getFailed();
      if (failedExecJobs.length > 0) {
        console.error(
          "ExecuteTransactions failed reason:",
          failedExecJobs[0]?.failedReason
        );
      }
    }

    expect(finalStatus).toBe(Status.COMPLETED);
  });

  it("retries failed exchange posting and completes on retry", async () => {
    const { createExchangePosting } = await import(
      "../services/exchangeCalls/exchangePosting"
    );
    const { executeTransactions } = await import(
      "../services/exchangeCalls/executeTransactions"
    );

    // First call fails, second call succeeds
    let callCount = 0;
    vi.mocked(createExchangePosting).mockImplementation(async (...args) => {
      callCount++;
      if (callCount === 1) throw new Error("Simulated failure");
      return {
        exchangePostingId: "post123",
        filledSize: "0.02",
        filledFunds: "1000",
        otherUserId: "seller123",
        buyerUserId: "user123",
        buyerFunds: 1000,
        market: "BTC-USD",
        marketPrice: 50000,
        orderType: "market",
        side: "buy",
      };
    });
    vi.mocked(executeTransactions).mockImplementation(async (...args) => {
      return mockTransactions;
    });

    // Exchange posting worker
    const exchangeWorker = new Worker(
      "exchange-posting",
      async (job) => {
        const { orderId, exchangePostingRequest } = job.data;
        await setOrderStatus(orderId, Status.IN_PROGRESS, redis);
        const exchangePostingResponse = await createExchangePosting(
          exchangePostingRequest
        );
        await executeTransactionsQueue.add("execute-transactions", {
          orderId,
          executeTransactionsRequest: mockTransactions,
        });
        return { exchangePostingResponse };
      },
      { connection: await exchangePostingQueue.client }
    );
    workers.push(exchangeWorker);

    // Execute transactions worker
    const executeWorker = new Worker(
      "execute-transactions",
      async (job) => {
        const { orderId, executeTransactionsRequest } = job.data;
        await executeTransactions(executeTransactionsRequest);
        await setOrderStatus(orderId, Status.COMPLETED, redis);
        return { success: true };
      },
      { connection: await executeTransactionsQueue.client }
    );
    workers.push(executeWorker);

    // Create order
    const orderInput = {
      userId: "user123",
      market: "BTC-USDT" as const,
      side: "buy" as const,
      quantity: 1000,
      price: 50000,
    };
    const { order } = await createOrders(orderInput, redis);

    // Wait for completion
    let finalStatus: string | null = null;
    const startTime = Date.now();
    const timeout = 10000;
    while (Date.now() - startTime < timeout) {
      finalStatus = await getOrderStatus(order.id, redis);
      if (finalStatus === Status.COMPLETED) break;
      await new Promise((res) => setTimeout(res, 100));
    }

    if (finalStatus !== Status.COMPLETED) {
      const failedJobs = await exchangePostingQueue.getFailed();
      if (failedJobs.length > 0) {
        console.error(
          "ExchangePosting failed reason:",
          failedJobs[0]?.failedReason
        );
      }
      const failedExecJobs = await executeTransactionsQueue.getFailed();
      if (failedExecJobs.length > 0) {
        console.error(
          "ExecuteTransactions failed reason:",
          failedExecJobs[0]?.failedReason
        );
      }
    }

    if (finalStatus !== Status.COMPLETED) {
      const job = await exchangePostingQueue.getJobs([
        "failed",
        "waiting",
        "active",
        "completed",
      ]);
      console.error(
        "ExchangePosting job state(s):",
        await Promise.all(
          job.map(async (j) => ({
            id: j.id,
            attemptsMade: j.attemptsMade,
            failedReason: j.failedReason,
            state: await j.getState(),
          }))
        )
      );
    }

    expect(finalStatus).toBe(Status.COMPLETED);
    // Ensure retry happened
    expect(callCount).toBeGreaterThan(1);
  });
});
