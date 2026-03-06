#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FinanciarStack } from '../lib/financiar-stack';

const app = new cdk.App();

new FinanciarStack(app, 'FinanciarStack', {
  env: {
    account: '677343720858',
    region: 'us-east-1',
  },
});
