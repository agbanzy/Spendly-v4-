#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FinanciarStack } from '../lib/financiar-stack';

// LU-012 / AUD-IN-004 — three separate stack instantiations so dev / staging /
// prod no longer share definitions. Stack-name preservation ensures a no-op
// `cdk diff FinanciarStack` against the existing prod deployment except for
// the deliberate HA upgrades (multi-NAT, multi-AZ).
//
// Synth all three stacks at once with `npx cdk synth`. Deploy only the one
// you intend with `npx cdk deploy <StackName>`. The GitHub Actions deploy
// workflow continues to target the prod ECS service name.

const app = new cdk.App();

const account = '677343720858';
const region = 'us-east-1';

// Existing prod stack — keep the original logical name `FinanciarStack` to
// avoid a CloudFormation re-creation. The behaviour change (multi-NAT,
// multi-AZ RDS) rolls out via `cdk diff` + `cdk deploy FinanciarStack`.
new FinanciarStack(app, 'FinanciarStack', {
  envName: 'prod',
  appUrl: 'https://app.thefinanciar.com',
  certificateArn: process.env.PROD_CERT_ARN,
  env: { account, region },
});

// Staging — new stack; provision when ready.
new FinanciarStack(app, 'FinanciarStagingStack', {
  envName: 'staging',
  appUrl: 'https://staging.thefinanciar.com',
  certificateArn: process.env.STAGING_CERT_ARN,
  env: { account, region },
});

// Dev — new stack; provision on demand.
new FinanciarStack(app, 'FinanciarDevStack', {
  envName: 'dev',
  appUrl: 'https://dev.thefinanciar.com',
  certificateArn: process.env.DEV_CERT_ARN,
  env: { account, region },
});
