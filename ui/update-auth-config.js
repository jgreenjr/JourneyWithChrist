/**
 * This script updates the authentication configuration in the custom-login.html, reset-password.html, 
 * new-password.html, and auth.js files with the actual User Pool ID and Client ID from the CDK stack outputs.
 * 
 * Usage: node update-auth-config.js <userPoolId> <clientId>
 */

const fs = require('fs');
const path = require('path');

// Get User Pool ID and Client ID from command line arguments
const userPoolId = process.argv[2];
const clientId = process.argv[3];

if (!userPoolId || !clientId) {
    console.error('Usage: node update-auth-config.js <userPoolId> <clientId>');
    process.exit(1);
}

// Update custom-login.html
const loginHtmlPath = path.join(__dirname, 'custom-login.html');
fs.readFile(loginHtmlPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading custom-login.html file:', err);
        process.exit(1);
    }
    
    // Replace the placeholder values with actual values
    const updatedData = data
        .replace('YOUR_USER_POOL_ID', userPoolId)
        .replace('YOUR_CLIENT_ID', clientId);
    
    // Write the updated content back to the file
    fs.writeFile(loginHtmlPath, updatedData, 'utf8', (err) => {
        if (err) {
            console.error('Error writing to custom-login.html file:', err);
            process.exit(1);
        }
        
        console.log('Successfully updated Cognito configuration in custom-login.html');
    });
});

// Update reset-password.html
const resetPasswordHtmlPath = path.join(__dirname, 'reset-password.html');
fs.readFile(resetPasswordHtmlPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading reset-password.html file:', err);
        console.log('Skipping reset-password.html update');
    } else {
        // Replace the placeholder values with actual values
        const updatedData = data
            .replace('YOUR_USER_POOL_ID', userPoolId)
            .replace('YOUR_CLIENT_ID', clientId);
        
        // Write the updated content back to the file
        fs.writeFile(resetPasswordHtmlPath, updatedData, 'utf8', (err) => {
            if (err) {
                console.error('Error writing to reset-password.html file:', err);
            } else {
                console.log('Successfully updated Cognito configuration in reset-password.html');
            }
        });
    }
});

// Update new-password.html
const newPasswordHtmlPath = path.join(__dirname, 'new-password.html');
fs.readFile(newPasswordHtmlPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading new-password.html file:', err);
        console.log('Skipping new-password.html update');
    } else {
        // Replace the placeholder values with actual values
        const updatedData = data
            .replace('YOUR_USER_POOL_ID', userPoolId)
            .replace('YOUR_CLIENT_ID', clientId);
        
        // Write the updated content back to the file
        fs.writeFile(newPasswordHtmlPath, updatedData, 'utf8', (err) => {
            if (err) {
                console.error('Error writing to new-password.html file:', err);
            } else {
                console.log('Successfully updated Cognito configuration in new-password.html');
            }
        });
    }
});

// Update auth.js
const authJsPath = path.join(__dirname, 'js', 'auth.js');
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