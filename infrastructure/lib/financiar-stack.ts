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

interface FinanciarStackProps extends cdk.StackProps {
  /** ARN of an ACM certificate for HTTPS. If not provided, only HTTP listener is created. */
  certificateArn?: string;
}

export class FinanciarStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: FinanciarStackProps) {
    super(scope, id, props);

    // ==================== VPC ====================
    const vpc = new ec2.Vpc(this, 'FinanciarVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    // ==================== SECRETS ====================
    const appSecrets = new secretsmanager.Secret(this, 'FinanciarSecrets', {
      secretName: 'financiar/app-secrets',
      description: 'Financiar application secrets',
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
      description: 'Security group for Financiar RDS',
      allowAllOutbound: false,
    });

    const database = new rds.DatabaseInstance(this, 'FinanciarDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      databaseName: 'financiar',
      credentials: rds.Credentials.fromGeneratedSecret('financiar_admin', {
        secretName: 'financiar/db-credentials',
      }),
      storageEncrypted: true,
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ==================== ECR Repository ====================
    const ecrRepo = new ecr.Repository(this, 'FinanciarRepo', {
      repositoryName: 'financiar',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    // ==================== ECS Cluster ====================
    const cluster = new ecs.Cluster(this, 'FinanciarCluster', {
      vpc,
      clusterName: 'financiar',
      containerInsights: true,
    });

    // ==================== ECS Task Definition ====================
    const taskRole = new iam.Role(this, 'FinanciarTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Financiar ECS task role',
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
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole,
    });

    const logGroup = new logs.LogGroup(this, 'FinanciarLogs', {
      logGroupName: '/ecs/financiar',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDefinition.addContainer('financiar', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'financiar',
        logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '5000',
        APP_URL: 'https://app.thefinanciar.com',
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
      description: 'Security group for Financiar ALB',
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
      description: 'Security group for Financiar ECS service',
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
      minCapacity: 1,
      maxCapacity: 4,
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
    const certArn = (props as FinanciarStackProps)?.certificateArn;
    if (certArn) {
      const certificate = acm.Certificate.fromCertificateArn(this, 'FinanciarCert', certArn);

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
  }
}
