const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // Required for fetch support in Node.js
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Salesforce credentials from environment variables
const clientId = process.env.SFMC_CLIENT_ID;
const clientSecret = process.env.SFMC_CLIENT_SECRET;
const authUrl = process.env.SFMC_AUTH_URL;
const dataExtensionUrl = process.env.SFMC_DATA_EXTENSION_URL;

// Get access token from SFMC
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

  const data = await response.json();
  return data.access_token;
}

// Signup handler: stores user data in User DE
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

    const response = await fetch(dataExtensionUrl, {
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
      console.error('Signup failed:', await response.text());
      res.status(500).send('Signup failed');
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send('Signup error');
  }
});

// Login handler: checks credentials from User DE
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const token = await getAccessToken();

    const response = await fetch(`${dataExtensionUrl}?$filter=Email eq '${email}'`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    const user = data.items && data.items[0];

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

// Cart tracking (if needed)
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

    const response = await fetch(dataExtensionUrl, {
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
      console.error('Track error:', await response.text());
      res.status(500).send('Track error');
    }
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).send('Tracking error');
  }
});

// Default route to serve index.html for /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
