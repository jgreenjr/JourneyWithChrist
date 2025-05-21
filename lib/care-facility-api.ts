import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class CareFacilityApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for care facilities
    const careFacilityTable = new dynamodb.Table(this, 'CareFacilityTable', {
      partitionKey: { name: 'facilityId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
    });

    // Care Facility Lambda function
    const careFacilityLambda = new lambda.Function(this, 'CareFacilityHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'careFacility.handler',
      environment: {
        TABLE_NAME: careFacilityTable.tableName,
      },
    });

    // Grant permissions to the Care Facility Lambda
    careFacilityTable.grantReadWriteData(careFacilityLambda);

    // API Gateway for Care Facility
    const api = new apigateway.RestApi(this, 'CareFacilityApi', {
      restApiName: 'Care Facility Service',
    });

    const careFacilityResource = api.root.addResource('care-facility');
    careFacilityResource.addMethod('ANY', new apigateway.LambdaIntegration(careFacilityLambda));

    // DynamoDB table for patients
    const patientTable = new dynamodb.Table(this, 'PatientTable', {
      partitionKey: { name: 'patientId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
    });

    // Patient Lambda function
    const patientLambda = new lambda.Function(this, 'PatientHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'patient.handler',
      environment: {
        PATIENT_TABLE_NAME: patientTable.tableName,
      },
    });

    // Grant permissions to the Patient Lambda
    patientTable.grantReadWriteData(patientLambda);

    // API Gateway for Patient
    const patientResource = api.root.addResource('patient');
    patientResource.addMethod('ANY', new apigateway.LambdaIntegration(patientLambda));

    // S3 bucket for hosting the UI
    const uiBucket = new s3.Bucket(this, 'PatientApiUiBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY, 
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteObjects: true, // Automatically delete objects when the stack is destroyed
    });

    // Deploy the UI files to the S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployPatientApiUi', {
      sources: [s3deploy.Source.asset('./ui')], // Path to the folder containing the UI files
      destinationBucket: uiBucket,
    });

    // CloudFront distribution for the UI
    const distribution = new cloudfront.Distribution(this, 'PatientApiUiDistribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(uiBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: distribution.distributionDomainName,
      description: 'The URL of the Patient API UI',
    });
  }
}
