import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

// LU-012 / AUD-IN-002 / AUD-IN-003 / AUD-IN-004
// Stack now takes an `env` selector and parameterizes the high-availability
// posture per environment. Three single-points-of-failure from the prior
// version are eliminated in prod:
//   - natGateways: 2  (was 1)
//   - rds.multiAz:  true (was false)
//   - hardcoded APP_URL → injected from props.appUrl
// Dev and staging keep the cheap settings; prod gets multi-NAT + multi-AZ.
//
// `npm run cdk synth` is required after restructuring; deployment is gated by
// the existing GitHub Actions workflow and is NOT performed by this change.

export type FinanciarEnvName = 'dev' | 'staging' | 'prod';

export interface FinanciarStackProps extends cdk.StackProps {
  /** Logical environment name. Drives sizing and HA defaults. */
  envName: FinanciarEnvName;
  /** Public APP_URL injected into the ECS task. */
  appUrl: string;
  /** ARN of an ACM certificate for HTTPS. If not provided, only HTTP listener is created. */
  certificateArn?: string;
}

interface EnvDefaults {
  natGateways: number;
  multiAz: boolean;
  rdsInstanceClass: ec2.InstanceClass;
  rdsInstanceSize: ec2.InstanceSize;
  rdsAllocatedStorage: number;
  rdsMaxAllocatedStorage: number;
  taskCpu: number;
  taskMem: number;
  minCapacity: number;
  maxCapacity: number;
  logRetention: logs.RetentionDays;
}

const ENV_DEFAULTS: Record<FinanciarEnvName, EnvDefaults> = {
  dev: {
    natGateways: 1,
    multiAz: false,
    rdsInstanceClass: ec2.InstanceClass.T3,
    rdsInstanceSize: ec2.InstanceSize.MICRO,
    rdsAllocatedStorage: 20,
    rdsMaxAllocatedStorage: 50,
    taskCpu: 256,
    taskMem: 512,
    minCapacity: 1,
    maxCapacity: 1,
    logRetention: logs.RetentionDays.TWO_WEEKS,
  },
  staging: {
    natGateways: 1,
    multiAz: false,
    rdsInstanceClass: ec2.InstanceClass.T3,
    rdsInstanceSize: ec2.InstanceSize.SMALL,
    rdsAllocatedStorage: 20,
    rdsMaxAllocatedStorage: 100,
    taskCpu: 512,
    taskMem: 1024,
    minCapacity: 1,
    maxCapacity: 2,
    logRetention: logs.RetentionDays.ONE_MONTH,
  },
  prod: {
    natGateways: 2,                 // AUD-IN-002: was 1
    multiAz: true,                  // AUD-IN-003: was false
    rdsInstanceClass: ec2.InstanceClass.T3,
    rdsInstanceSize: ec2.InstanceSize.MEDIUM,
    rdsAllocatedStorage: 50,
    rdsMaxAllocatedStorage: 200,
    taskCpu: 1024,
    taskMem: 2048,
    minCapacity: 2,
    maxCapacity: 6,
    logRetention: logs.RetentionDays.THREE_MONTHS,
  },
};

export class FinanciarStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FinanciarStackProps) {
    super(scope, id, props);

    const cfg = ENV_DEFAULTS[props.envName];
    const envSlug = props.envName;
    const namePrefix = envSlug === 'prod' ? 'financiar' : `financiar-${envSlug}`;

    // ==================== VPC ====================
    const vpc = new ec2.Vpc(this, 'FinanciarVpc', {
      maxAzs: 2,
      natGateways: cfg.natGateways,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    // ==================== SECRETS ====================
    const appSecrets = new secretsmanager.Secret(this, 'FinanciarSecrets', {
      secretName: `${namePrefix}/app-secrets`,
      description: `Financiar application secrets (${envSlug})`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DATABASE_URL: '',
          SESSION_SECRET: '',
          STRIPE_SECRET_KEY: '',
          STRIPE_WEBHOOK_SECRET: '',
          PAYSTACK_SECRET_KEY: '',
          COGNITO_USER_POOL_ID: '',
          COGNITO_CLIENT_ID: '',
        }),
        generateStringKey: 'SESSION_SECRET',
      },
    });

    // ==================== RDS PostgreSQL ====================
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc,
      description: `Security group for Financiar RDS (${envSlug})`,
      allowAllOutbound: false,
    });

    const database = new rds.DatabaseInstance(this, 'FinanciarDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(cfg.rdsInstanceClass, cfg.rdsInstanceSize),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      databaseName: 'financiar',
      credentials: rds.Credentials.fromGeneratedSecret('financiar_admin', {
        secretName: `${namePrefix}/db-credentials`,
      }),
      storageEncrypted: true,
      multiAz: cfg.multiAz,
      allocatedStorage: cfg.rdsAllocatedStorage,
      maxAllocatedStorage: cfg.rdsMaxAllocatedStorage,
      backupRetention: cdk.Duration.days(envSlug === 'prod' ? 14 : 7),
      deletionProtection: envSlug === 'prod',
      removalPolicy: envSlug === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
    });

    // ==================== ECR Repository ====================
    const ecrRepo = new ecr.Repository(this, 'FinanciarRepo', {
      repositoryName: namePrefix,
      removalPolicy: envSlug === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        { maxImageCount: envSlug === 'prod' ? 20 : 10, description: 'Keep recent images' },
      ],
    });

    // ==================== ECS Cluster ====================
    const cluster = new ecs.Cluster(this, 'FinanciarCluster', {
      vpc,
      clusterName: namePrefix,
      containerInsights: true,
    });

    // ==================== ECS Task Definition ====================
    const taskRole = new iam.Role(this, 'FinanciarTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: `Financiar ECS task role (${envSlug})`,
    });

    // Grant SES, SNS, Secrets Manager access
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'],
    }));
    appSecrets.grantRead(taskRole);
    database.secret?.grantRead(taskRole);

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'FinanciarTask', {
      memoryLimitMiB: cfg.taskMem,
      cpu: cfg.taskCpu,
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, 'FinanciarLogs', {
      logGroupName: `/ecs/${namePrefix}`,
      retention: cfg.logRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDefinition.addContainer('financiar', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'financiar',
        logGroup,
      }),
      environment: {
        NODE_ENV: envSlug === 'prod' ? 'production' : envSlug,
        PORT: '5000',
        APP_URL: props.appUrl,
        AWS_REGION: this.region,
        AWS_SES_FROM_EMAIL: 'noreply@thefinanciar.com',
        AWS_SES_FROM_NAME: 'Financiar',
        AWS_SNS_SENDER_ID: 'Financiar',
        // RDS uses AWS-managed TLS within VPC; Node trusts the default CAs
        NODE_TLS_REJECT_UNAUTHORIZED: '1',
      },
      secrets: {
        // NOTE: After CDK deploy, manually set the full DATABASE_URL in Secrets Manager:
        // postgresql://financiar_admin:<password>@<rds-endpoint>:5432/financiar
        DATABASE_URL: ecs.Secret.fromSecretsManager(appSecrets, 'DATABASE_URL'),
        SESSION_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'SESSION_SECRET'),
        STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(appSecrets, 'STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'STRIPE_WEBHOOK_SECRET'),
        PAYSTACK_SECRET_KEY: ecs.Secret.fromSecretsManager(appSecrets, 'PAYSTACK_SECRET_KEY'),
        COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(appSecrets, 'COGNITO_USER_POOL_ID'),
        COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(appSecrets, 'COGNITO_CLIENT_ID'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO- http://localhost:5000/api/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    container.addPortMappings({ containerPort: 5000 });

    // ==================== ALB ====================
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      description: `Security group for Financiar ALB (${envSlug})`,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS');

    const alb = new elbv2.ApplicationLoadBalancer(this, 'FinanciarAlb', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });

    // ==================== ECS Service ====================
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
      description: `Security group for Financiar ECS service (${envSlug})`,
    });

    // ALB -> ECS on port 5000
    serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(5000), 'Allow from ALB');

    // ECS -> RDS on port 5432
    dbSecurityGroup.addIngressRule(serviceSecurityGroup, ec2.Port.tcp(5432), 'Allow from ECS');

    const service = new ecs.FargateService(this, 'FinanciarService', {
      cluster,
      taskDefinition,
      desiredCount: 0, // Start at 0; scale up after pushing Docker image to ECR
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    // Auto-scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: cfg.minCapacity,
      maxCapacity: cfg.maxCapacity,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(300),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ==================== ALB Target Group & Listeners ====================
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'FinanciarTargetGroup', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/api/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // HTTPS listener (if certificate ARN provided)
    if (props.certificateArn) {
      const certificate = acm.Certificate.fromCertificateArn(this, 'FinanciarCert', props.certificateArn);

      alb.addListener('HttpsListener', {
        port: 443,
        certificates: [certificate],
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      });

      // HTTP -> HTTPS redirect
      alb.addListener('HttpRedirect', {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });
    } else {
      // Fallback: HTTP only (for initial deploy before certificate is ready)
      alb.addListener('HttpListener', {
        port: 80,
        defaultAction: elbv2.ListenerAction.forward([targetGroup]),
      });
    }

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS name',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      description: 'ECR repository URI',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: service.serviceName,
      description: 'ECS service name',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS endpoint',
    });

    new cdk.CfnOutput(this, 'EnvName', {
      value: envSlug,
      description: 'Logical environment',
    });
  }
}
