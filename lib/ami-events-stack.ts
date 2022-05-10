import {
  Stack,
  StackProps,
  aws_iam as iam,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_events as events,
  aws_events_targets as targets,
  aws_ec2 as ec2,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class AmiEventsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Lambda Function for copy images
    const copyImagesFunction = new nodejs.NodejsFunction(
      this,
      "CopyImagesFunction",
      {
        entry: path.join(
          __dirname,
          "../src/lambda/handlers/copy-images-handler.ts"
        ),
        runtime: lambda.Runtime.NODEJS_14_X,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          DESTINATION_REGION: "ap-northeast-3",
        },
        role: new iam.Role(this, "CopyImagesFunctionIamRole", {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName(
              "service-role/AWSLambdaVPCAccessExecutionRole"
            ),
            new iam.ManagedPolicy(this, "CopyImagesIamPolicy", {
              statements: [
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  resources: ["arn:aws:ec2:*::image/*"],
                  actions: ["ec2:CopyImage"],
                }),
              ],
            }),
          ],
        }),
        logRetention: logs.RetentionDays.TWO_WEEKS,
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Lambda Function for delete snapshots
    const deleteSnapshotsFunction = new nodejs.NodejsFunction(
      this,
      "DeleteSnapshotsFunction",
      {
        entry: path.join(
          __dirname,
          "../src/lambda/handlers/delete-snapshots-handler.ts"
        ),
        runtime: lambda.Runtime.NODEJS_14_X,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          DESTINATION_REGION: "ap-northeast-1",
        },
        role: new iam.Role(this, "DeleteSnapshotsFunctionIamRole", {
          assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName(
              "service-role/AWSLambdaVPCAccessExecutionRole"
            ),
            new iam.ManagedPolicy(this, "DeleteSnapshotsIamPolicy", {
              statements: [
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  resources: ["arn:aws:ec2:*::snapshot/*"],
                  actions: ["ec2:DeleteSnapshot"],
                }),
                new iam.PolicyStatement({
                  effect: iam.Effect.ALLOW,
                  resources: ["*"],
                  actions: ["ec2:DescribeSnapshots"],
                }),
              ],
            }),
          ],
        }),
        logRetention: logs.RetentionDays.TWO_WEEKS,
        tracing: lambda.Tracing.ACTIVE,
        timeout: Duration.minutes(3),
      }
    );

    // Event Bridge Rule for AMI available
    new events.Rule(this, "AMIAvailableRule", {
      eventPattern: {
        source: ["aws.ec2"],
        detailType: ["EC2 AMI State Change"],
        detail: {
          State: ["available"],
        },
      },
      targets: [new targets.LambdaFunction(copyImagesFunction)],
    });

    // Event Bridge Rule for AMI deregistered
    new events.Rule(this, "AMIDeregisteredRule", {
      eventPattern: {
        source: ["aws.ec2"],
        detailType: ["EC2 AMI State Change"],
        detail: {
          State: ["deregistered"],
        },
      },
      targets: [new targets.LambdaFunction(deleteSnapshotsFunction)],
    });

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      cidr: "10.10.0.0/24",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 28 },
      ],
    });

    // EC2 Instance
    new ec2.Instance(this, "EC2Instance", {
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      vpc,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
        {
          deviceName: "/dev/sdb",
          volume: ec2.BlockDeviceVolume.ebs(1, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
        {
          deviceName: "/dev/sdc",
          volume: ec2.BlockDeviceVolume.ebs(2, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      propagateTagsToVolumeOnCreation: true,
    });
  }
}
