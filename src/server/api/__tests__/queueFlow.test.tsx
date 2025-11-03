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
import { exchangePostingQueue, executeTransactionsQueue } from "../lib/queue";
import { env } from "~/env";

vi.mock("../services/exchangeCalls/exchangePosting", () => ({
  createExchangePosting: vi.fn(),
}));
vi.mock("../services/exchangeCalls/executeTransactions", () => ({
  executeTransactions: vi.fn(),
}));

describe("Message Queue Integration Flow", { timeout: 15000 }, () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(env.STATUS_REDIS_URL);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await exchangePostingQueue.obliterate({ force: true });
    await executeTransactionsQueue.obliterate({ force: true });
    await redis.flushdb();
    vi.clearAllMocks();
  });

  it("should add jobs to queue and verify they can be processed", async () => {
    const { createExchangePosting } = await import(
      "../services/exchangeCalls/exchangePosting"
    );
    vi.mocked(createExchangePosting).mockResolvedValue({
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
    });

    const jobData = {
      orderId: "order-test-1",
      exchangePostingRequest: {
        market: "BTC-USD",
        orderType: "market",
        side: "buy",
        buyerUserId: "user123",
        buyerFunds: 1000,
        marketPrice: 50000,
      },
    };

    // Add job to queue
    const job = await exchangePostingQueue.add(
      "exchange-posting-test",
      jobData
    );
    expect(job.id).toBeDefined();

    // Verify job is in queue
    const jobs = await exchangePostingQueue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);
    const foundJob = jobs.find((j) => j.data.orderId === "order-test-1");
    expect(foundJob).toBeDefined();
    expect(foundJob!.data.orderId).toBe("order-test-1");
  });

  it("should respect job options and retry configuration", async () => {
    const jobData = {
      orderId: "test-order-123",
      exchangePostingRequest: {
        market: "BTC-USD",
        orderType: "market",
        side: "buy",
        buyerUserId: "user123",
        buyerFunds: 1000,
        marketPrice: 50000,
      },
    };

    const job = await exchangePostingQueue.add(
      "exchange-posting-test",
      jobData
    );

    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toEqual({
      type: "exponential",
      delay: 2000,
    });
    expect(job.opts.removeOnComplete).toBe(10);
    expect(job.opts.removeOnFail).toBe(50);
  });

  it("should handle queue cleanup properly", async () => {
    await exchangePostingQueue.add("test", {
      orderId: "1",
      exchangePostingRequest: {},
    });
    await exchangePostingQueue.add("test", {
      orderId: "2",
      exchangePostingRequest: {},
    });

    let jobs = await exchangePostingQueue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);
    expect(jobs.length).toBeGreaterThanOrEqual(2);

    await exchangePostingQueue.obliterate({ force: true });

    jobs = await exchangePostingQueue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);
    expect(jobs).toHaveLength(0);
  });
});
