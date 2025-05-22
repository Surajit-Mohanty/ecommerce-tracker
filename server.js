const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // fetch for Node.js
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SFMC credentials and URLs from environment variables
const clientId = process.env.SFMC_CLIENT_ID;
const clientSecret = process.env.SFMC_CLIENT_SECRET;
const authUrl = process.env.SFMC_AUTH_URL;
const restUrl = process.env.SFMC_REST_URL;
const userDEKey = process.env.USER_DATA_EXTENSION_KEY;

// Build Data Extension rows URL for user DE
const userDataExtensionUrl = `${restUrl}data/v1/async/dataextensions/key:${userDEKey}/rows`;

// Get OAuth access token from SFMC
async function getAccessToken() {
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Signup route - add user to Data Extension
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const token = await getAccessToken();

    const payload = {
      items: [
        {
          Email: email,
          Name: name,
          Password: password,
        },
      ],
    };

    const response = await fetch(userDataExtensionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      res.status(200).send('Signup successful');
    } else {
      const text = await response.text();
      console.error('Signup failed:', text);
      res.status(500).send('Signup failed');
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Signup error');
  }
});

// Login route - fetch all users and filter (basic demo, not scalable)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const token = await getAccessToken();

    const response = await fetch(userDataExtensionUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch users: ${text}`);
    }

    const data = await response.json();

    // Filter user by email (case-sensitive)
    const user = data.items && data.items.find(u => u.Email === email);

    if (user && user.Password === password) {
      res.status(200).json({ name: user.Name, email: user.Email });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login error');
  }
});

// Cart tracking route - store event data in Data Extension (optional)
app.post('/api/track', async (req, res) => {
  const { name, email, eventType, cartItems } = req.body;

  try {
    const token = await getAccessToken();

    const payload = {
      items: [
        {
          Name: name,
          Email: email,
          EventType: eventType,
          CartItems: JSON.stringify(cartItems),
          Timestamp: new Date().toISOString(),
        },
      ],
    };

    // Reuse same DE URL or use different DE URL for tracking events if you have one
    const response = await fetch(userDataExtensionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      res.status(200).send('Event tracked');
    } else {
      const text = await response.text();
      console.error('Track error:', text);
      res.status(500).send('Track error');
    }
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).send('Tracking error');
  }
});

// Serve main index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
