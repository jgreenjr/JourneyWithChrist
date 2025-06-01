import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDeleteUserCommand, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';

const dynamoClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(dynamoClient);
const tableName = process.env.USER_TABLE_NAME!;

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({});
const userPoolId = process.env.USER_POOL_ID!;
const userPoolClientId = process.env.USER_POOL_CLIENT_ID!;

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
  try {
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

    // Create user in DynamoDB
    await db.send(new PutCommand({ TableName: tableName, Item: newUser }));
    
    // Create user in Cognito
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Generate a temporary password
    const tempPassword = "Password1"//`Temp${Math.random().toString(36).slice(2, 10)}${Math.random().toString(10).slice(2, 6)}`;
    
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      TemporaryPassword: tempPassword,
      UserAttributes: [
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        { Name: 'phone_number', Value: user.phoneNumber || '' }
      ],
      MessageAction: 'SUPPRESS' // Don't send welcome email, we'll handle this separately
    });
    
    await cognitoClient.send(createUserCommand);
    
    return { 
      statusCode: 201, 
      body: JSON.stringify({
        ...newUser,
        tempPassword // Include temporary password in response
      }) 
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        message: 'Error creating user', 
        error: (error as Error).message 
      }) 
    };
  }
};

const updateUser = async (userId: string, updates: Partial<User>) => {
  try {
    // Get the current user to get the email (username in Cognito)
    const result = await db.send(new GetCommand({ TableName: tableName, Key: { userId } }));
    const currentUser = result.Item as User;
    
    if (!currentUser) {
      return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
    }
    
    // Update in DynamoDB
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
    
    // Update in Cognito if relevant fields changed
    if (updates.name || updates.phoneNumber) {
      const userAttributes = [];
      
      if (updates.name) {
        const nameParts = updates.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        userAttributes.push(
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName }
        );
      }
      
      if (updates.phoneNumber) {
        userAttributes.push({ Name: 'phone_number', Value: updates.phoneNumber });
      }
      
      // Only update if there are attributes to update
      if (userAttributes.length > 0) {
        const updateUserCommand = new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: currentUser.email,
          UserAttributes: userAttributes
        });
        
        await cognitoClient.send(updateUserCommand);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ userId, ...updates }) };
  } catch (error) {
    console.error('Error updating user:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        message: 'Error updating user', 
        error: (error as Error).message 
      }) 
    };
  }
};

const deleteUser = async (userId: string) => {
  try {
    // Get the user from DynamoDB to get the email (username in Cognito)
    const result = await db.send(new GetCommand({ TableName: tableName, Key: { userId } }));
    const user = result.Item as User;
    
    if (!user) {
      return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
    }
    
    // Delete from DynamoDB
    await db.send(new DeleteCommand({ TableName: tableName, Key: { userId } }));
    
    // Delete from Cognito
    try {
      const deleteUserCommand = new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: user.email
      });
      
      await cognitoClient.send(deleteUserCommand);
    } catch (cognitoError) {
      console.error('Error deleting user from Cognito:', cognitoError);
      // Continue even if Cognito deletion fails
    }
    
    return { statusCode: 204 };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        message: 'Error deleting user', 
        error: (error as Error).message 
      }) 
    };
  }
};