/**
 * This script updates the Cognito configuration in the auth.js file
 * with the actual User Pool ID and Client ID from the CDK stack outputs.
 * 
 * Usage: node update-cognito-config.js <userPoolId> <clientId>
 */

const fs = require('fs');
const path = require('path');

// Get User Pool ID and Client ID from command line arguments
const userPoolId = process.argv[2];
const clientId = process.argv[3];

if (!userPoolId || !clientId) {
    console.error('Usage: node update-cognito-config.js <userPoolId> <clientId>');
    process.exit(1);
}

// Path to auth.js file
const authJsPath = path.join(__dirname, 'js', 'auth.js');

// Read the auth.js file
fs.readFile(authJsPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading auth.js file:', err);
        process.exit(1);
    }
    
    // Replace the placeholder values with actual values
    const updatedData = data
        .replace('YOUR_USER_POOL_ID', userPoolId)
        .replace('YOUR_CLIENT_ID', clientId);
    
    // Write the updated content back to the file
    fs.writeFile(authJsPath, updatedData, 'utf8', (err) => {
        if (err) {
            console.error('Error writing to auth.js file:', err);
            process.exit(1);
        }
        
        console.log('Successfully updated Cognito configuration in auth.js');
    });
});