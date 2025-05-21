import { DynamoDB } from 'aws-sdk';

const db = new DynamoDB.DocumentClient();
const tableName = process.env.PATIENT_TABLE_NAME!;

// Define the Patient interface
interface Patient {
  patientId: string;
  name: string;
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
  const result = await db.scan({ TableName: tableName }).promise();
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getPatient = async (patientId: string) => {
  const result = await db.get({ TableName: tableName, Key: { patientId } }).promise();
  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

const createPatient = async (patient: Partial<Patient>) => {
  // Validate required fields
  if (!patient.name) {
    return { statusCode: 400, body: 'Missing required field: name' };
  }

  const patientId = `${Date.now()}`;
  const newPatient: Patient = {
    patientId,
    name: patient.name,
    visitRequests: patient.visitRequests || [],
  };

  await db.put({ TableName: tableName, Item: newPatient }).promise();
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
  const expressionAttributeValues = Object.values(updates).reduce<DynamoDB.DocumentClient.ExpressionAttributeValueMap>((acc, value, idx) => {
    acc[`:value${idx}`] = value;
    return acc;
  }, {});

  await db
    .update({
      TableName: tableName,
      Key: { patientId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
    .promise();

  return { statusCode: 200, body: JSON.stringify({ patientId, ...updates }) };
};

const deletePatient = async (patientId: string) => {
  await db.delete({ TableName: tableName, Key: { patientId } }).promise();
  return { statusCode: 204 };
};