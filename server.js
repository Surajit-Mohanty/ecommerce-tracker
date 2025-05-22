const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Environment variables
const clientId = process.env.SFMC_CLIENT_ID;
const clientSecret = process.env.SFMC_CLIENT_SECRET;
const authUrl = process.env.SFMC_AUTH_URL;
const restUrl = process.env.SFMC_REST_URL;
const userDEKey = process.env.USER_DATA_EXTENSION_KEY;
const eventDEKey = process.env.DATA_EXTENSION_KEY;

// Construct DE endpoints
const userDataExtensionUrl = `${restUrl}data/v1/customobjectdata/key/${userDEKey}/rowset`;
const eventDataExtensionUrl = `${restUrl}data/v1/customobjectdata/key/${eventDEKey}/rowset`;

// Get access token
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

// Signup - store in user DE
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const token = await getAccessToken();

    const payload = {
      items: [
        {
          keys: { Email: email },
          values: {
            Name: name,
            Password: password,
          },
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

// Login - retrieve from user DE by email
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const token = await getAccessToken();
    const filterUrl = `${restUrl}data/v1/customobjectdata/key/${userDEKey}/rowset?$filter=Email%20eq%20'${email}'`;

    const response = await fetch(filterUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch user: ${text}`);
    }

    const data = await response.json();
    const user = data.items?.[0]?.values;

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

// Track cart events in event DE
app.post('/api/track', async (req, res) => {
  const { name, email, eventType, cartItems } = req.body;

  try {
    const token = await getAccessToken();

    const payload = {
      items: [
        {
          keys: { Email: email },
          values: {
            Name: name,
            EventType: eventType,
            CartItems: JSON.stringify(cartItems),
            Timestamp: new Date().toISOString(),
          },
        },
      ],
    };

    const response = await fetch(eventDataExtensionUrl, {
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

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
