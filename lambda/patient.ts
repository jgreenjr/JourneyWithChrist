import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const tableName = process.env.PATIENT_TABLE_NAME!;

// Define the Patient interface
interface Patient {
  patientId: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  visitRequests: VisitRequest[];
}

// Define the VisitRequest interface
interface VisitRequest {
  requestId: string;
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
  const { httpMethod, pathParameters, body } = event;

  switch (httpMethod) {
    case 'GET':
      if (pathParameters) {
        return getPatient(pathParameters.patientId);
      }
      return listPatients();
    case 'POST':
      return createPatient(JSON.parse(body));
    case 'PUT':
      return updatePatient(pathParameters.patientId, JSON.parse(body));
    case 'DELETE':
      return deletePatient(pathParameters.patientId);
    default:
      return { statusCode: 405, body: 'Method Not Allowed' };
  }
};

const listPatients = async () => {
  const result = await db.send(new ScanCommand({ TableName: tableName }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getPatient = async (patientId: string) => {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { patientId } }));
  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

const createPatient = async (patient: Partial<Patient>) => {
  // Validate required fields
  if (!patient.firstName || !patient.lastName) {
    return { statusCode: 400, body: 'Missing required fields: firstName and/or lastName' };
  }

  const patientId = `${Date.now()}`;
  const newPatient: Patient = {
    patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    phoneNumber: patient.phoneNumber || '',
    visitRequests: patient.visitRequests || [],
  };

  await db.send(new PutCommand({ TableName: tableName, Item: newPatient }));
  return { statusCode: 201, body: JSON.stringify(newPatient) };
};

const updatePatient = async (patientId: string, updates: Partial<Patient>) => {
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
      Key: { patientId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return { statusCode: 200, body: JSON.stringify({ patientId, ...updates }) };
};

const deletePatient = async (patientId: string) => {
  await db.send(new DeleteCommand({ TableName: tableName, Key: { patientId } }));
  return { statusCode: 204 };
};