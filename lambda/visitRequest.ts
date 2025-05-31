import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const tableName = process.env.VISIT_REQUEST_TABLE_NAME!;

// Define the VisitRequest interface
interface VisitRequest {
  requestId: string;
  patientId: string;
  roomNumber: string;
  floor: string;
  facilityId: string;
  active: boolean;
  notes: string;
  followUpRequested: boolean;
  visitedBy: string | null;
  requestedAt: string;
  visitedAt: string | null;
}

exports.handler = async (event: any) => {
  const { httpMethod, pathParameters, queryStringParameters, body } = event;

  switch (httpMethod) {
    case 'GET':
      if (pathParameters && pathParameters.requestId) {
        return getVisitRequest(pathParameters.requestId);
      } else if (queryStringParameters && queryStringParameters.patientId) {
        return getVisitRequestsByPatient(queryStringParameters.patientId);
      }
      return listVisitRequests();
    case 'POST':
      return createVisitRequest(JSON.parse(body));
    case 'PUT':
      return updateVisitRequest(pathParameters.requestId, JSON.parse(body));
    case 'DELETE':
      return deleteVisitRequest(pathParameters.requestId);
    default:
      return { statusCode: 405, body: 'Method Not Allowed' };
  }
};

const listVisitRequests = async () => {
  const result = await db.send(new ScanCommand({ TableName: tableName }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getVisitRequest = async (requestId: string) => {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { requestId } }));
  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

const getVisitRequestsByPatient = async (patientId: string) => {
  const result = await db.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'PatientIdIndex',
    KeyConditionExpression: 'patientId = :patientId',
    ExpressionAttributeValues: {
      ':patientId': patientId
    }
  }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const createVisitRequest = async (visitRequest: Partial<VisitRequest>) => {
  // Validate required fields
  if (!visitRequest.patientId || !visitRequest.roomNumber || !visitRequest.facilityId) {
    return { statusCode: 400, body: 'Missing required fields: patientId, roomNumber, or facilityId' };
  }

  const requestId = `${Date.now()}`;
  const newVisitRequest: VisitRequest = {
    requestId,
    patientId: visitRequest.patientId,
    roomNumber: visitRequest.roomNumber,
    floor: visitRequest.floor || '',
    facilityId: visitRequest.facilityId,
    active: visitRequest.active !== undefined ? visitRequest.active : true,
    notes: visitRequest.notes || '',
    followUpRequested: visitRequest.followUpRequested || false,
    visitedBy: null,
    requestedAt: new Date().toISOString(),
    visitedAt: null
  };

  await db.send(new PutCommand({ TableName: tableName, Item: newVisitRequest }));
  return { statusCode: 201, body: JSON.stringify(newVisitRequest) };
};

const updateVisitRequest = async (requestId: string, updates: Partial<VisitRequest>) => {
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
      Key: { requestId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return { statusCode: 200, body: JSON.stringify({ requestId, ...updates }) };
};

const deleteVisitRequest = async (requestId: string) => {
  await db.send(new DeleteCommand({ TableName: tableName, Key: { requestId } }));
  return { statusCode: 204 };
};