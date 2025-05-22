require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && tokenExpiry && now < tokenExpiry) return accessToken;

  const response = await fetch(`${process.env.SFMC_AUTH_URL}/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SFMC_CLIENT_ID,
      client_secret: process.env.SFMC_CLIENT_SECRET,
    }),
  });

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000;
  return accessToken;
}

app.post("/api/track", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${process.env.SFMC_REST_URL}/data/v1/customobjectdata/key/${process.env.DATA_EXTENSION_KEY}/rowset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: [req.body] }),
    });

    const result = await response.json();
    res.status(response.status).json(result);
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ error: "Failed to track event." });
  }
});

app.post("/api/signup", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${process.env.SFMC_REST_URL}/data/v1/customobjectdata/key/${process.env.USER_DATA_EXTENSION_KEY}/rowset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: [req.body] }),
    });

    const result = await response.json();
    res.status(response.status).json(result);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Failed to sign up." });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${process.env.SFMC_REST_URL}/data/v1/customobjectdata/key/${process.env.USER_DATA_EXTENSION_KEY}/rowset`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("User fetch error:", err);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));