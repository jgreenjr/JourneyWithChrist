import { DynamoDB } from 'aws-sdk';

const db = new DynamoDB.DocumentClient();
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
  const result = await db.scan({ TableName: tableName }).promise();
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getFacility = async (facilityId: string) => {
  const result = await db.get({ TableName: tableName, Key: { facilityId } }).promise();
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

  await db.put({ TableName: tableName, Item: newFacility }).promise();
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
  const expressionAttributeValues = Object.values(updates).reduce<DynamoDB.DocumentClient.ExpressionAttributeValueMap>((acc, value, idx) => {
    acc[`:value${idx}`] = value;
    return acc;
  }, {});

  await db
    .update({
      TableName: tableName,
      Key: { facilityId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
    .promise();

  return { statusCode: 200, body: JSON.stringify({ facilityId, ...updates }) };
};

const deleteFacility = async (facilityId: string) => {
  await db.delete({ TableName: tableName, Key: { facilityId } }).promise();
  return { statusCode: 204 };
};
