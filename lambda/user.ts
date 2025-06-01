import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const tableName = process.env.USER_TABLE_NAME!;

// Define the User interface
interface User {
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  isAssignable: boolean;
  isAdmin: boolean;
}

exports.handler = async (event: any) => {
  const { httpMethod, pathParameters, body } = event;

  switch (httpMethod) {
    case 'GET':
      if (pathParameters && pathParameters.userId) {
        return getUser(pathParameters.userId);
      }
      return listUsers();
    case 'POST':
      return createUser(JSON.parse(body));
    case 'PUT':
      return updateUser(pathParameters.userId, JSON.parse(body));
    case 'DELETE':
      return deleteUser(pathParameters.userId);
    default:
      return { statusCode: 405, body: 'Method Not Allowed' };
  }
};

const listUsers = async () => {
  const result = await db.send(new ScanCommand({ TableName: tableName }));
  return { statusCode: 200, body: JSON.stringify(result.Items) };
};

const getUser = async (userId: string) => {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { userId } }));
  return { statusCode: 200, body: JSON.stringify(result.Item) };
};

const createUser = async (user: Partial<User>) => {
  // Validate required fields
  if (!user.name || !user.email) {
    return { statusCode: 400, body: 'Missing required fields: name and/or email' };
  }

  const userId = `${Date.now()}`;
  const newUser: User = {
    userId,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber || '',
    isAssignable: user.isAssignable !== undefined ? user.isAssignable : true,
    isAdmin: user.isAdmin !== undefined ? user.isAdmin : false,
  };

  await db.send(new PutCommand({ TableName: tableName, Item: newUser }));
  return { statusCode: 201, body: JSON.stringify(newUser) };
};

const updateUser = async (userId: string, updates: Partial<User>) => {
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
      Key: { userId },
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );

  return { statusCode: 200, body: JSON.stringify({ userId, ...updates }) };
};

const deleteUser = async (userId: string) => {
  await db.send(new DeleteCommand({ TableName: tableName, Key: { userId } }));
  return { statusCode: 204 };
};