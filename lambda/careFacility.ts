import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME!;

exports.handler = async (event: any) => {
  const { httpMethod, pathParameters, body } = event;

  switch (httpMethod) {
    case 'GET':
      if (pathParameters) {
        return getFacility(pathParameters.facilityId);
      }
      return listFacilities();
    case 'POST':
      return createFacility(JSON.parse(body));
    case 'PUT':
      return updateFacility(pathParameters.facilityId, JSON.parse(body));
    case 'DELETE':
      return deleteFacility(pathParameters.facilityId);
    default:
      return { statusCode: 405, body: 'Method Not Allowed' };
  }
};

const listFacilities = async () => {
  const result = await db.send(new ScanCommand({ TableName: tableName }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getFacility = async (facilityId: string) => {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { facilityId } }));
  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

// Define the careFacility interface
interface CareFacility {
  facilityId: string;
  buildingName: string;
  address: string;
  primaryContactName: string;
  primaryContactPhone: string;
}

const createFacility = async (facility: Partial<CareFacility>) => {
  // Validate required fields
  if (!facility.buildingName || !facility.address || !facility.primaryContactName || !facility.primaryContactPhone) {
    return { statusCode: 400, body: 'Missing required fields: buildingName, address, primaryContactName, primaryContactPhone' };
  }

  const facilityId = `${Date.now()}`;
  const newFacility: CareFacility = {
    facilityId,
    buildingName: facility.buildingName,
    address: facility.address,
    primaryContactName: facility.primaryContactName,
    primaryContactPhone: facility.primaryContactPhone,
  };

  await db.send(new PutCommand({ TableName: tableName, Item: newFacility }));
  return { statusCode: 201, body: JSON.stringify(newFacility) };
};

const updateFacility = async (facilityId: string, updates: any) => {
  const updateExpression = Object.keys(updates)
    .map((key, idx) => `#${key} = :value${idx}`)
    .join(', ');
  const expressionAttributeNames = Object.keys(updates).reduce<Record<string, string>>((acc, key) => {
    acc[`#${key}`] = key;
    return acc;
  }, {});
  const expressionAttributeValues = Object.values(updates).reduce<Record<string, any>>((acc, value, idx) => {
    acc[`:value${idx}`] = value;
    return acc;
  }, {});

  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { facilityId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return { statusCode: 200, body: JSON.stringify({ facilityId, ...updates }) };
};

const deleteFacility = async (facilityId: string) => {
  await db.send(new DeleteCommand({ TableName: tableName, Key: { facilityId } }));
  return { statusCode: 204 };
};
