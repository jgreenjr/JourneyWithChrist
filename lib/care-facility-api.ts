import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';

export class CareFacilityApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT, // Use the default AWS account
        region: process.env.CDK_DEFAULT_REGION,   // Use the default AWS region
      },
    });

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
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Custom-Header'],
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL]
      },
    });
    
    // We'll use the main API for Visit Requests instead of a separate API

    const careFacilityResource = api.root.addResource('care-facility');
    careFacilityResource.addMethod('ANY', new apigateway.LambdaIntegration(careFacilityLambda));

    // DynamoDB table for visit requests
    const visitRequestTable = new dynamodb.Table(this, 'VisitRequestTable', {
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
    });

    // Visit Request Lambda function
    const visitRequestLambda = new lambda.Function(this, 'VisitRequestHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'visitRequest.handler',
      environment: {
        VISIT_REQUEST_TABLE_NAME: visitRequestTable.tableName,
      },
    });

    // Grant permissions to the Visit Request Lambda
    visitRequestTable.grantReadWriteData(visitRequestLambda);

    // API Gateway for Visit Request - adding to the main API
    const visitRequestResource = api.root.addResource('visit-request');
    
    // Add ANY method for visit request API calls
    visitRequestResource.addMethod('ANY', new apigateway.LambdaIntegration(visitRequestLambda), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    
    // Add resource for getting a single visit request by ID
    const singleVisitRequestResource = visitRequestResource.addResource('{requestId}');
    singleVisitRequestResource.addMethod('GET', new apigateway.LambdaIntegration(visitRequestLambda), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    
    // Add PUT method for updating a visit request
    singleVisitRequestResource.addMethod('PUT', new apigateway.LambdaIntegration(visitRequestLambda), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
    


    // Lookup the hosted zone for nwgreens.org
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'nwgreens.org',
    });

    // Create an SSL certificate for the custom domain
    const certificate = new certificatemanager.Certificate(this, 'ApiCertificate', {
      domainName: '*.nwgreens.org',
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),    
      }
    ); 


    // S3 bucket for hosting the UI
    const uiBucket = new s3.Bucket(this, 'PatientApiUiBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY, 
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteObjects: true, // Automatically delete objects when the stack is destroyed
    });

    // CloudFront distribution for the UI and API
    const distribution = new cloudfront.Distribution(this, 'PatientApiUiDistribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(uiBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: ['www.nwgreens.org'], // Custom domain for the CloudFront distribution
      certificate: certificate,
      defaultRootObject: 'index.html', // Default root object for the CloudFront distribution
      enableIpv6: true,
    });

      // Deploy the UI files to the S3 bucket and invalidate the CloudFront cache
      new s3deploy.BucketDeployment(this, 'DeployPatientApiUi', {
        sources: [s3deploy.Source.asset('./ui')], // Path to the folder containing the UI files
        destinationBucket: uiBucket,
        distribution: distribution, // Reference to the CloudFront distribution
        distributionPaths: ['/*'], // Invalidate all files in the CloudFront cache
      });

    
    // Create a CloudFront Function to rewrite the URI path
    const pathRewriteFunction = new cloudfront.Function(this, 'PathRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;
          
          // Remove /api prefix
          if (uri.startsWith('/api/')) {
            request.uri = uri.substring(4); // Remove '/api'
          } else if (uri === '/api') {
            request.uri = '/';
          }
          
          return request;
        }
      `),
      comment: 'Rewrites API paths for API Gateway',
    });
    
    // We'll use a built-in policy instead of a custom one
    
    // Add a behavior for the main API Gateway
    distribution.addBehavior('/api/*', new origins.HttpOrigin(`${api.restApiId}.execute-api.${this.region}.amazonaws.com`, {
      originPath: '/prod',
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: {
        'x-api-key': 'cloudfront-api-gateway-integration',
      },
    }), {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      functionAssociations: [{
        function: pathRewriteFunction,
        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
      }]
    });
    
    // Visit requests are now part of the main API, so we don't need a separate behavior

    // Create a Route 53 record to point to the CloudFront distribution
    new route53.ARecord(this, 'UiAliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
      recordName: 'www', // Register CloudFront to www.nwgreens.org
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: distribution.distributionDomainName,
      description: 'The URL of the Patient API UI',
    });

    var apiAddress = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`
    // Output the API URL
    new cdk.CfnOutput(this, 'APIURL', {
      value: apiAddress,
      description: 'The URL of the API Gateway',
    });
    
    // Output the API endpoint URL
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'The endpoint URL of the API Gateway',
    });
    
    // Output the CloudFront API URLs
    new cdk.CfnOutput(this, 'CloudFrontAPIUrl', {
      value: `https://${distribution.distributionDomainName}/api/patient`,
      description: 'The URL of the Patient API through CloudFront',
    });
    
    new cdk.CfnOutput(this, 'CloudFrontVisitAPIUrl', {
      value: `https://${distribution.distributionDomainName}/api/visit-request`,
      description: 'The URL of the Visit Request API through CloudFront',
    });
  }
}
