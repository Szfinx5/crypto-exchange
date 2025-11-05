import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CryptoExchangeStack } from '../lib/cdk-infra-stack';

const app = new cdk.App();
new CryptoExchangeStack(app, 'CryptoExchangeStack', {
  env: {
    region: 'eu-central-1',
  },
});