require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for API calls
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Serve static frontend files
app.use(express.static(__dirname));

let dbCollection = null;

// Connect to MongoDB if MONGO_URI is present
if (process.env.MONGO_URI) {
  const client = new MongoClient(process.env.MONGO_URI);
  client.connect().then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    dbCollection = client.db('hisonly').collection('appdata');
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
} else {
  console.log('⚠️ No MONGO_URI provided. Falling back to local data.json for storage.');
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      hisonly_users: [],
      hisonly_avail: {},
      hisonly_schedules: {},
      hisonly_lineups: {}
    }, null, 2));
  }
}

// Helper to read data
async function readData(key) {
  if (dbCollection) {
    const doc = await dbCollection.findOne({ _id: key });
    return doc ? doc.value : null;
  } else {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data[key] || null;
  }
}

// Helper to write data with smart merging to prevent data loss
async function writeData(key, value) {
  let existingValue = null;
  
  // 1. Fetch existing value
  if (dbCollection) {
    const doc = await dbCollection.findOne({ _id: key });
    existingValue = doc ? doc.value : null;
  } else {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      existingValue = data[key] || null;
    } catch (e) {
      existingValue = null;
    }
  }

  // 2. Perform merge logic
  let newValue = value;
  if (existingValue !== null) {
    if (Array.isArray(existingValue) && Array.isArray(value)) {
      // Merge arrays by 'id' field if present, otherwise unique items
      const map = new Map();
      existingValue.forEach(item => {
        const id = (item && item.id) || (typeof item === 'string' ? item : JSON.stringify(item));
        map.set(id, item);
      });
      value.forEach(item => {
        const id = (item && item.id) || (typeof item === 'string' ? item : JSON.stringify(item));
        map.set(id, item);
      });
      newValue = Array.from(map.values());
    } else if (
      typeof existingValue === 'object' && existingValue !== null &&
      typeof value === 'object' && value !== null &&
      !Array.isArray(existingValue) && !Array.isArray(value)
    ) {
      // Shallow merge objects (useful for availability and schedules)
      newValue = { ...existingValue, ...value };
    }
  }

  // 3. Save merged value
  if (dbCollection) {
    await dbCollection.updateOne(
      { _id: key },
      { $set: { value: newValue } },
      { upsert: true }
    );
  } else {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    data[key] = newValue;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }
}

// GET generic data by key
app.get('/api/data/:key', async (req, res) => {
  try {
    const val = await readData(req.params.key);
    res.json(val);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while reading data' });
  }
});

// POST generic data by key
app.post('/api/data/:key', async (req, res) => {
  try {
    await writeData(req.params.key, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving data' });
  }
});

// DELETE a user by ID (bypasses merge logic)
app.delete('/api/delete-user/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    if (dbCollection) {
      const doc = await dbCollection.findOne({ _id: 'hisonly_users' });
      const users = doc ? doc.value : [];
      const filtered = users.filter(u => u.id !== uid);
      await dbCollection.updateOne(
        { _id: 'hisonly_users' },
        { $set: { value: filtered } },
        { upsert: true }
      );
    } else {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      data['hisonly_users'] = (data['hisonly_users'] || []).filter(u => u.id !== uid);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while deleting user' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
