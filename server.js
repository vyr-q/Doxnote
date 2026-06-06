const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

const DATA_FILE = path.join(__dirname, 'server_data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'dev-t8ky1sq7itz4af5f.us.auth0.com';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const PORT = process.env.PORT || 3000;

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const base = { users: {}, docs: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(base, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (e) {
    console.error('Failed to load data', e);
    return { users: {}, docs: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));

// Signup
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const data = loadData();
  if (data.users[username]) return res.status(409).json({ error: 'user exists' });
  const hash = bcrypt.hashSync(password, 10);
  data.users[username] = { passwordHash: hash, created: Date.now() };
  data.docs[username] = data.docs[username] || {};
  saveData(data);
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ username, token });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const data = loadData();
  const u = data.users[username];
  if (!u) return res.status(404).json({ error: 'user not found' });
  const ok = bcrypt.compareSync(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ username, token });
});

// Middleware to authenticate JWT. Supports Auth0 tokens when AUTH0_DOMAIN is set,
// otherwise falls back to local JWT_SECRET tokens used by earlier code.
function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'missing auth' });
  const token = m[1];

  // If AUTH0_DOMAIN is configured, verify via JWKS
  const auth0Domain = AUTH0_DOMAIN;
  if (auth0Domain) {
    const client = jwksRsa({ jwksUri: `https://${auth0Domain}/.well-known/jwks.json` });
    // decode header to get kid
    let decodedHeader;
    try {
      decodedHeader = jwt.decode(token, { complete: true }).header;
    } catch (err) {
      return res.status(401).json({ error: 'invalid token' });
    }
    const kid = decodedHeader && decodedHeader.kid;
    if (!kid) return res.status(401).json({ error: 'invalid token header' });
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        // couldn't fetch JWKS; fall back to local secret verification
        try {
          const payload = jwt.verify(token, JWT_SECRET);
          req.user = payload.username;
          return next();
        } catch (e) {
          return res.status(401).json({ error: 'invalid token' });
        }
      }
      const pubKey = key.getPublicKey();
      // verify token using Auth0 public key; include issuer and audience when configured
      const verifyOptions = { algorithms: ['RS256'] };
      if (AUTH0_DOMAIN) verifyOptions.issuer = `https://${AUTH0_DOMAIN}/`;
      if (AUTH0_AUDIENCE) verifyOptions.audience = AUTH0_AUDIENCE;
      jwt.verify(token, pubKey, verifyOptions, (verr, payload) => {
        if (!verr && payload) {
          req.user = payload.sub || payload.username;
          return next();
        }
        // fallback to local secret
        try {
          const p2 = jwt.verify(token, JWT_SECRET);
          req.user = p2.username;
          return next();
        } catch (e2) {
          return res.status(401).json({ error: 'invalid token' });
        }
      });
    });
    return;
  }

  // Fallback: verify local JWT signed with JWT_SECRET
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// List saved docs for user
app.get('/api/docs', auth, (req, res) => {
  const data = loadData();
  const docs = data.docs[req.user] || {};
  // return metadata only
  const meta = Object.keys(docs).map(name => ({ name, created: docs[name].created }));
  res.json({ docs: meta });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Save a named doc
app.post('/api/docs', auth, (req, res) => {
  const { name, payload } = req.body || {};
  if (!name || !payload) return res.status(400).json({ error: 'name and payload required' });
  const data = loadData();
  data.docs[req.user] = data.docs[req.user] || {};
  data.docs[req.user][name] = { payload, created: Date.now() };
  saveData(data);
  res.json({ ok: true });
});

// Get specific named doc
app.get('/api/docs/:name', auth, (req, res) => {
  const name = req.params.name;
  const data = loadData();
  const doc = data.docs[req.user] && data.docs[req.user][name];
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json({ payload: doc.payload, created: doc.created });
});

// Delete named doc
app.delete('/api/docs/:name', auth, (req, res) => {
  const name = req.params.name;
  const data = loadData();
  if (data.docs[req.user] && data.docs[req.user][name]) {
    delete data.docs[req.user][name];
    saveData(data);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'not found' });
});

// Save/Load current workspace (optional endpoints)
app.post('/api/workspace', auth, (req, res) => {
  const { payload } = req.body || {};
  if (!payload) return res.status(400).json({ error: 'payload required' });
  const data = loadData();
  data.workspace = data.workspace || {};
  data.workspace[req.user] = payload;
  saveData(data);
  res.json({ ok: true });
});

app.get('/api/workspace', auth, (req, res) => {
  const data = loadData();
  const payload = data.workspace && data.workspace[req.user];
  res.json({ payload: payload || null });
});

app.listen(PORT, () => console.log('Server running on port', PORT));
