#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SpendlyStack } from '../lib/spendly-stack';

const app = new cdk.App();

new SpendlyStack(app, 'SpendlyStack', {
  env: {
    account: '677343720858',
    region: 'us-east-1',
  },
});
