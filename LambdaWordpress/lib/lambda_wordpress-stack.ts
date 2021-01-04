import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as efs from '@aws-cdk/aws-efs';
import * as lambda from '@aws-cdk/aws-lambda';
import * as rds from '@aws-cdk/aws-rds';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as targets from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import * as cm from '@aws-cdk/aws-certificatemanager';
import {ApplicationTargetGroup, ApplicationProtocol, ListenerAction} from '@aws-cdk/aws-elasticloadbalancingv2'
import * as path from 'path';
export class LambdaWordpressStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    var DB_HOST = null;
    var HTTP_HOST = null;
    const DB_NAME = 'wordpress';
    const DB_USER = 'wordpressuser';
    const BASE_PATH = '/mnt/efs';
    const ACCESSPOINT_PATH = '/wordpress';
    const WORDPRESS_PATH = '/mnt/efs';
    const KEY_NAME = this.node.tryGetContext('keyName');
    const DOMAIN_NAME = this.node.tryGetContext('domainName');
    const DB_PASSWORD = this.node.tryGetContext('dbPassword');

    //set the certificate
    const myCertificate = new cm.Certificate(this, 'myCertificate',{
      domainName: DOMAIN_NAME,
      validation: cm.CertificateValidation.fromDns(),
    });

    //create VPC 
    const serverlessVPC = new ec2.Vpc(this, 'serverlessWordpressVPC', {
      cidr: '10.0.0.0/16',
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'public',
          cidrMask: 24,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE,
        },
      ],
    });

    /**
     * create security group in VPC
     */
    // NFS security group which used for ec2 to copy file
    const sgNFSSG = new ec2.SecurityGroup(this, 'NFSAllowAllSG', {
      vpc: serverlessVPC,
      description: 'allow 2049 inbound for ec2',
      allowAllOutbound: true,
    });
    sgNFSSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(2049), 'allow 2049 inbound from ec2')

    //ALB security group which allow 80 and 443
    const albSG = new ec2.SecurityGroup(this, 'albSG', {
      vpc: serverlessVPC,
      description: 'allow 80 and 443',
      allowAllOutbound: true,
    });
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'allow 80 inbound');
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'allow 443 inbound');

    //EC2 security group which allow port 22
    const ec2SG = new ec2.SecurityGroup(this, 'ec2SG', {
      vpc: serverlessVPC,
      description: 'allow 22 inbound for ec2',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow 22 inbound from ec2')

    // RDS security group which allow port 3306
    const rdsSG = new ec2.SecurityGroup(this, 'wordpressRdsSecurityGroup', {
      vpc: serverlessVPC,
      description: 'allow 3306 inbound',
      allowAllOutbound: true,
    });
    rdsSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'allow 3306 inbound from lambda');

    /**
     * create EFS attached on Lambda
     */
    const fileSystem = new efs.FileSystem(this, 'wordpressEFS', {
      vpc: serverlessVPC,
      encrypted: false,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      securityGroup: sgNFSSG,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    //create access point on efs
    const accessPoint = fileSystem.addAccessPoint('LambdaAccessPoint', {
      path: ACCESSPOINT_PATH,
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '0777',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });

    /**
     * Create lambda function
     */
    const lambdaFunc = new lambda.Function(this, 'wordpressLambdaFUnction', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'phpLambdaFunc')),
      handler: 'handler.php',
      memorySize: 1024,
      timeout: cdk.Duration.minutes(15),
      tracing: lambda.Tracing.ACTIVE,
      runtime: lambda.Runtime.PROVIDED,
      layers: [lambda.LayerVersion.fromLayerVersionArn(this, 'customPhpLayer', 'arn:aws:lambda:us-east-1:887080169480:layer:php73:3')],
      vpc: serverlessVPC,
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, BASE_PATH),
    });

    /*
     * create alb and integrate it with lambda
     */
    const lb = new elbv2.ApplicationLoadBalancer(this, 'serverlessALB', {
      vpc: serverlessVPC,
      internetFacing: true,
      securityGroup: albSG,
    });

    const lambdaTarget = new targets.LambdaTarget(lambdaFunc);
    const albTargetGroup = new elbv2.ApplicationTargetGroup(this,'albTargetGroup',{
      targets: [lambdaTarget],
    });
    albTargetGroup.setAttribute('lambda.multi_value_headers.enabled', 'true');

    const listener80 = lb.addListener('Listener80', {
      port: 80,
      open: true,
    });
    listener80.addAction('80action',{
      action: ListenerAction.forward([albTargetGroup])
    });

    const listener443 = lb.addListener('Listener443', {
      port: 443,
      open: true,
      certificateArns:[myCertificate.certificateArn],
    });
    listener443.addAction('443action',{
      action: ListenerAction.forward([albTargetGroup])
    });

    /**
     * create RDS
     */

    const secret = cdk.SecretValue.plainText(DB_PASSWORD);
    const auroraServerlessCluster = new rds.DatabaseCluster(this, 'ServerlessWordpressAuroraCluster', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      credentials: rds.Credentials.fromPassword(DB_USER,secret),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      instanceProps: {
        vpc: serverlessVPC,
        securityGroups: [rdsSG],
      },
      defaultDatabaseName: DB_NAME,
    });

    /***
     *  set the DB_HOST and HTTP_HOST which will used in the lambda environment
     */
    DB_HOST = auroraServerlessCluster.clusterEndpoint.hostname;
    HTTP_HOST = lb.loadBalancerDnsName;

    //SET lambda enviromnent
    lambdaFunc.addEnvironment('DB_HOST', DB_HOST);
    lambdaFunc.addEnvironment('DB_NAME', DB_NAME);
    lambdaFunc.addEnvironment('DB_USER', DB_USER);
    lambdaFunc.addEnvironment('DB_PASSWORD', DB_PASSWORD);
    lambdaFunc.addEnvironment('WORDPRESS_PATH', WORDPRESS_PATH);
    lambdaFunc.addEnvironment('HTTP_HOST', HTTP_HOST);

    // create EC2 which used to install wordpress files to EFS
    const amznLinux = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
    });

    const ec2EFS = new ec2.Instance(this,'efsInstance',{
      vpc: serverlessVPC,
      vpcSubnets: {subnetType:ec2.SubnetType.PUBLIC},
      machineImage : amznLinux,
      instanceType: new ec2.InstanceType('t2.large'),
      securityGroup: ec2SG,
      keyName:KEY_NAME,
    });

    ec2EFS.userData.addCommands(
      //install efs tool and create mount point
      'sudo yum install -y amazon-efs-utils',
      'sudo mkdir /mnt',
      'sudo mkdir /mnt/efs',
    );

    new cdk.CfnOutput(this, 'outputEFS', {
      description: 'efs id',
      value: 'efs id: ' +fileSystem.fileSystemId,
    });

    new cdk.CfnOutput(this, 'outputALBDNS', {
      description: 'alb dns name',
      value: 'alb dns name: ' +lb.loadBalancerDnsName,
    });
  }
}
