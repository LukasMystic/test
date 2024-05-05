const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

const uri = 'mongodb+srv://admin:admin123@finprohci.hieclio.mongodb.net/';
const dbName = 'FinproHCI';
const collectionName = 'username';

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Serve static files from the current directory
app.use(express.static(__dirname));

// MongoDB Connection
let client;

async function connectToDatabase() {
    try {
        client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to the database");
    } catch (err) {
        console.error("Error connecting to the database:", err);
    }
}

connectToDatabase();

// Generate random 8-character verification code
function generateVerificationCode() {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    console.log("Generated token:", token);
    return token;
}

// Store the generated verification code
let expectedVerificationCode;

// Login Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        console.log("Searching for user with username:", username);
        const user = await collection.findOne({ username });

        if (!user) {
            res.send({ success: false, message: "User not found." });
            return;
        }

        if (user.password === password) {
            expectedVerificationCode = generateVerificationCode();
            res.send({ success: true });
        } else {
            res.send({ success: false, message: "Invalid password." });
        }
    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).send({ success: false, message: "Error during login." });
    }
});

// Verification Route
app.post('/verify', async (req, res) => {
    const { verificationCode } = req.body;

    if (verificationCode === expectedVerificationCode) {
        res.send({ success: true });
    } else {
        res.send({ success: false });
    }
});

// Registration Route
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const existingUser = await collection.findOne({ username });

        if (existingUser) {
            res.send({ success: false, message: "Username already exists." });
            return;
        }

        await collection.insertOne({ username, password });

        // Redirect to login page after successful registration
        res.redirect('/login');
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).send({ success: false, message: "Error during registration." });
    }
});

// Serve login.html for GET request to "/login"
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve verification.html for GET request to "/verification"
app.get('/verification', (req, res) => {
    res.sendFile(path.join(__dirname, 'verification.html'));
});

// Serve register.html for GET request to "/register"
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
