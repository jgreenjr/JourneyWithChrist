// This is a simple Express server that acts as a proxy for the Cognito token endpoint
// It helps avoid CORS issues when exchanging the authorization code for tokens

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Parse application/json
app.use(bodyParser.json());

// Proxy endpoint for token exchange
app.post('/token', async (req, res) => {
  try {
    const { code, redirect_uri, client_id, domain, region } = req.body;
    
    if (!code || !redirect_uri || !client_id || !domain || !region) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const tokenEndpoint = `https://${domain}.auth.${region}.amazoncognito.com/oauth2/token`;
    
    const response = await axios.post(
      tokenEndpoint,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id,
        redirect_uri,
        code
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to exchange code for tokens',
      details: error.response?.data || error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Token proxy server listening at http://localhost:${port}`);
});