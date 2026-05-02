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

// Helper to write data
async function writeData(key, value) {
  if (dbCollection) {
    await dbCollection.updateOne(
      { _id: key },
      { $set: { value: value } },
      { upsert: true }
    );
  } else {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    data[key] = value;
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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
