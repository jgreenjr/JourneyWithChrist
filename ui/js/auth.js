// Cognito configuration
const poolData = {
    UserPoolId: 'us-east-1_995kHhymJ', // Replace with actual User Pool ID
    ClientId: '5n9recesev785jephnll96cl4h'       // Replace with actual Client ID
};

var username = 'username'
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// Check if user is authenticated
function isAuthenticated() {
    const currentUser = userPool.getCurrentUser();
    
    if (!currentUser) {
        return false;
    }
    
    return new Promise((resolve) => {
        currentUser.getSession((err, session) => {
            if (err || !session.isValid()) {
                resolve(false);
                return;
            }
            
            // Store the tokens
            localStorage.setItem('idToken', session.getIdToken().getJwtToken());
            
            resolve(true);
        });
    });
}

// Get current user
function getCurrentUser() {
    return userPool.getCurrentUser();
}

// Get user attributes
function getUserAttributes() {
    return new Promise((resolve, reject) => {
        const currentUser = userPool.getCurrentUser();
        
        if (!currentUser) {
            reject(new Error('No user found'));
            return;
        }
        
        currentUser.getSession((err, session) => {
            if (err) {
                reject(err);
                return;
            }
            
            currentUser.getUserAttributes((err, attributes) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const userAttributes = {};
                for (let i = 0; i < attributes.length; i++) {
                    userAttributes[attributes[i].getName()] = attributes[i].getValue();
                }
                
                resolve(userAttributes);
            });
        });
    });
}

// Sign out
function signOut() {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) {
        currentUser.signOut();
    }
    
    // Redirect to login page
    window.location.href = 'custom-login.html';
}

// Protect page - redirect to login if not authenticated
async function protectPage() {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
        // Store the current URL to redirect back after login
        localStorage.setItem('redirectUrl', window.location.href);
        window.location.href = 'custom-login.html';
        return false;
    }
    return true;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Add logout button event listener if it exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
    }
    
    // Protect all pages except login
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'custom-login.html') {
        const isAuth = await protectPage();
        if (isAuth) {
            // Update user info if available
            try {
                const userAttributes = await getUserAttributes();
                const userNameElement = document.getElementById('userName');
                if( userAttributes.given_name && userAttributes.family_name){
                    username = userAttributes.given_name + ' ' + userAttributes.family_name;
                }
                if (userNameElement && userAttributes.given_name) {
                    userNameElement.textContent = username
                }
            } catch (error) {
                console.error('Error getting user attributes:', error);
            }
        }
    } else {
        // If on login page and already authenticated, redirect to home
        const authenticated = await isAuthenticated();
        if (authenticated) {
            const redirectUrl = localStorage.getItem('redirectUrl') || 'index.html';
            window.location.href = redirectUrl;
            localStorage.removeItem('redirectUrl');
        }
    }
});