import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class CryptoExchangeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'CryptoExchangeVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ECR Repositories
    const nextjsRepo = new ecr.Repository(this, 'NextjsRepo');
    const worker1Repo = new ecr.Repository(this, 'Worker1Repo');
    const worker2Repo = new ecr.Repository(this, 'Worker2Repo');

    // Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    const redis = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'CryptoExchangeCluster', {
      vpc,
    });

    // Task Role
    const taskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Next.js Service
    const nextjsTaskDef = new ecs.FargateTaskDefinition(this, 'NextjsTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      executionRole: taskRole,
    });

    nextjsTaskDef.addContainer('nextjs', {
      image: ecs.ContainerImage.fromEcrRepository(nextjsRepo, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        QUEUE_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
        STATUS_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'nextjs',
      }),
    });

    new ecs.FargateService(this, 'NextjsService', {
      cluster,
      taskDefinition: nextjsTaskDef,
      desiredCount: 1,
      assignPublicIp: true,
    });

    // Worker 1 Service
    const worker1TaskDef = new ecs.FargateTaskDefinition(this, 'Worker1TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskRole,
    });

    worker1TaskDef.addContainer('worker1', {
      image: ecs.ContainerImage.fromEcrRepository(worker1Repo, 'latest'),
      environment: {
        QUEUE_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
        STATUS_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker1',
      }),
    });

    new ecs.FargateService(this, 'Worker1Service', {
      cluster,
      taskDefinition: worker1TaskDef,
      desiredCount: 1,
      assignPublicIp: true,
    });

    // Worker 2 Service
    const worker2TaskDef = new ecs.FargateTaskDefinition(this, 'Worker2TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskRole,
    });

    worker2TaskDef.addContainer('worker2', {
      image: ecs.ContainerImage.fromEcrRepository(worker2Repo, 'latest'),
      environment: {
        QUEUE_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
        STATUS_REDIS_URL: `redis://${redis.attrRedisEndpointAddress}:6379`,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker2',
      }),
    });

    new ecs.FargateService(this, 'Worker2Service', {
      cluster,
      taskDefinition: worker2TaskDef,
      desiredCount: 1,
      assignPublicIp: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'NextjsRepoUri', {
      value: nextjsRepo.repositoryUri,
    });
    new cdk.CfnOutput(this, 'Worker1RepoUri', {
      value: worker1Repo.repositoryUri,
    });
    new cdk.CfnOutput(this, 'Worker2RepoUri', {
      value: worker2Repo.repositoryUri,
    });
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redis.attrRedisEndpointAddress,
    });
  }
}