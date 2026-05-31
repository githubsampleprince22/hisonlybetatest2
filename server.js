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
      hisonly_lineups: {},
      hisonly_announcements: []
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

// Helper to write data
async function writeData(key, value) {
  // Arrays (announcements, users) are always fully replaced — the frontend
  // sends the complete updated array so merging would re-add deleted items.
  // Objects (schedules, availability, lineups) are shallow-merged so that
  // concurrent saves from different tabs don't wipe each other out.
  let newValue = value;

  if (
    !Array.isArray(value) &&
    typeof value === 'object' && value !== null
  ) {
    // Shallow merge objects only
    let existingValue = null;
    if (dbCollection) {
      const doc = await dbCollection.findOne({ _id: key });
      existingValue = doc ? doc.value : null;
    } else {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        existingValue = JSON.parse(raw)[key] || null;
      } catch (e) {
        existingValue = null;
      }
    }
    if (existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)) {
      newValue = { ...existingValue, ...value };
    }
  }

  // Save value
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
