// filepath: infra/stacks/AppStack.ts
export async function AppStack({ stack }) {
  const { NextjsSite, Redis, Container } = await import("sst/constructs");

  // Redis Serverless
  const redis = new Redis.Serverless(stack, "RedisServerless", {});

  // Next.js app
  const site = new NextjsSite(stack, "NextSite", {
    path: "../../",
    environment: {
      QUEUE_REDIS_URL: redis.clusterEndpoint,
      STATUS_REDIS_URL: redis.clusterEndpoint,
    },
  });

  // ECS Fargate worker containers
  const exchangeWorker = new Container(stack, "ExchangeWorker", {
    image: "../../src/server/api/workers/Dockerfile",
    environment: {
      QUEUE_REDIS_URL: redis.clusterEndpoint,
      STATUS_REDIS_URL: redis.clusterEndpoint,
    },
    cpu: "256",
    memory: "512",
    desiredCount: 1,
  });

  // const executeWorker = new Container(stack, "ExecuteWorker", {
  //   image: "../../src/server/api/workers/executeWorker.Dockerfile",
  //   environment: {
  //     QUEUE_REDIS_URL: redis.clusterEndpoint,
  //     STATUS_REDIS_URL: redis.clusterEndpoint,
  //   },
  //   cpu: "256",
  //   memory: "512",
  //   desiredCount: 1,
  // });

  stack.addOutputs({
    SiteUrl: site.url,
    RedisEndpoint: redis.clusterEndpoint,
    ExchangeWorkerUrl: exchangeWorker.url,
    ExecuteWorkerUrl: executeWorker.url,
  });
}