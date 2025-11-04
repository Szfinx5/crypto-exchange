// filepath: infra/stacks/AppStack.ts
import { StackContext, NextjsSite, Redis, Container } from "sst/constructs";

export function AppStack({ stack }: StackContext) {
  // Redis Serverless
  const redis = new Redis.Serverless(stack, "RedisServerless", {});

  // Next.js app
  const site = new NextjsSite(stack, "NextSite", {
    path: "../",
    environment: {
      QUEUE_REDIS_URL: redis.clusterEndpoint,
      STATUS_REDIS_URL: redis.clusterEndpoint,
    },
  });

  // ECS Fargate worker container
  const exchangeWorker = new Container(stack, "ExchangeWorker", {
    image: "src/server/api/workers/Dockerfile", 
    environment: {
      QUEUE_REDIS_URL: redis.clusterEndpoint,
      STATUS_REDIS_URL: redis.clusterEndpoint,
    },
    cpu: "256", 
    memory: "512", 
    desiredCount: 1,
  });


  stack.addOutputs({
    SiteUrl: site.url,
    RedisEndpoint: redis.clusterEndpoint,
    ExchangeWorkerUrl: exchangeWorker.url,
  });
}