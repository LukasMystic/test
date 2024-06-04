const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const uri = 'mongodb+srv://admin:admin123@finprohci.hieclio.mongodb.net/';
const dbName = 'FinproHCI';
const collectionName = 'username';
const collectionName2 = 'book';

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


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
            res.send({ success: true, verificationCode: expectedVerificationCode }); // Include verification code in the response
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
        req.session.verified = true; // Mark user as verified
        req.session.username = username; // Save username in session
        res.send({ success: true });
    } else {
        res.send({ success: false });
    }
});

// Middleware to check if the user is verified before proceeding
const checkVerification = (req, res, next) => {
    if (!req.session.verified) {
        // If not verified, send an error response or redirect to the login page
        res.status(403).send({ success: false, message: "User not verified" });
        return;
    }
    // If verified, proceed to the next middleware
    next();
};

// Add session middleware
app.use(session({
    secret: 'bambangcaktelowashere',
    resave: false,
    saveUninitialized: false
}));

// Logout Route
app.post('/logout', (req, res) => {
    const { username } = req.session;
    console.log(`Logging out user: ${username}`);

    // Clear the user's verification status or any other session-related data
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out:", err);
            res.status(500).send({ success: false, message: "Error logging out." });
        } else {
            console.log("User logged out successfully.");
            res.send({ success: true, message: "User logged out successfully." });
        }
    });
});


// Registration Route
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const existingUser = await collection.findOne({ $or: [{ username }, { email }] });

        if (existingUser) {
            if (existingUser.username === username) {
                res.send({ success: false, message: "Nama username sudah ada." });
            } else {
                res.send({ success: false, message: "Email sudah terdaftar." });
            }
            return;
        }

        await collection.insertOne({ username, email, password, image: null, game1: null, game2: null });

        res.send({ success: true, message: "Registration successful. Please log in." });
    } catch (err) {
        console.error("Error during registration:", err);
        res.status(500).send({ success: false, message: "Error during registration." });
    }
});

//Homepage Route
app.get('/home', checkVerification, (req, res) => {
    // This route is only accessible to verified users
    res.send({ success: true, message: "Welcome to the home page" });
});

//Get User data
app.get('/user/:username', async (req, res) => {
    const { username } = req.params;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const user = await collection.findOne({ username });

        if (!user) {
            res.send({ success: false, message: "User not found." });
            return;
        }

        console.log("User data retrieved:", user);

        let base64Image = null;
        if (user.image && user.image.buffer) {
            base64Image = user.image.buffer.toString('base64');
        }

        const userData = {
            username: user.username,
            email: user.email,
            password: user.password,
            binaryImage: base64Image // Send image as base64 string
        };

        res.send({ success: true, user: userData });
    } catch (err) {
        console.error("Error fetching user data:", err);
        res.status(500).send({ success: false, message: "Error fetching user data." });
    }
});

// Edit Username Route
app.post('/edit-username/:username', async (req, res) => {
    const { username } = req.params;
    const { newUsername } = req.body;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        // Check if the new username already exists
        const existingUser = await collection.findOne({ username: newUsername });
        if (existingUser) {
            res.send({ success: false, message: "Username already taken." });
            return;
        }

        // Update the username
        const result = await collection.updateOne(
            { username },
            { $set: { username: newUsername } }
        );

        if (result.modifiedCount === 1) {
            res.send({ success: true, message: "Username updated successfully." });
        } else {
            res.send({ success: false, message: "Username update failed." });
        }
    } catch (err) {
        console.error("Error updating username:", err);
        res.status(500).send({ success: false, message: "Error updating username." });
    }
});

// Edit Password Route
app.post('/edit-password/:username', async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const user = await collection.findOne({ username });

        if (!user) {
            res.send({ success: false, message: "User not found." });
            return;
        }

        await collection.updateOne({ username }, { $set: { password: newPassword } });
        res.send({ success: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Error updating password:", err);
        res.status(500).send({ success: false, message: "Error updating password." });
    }
});


// Update Email Route
app.post('/edit-email/:username', async (req, res) => {
    const { newEmail } = req.body; // Retrieve newEmail from request body
    const { username } = req.params; // Retrieve username from route parameters

    console.log("Searching for user with username:", username); // Debug log username being searched for

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        const user = await collection.findOne({ username });

        if (!user) {
            res.send({ success: false, message: "User not found." });
            return;
        }

        // Update the email address for the user
        await collection.updateOne(
            { username },
            { $set: { email: newEmail } }
        );

        res.send({ success: true, message: "Email updated successfully." });
    } catch (err) {
        console.error("Error updating email:", err);
        res.status(500).send({ success: false, message: "Error updating email." });
    }
});

// Upload Image Route
const storage = multer.memoryStorage(); // Store uploaded files in memory to handle base64 conversion

const upload = multer({ storage: storage });

app.post('/upload-image/:username', upload.single('image'), async (req, res) => {
    const { username } = req.params; // Retrieve username from route parameters
    const { buffer } = req.file; // Retrieve uploaded image buffer

    console.log("Received image upload request for username:", username); // Debug log username

    if (!client || !client.topology || !client.topology.isConnected()) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    try {
        // Update the image for the user in the database
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        await collection.updateOne(
            { username },
            { $set: { image: buffer } } // Store image buffer directly
        );

        console.log("Image uploaded successfully for username:", username); // Debug log successful upload
        res.send({ success: true, message: "Image uploaded successfully." });
    } catch (err) {
        console.error("Error uploading image:", err); // Log error if upload fails
        res.status(500).send({ success: false, message: "Error uploading image." });
    }
});

// Use CORS middleware with specific origin
app.use(cors({
    origin: 'http://127.0.0.1:5500'
  }));

  // Upload book route
  app.post('/upload-book', upload.single('image'), async (req, res) => {
    const { bookCode, title } = req.body;
    const { buffer } = req.file;

    console.log("Received book upload request with title:", title);

    if (!client || !client.topology || !client.topology.isConnected()) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    try {
        const db = client.db(dbName);
        const collection = db.collection(collectionName2);
        await collection.insertOne({
            bookCode,
            title,
            image: buffer,
            username: null // Add the username field with a default value of null
        });

        console.log("Book uploaded successfully with title:", title);
        res.send({ success: true, message: "Book uploaded successfully." });
    } catch (err) {
        console.error("Error uploading book:", err);
        res.status(500).send({ success: false, message: "Error uploading book." });
    }
});

  

// Fetch Books by Username Route
app.get('/fetch-books/:username', async (req, res) => {
    const { username } = req.params;
    const searchQuery = req.query.search; // Get the search query from query parameters

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const userCollection = db.collection(collectionName);
    const bookCollection = db.collection(collectionName2);

    try {
        // Check if the user exists
        const user = await userCollection.findOne({ username });

        if (!user) {
            res.status(404).send({ success: false, message: "User not found." });
            return;
        }

        // Fetch books for the user
        console.log("Fetching books for user:", username); // Debugging

        let query = { username }; // Initial query to filter by username
        if (searchQuery) {
            // If search query is provided, add search criteria to the query
            query.title = { $regex: searchQuery, $options: 'i' }; // Case-insensitive regex search for title
        }

        const books = await bookCollection.find(query).toArray();

        console.log("Fetched books:", books); // Debugging

        res.send({ success: true, books });
    } catch (err) {
        console.error("Error fetching books:", err);
        res.status(500).send({ success: false, message: "Error fetching books." });
    }
});

// Append Book Route

app.post('/add-book/:username', async (req, res) => {
    const { username } = req.params;
    const { bookCode } = req.body;

    console.log("Received Request - Username:", username, "BookCode:", bookCode); // Debug statement

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const bookCollection = db.collection(collectionName2);

    try {
        // Check if the book already exists
        const existingBook = await bookCollection.findOne({ bookCode });

        if (!existingBook) {
            res.status(404).send({ success: false, message: "Book not found.", errorCode: "book_not_found" });
            return;
        }

        // Check if the book already has a username
        if (existingBook.username) {
            res.status(400).send({ success: false, message: "Book already has a username.", errorCode: "book_already_has_username" });
            return;
        }

        // Update the existing book with the current user's username
        await bookCollection.updateOne({ bookCode }, { $set: { username } });
        res.status(200).send({ success: true, message: "Book updated with current user's username.", updatedBook: { bookCode, username } });
    } catch (err) {
        console.error("Error updating book:", err);
        res.status(500).send({ success: false, message: "Error updating book.", errorCode: "server_error" });
    }
});

// Route to get data from all users in game1
app.get('/users-in-game1', async (req, res) => {
    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        // Use aggregation to replace null values with 0 for the game1 field
        const usersInGame1 = await collection.aggregate([
            {
                $project: {
                    _id: 0,
                    username: 1,
                    game1: { $ifNull: ["$game1", 0] } // Replace null with 0 for game1 field
                }
            }
        ]).toArray();

        // Send the retrieved data as a response
        res.send({ success: true, users: usersInGame1 });
    } catch (err) {
        console.error("Error fetching users in game1:", err);
        res.status(500).send({ success: false, message: "Error fetching users in game1." });
    }
});

// Update Game1 Route
app.post('/update-game1/:username', async (req, res) => {
    const { username } = req.params;
    let { game1 } = req.body;

    console.log("Received Request - Username:", username, "Game1 Score:", game1); // Debug statement

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    // Parse game1 as an integer
    game1 = parseInt(game1);

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        // Find the existing game1 score for the specified username
        const existingUser = await collection.findOne({ username });

        if (!existingUser || !existingUser.game1 || existingUser.game1 < game1) {
            // Update the game1 field for the specified username only if it's null or lower than the current score
            const result = await collection.updateOne(
                { username },
                { $set: { game1 } }
            );

            if (result.modifiedCount === 1) {
                res.send({ success: true, message: "Game1 score updated successfully." });
            } else {
                res.send({ success: false, message: "Failed to update game1 score." });
            }
        } else {
            // The current score is not higher than the existing score, no update needed
            res.send({ success: false, message: "Current game1 score is not higher than the existing score." });
        }
    } catch (err) {
        console.error("Error updating game1 score:", err);
        res.status(500).send({ success: false, message: "Error updating game1 score." });
    }
});


// Route to get data from all users in game2
app.get('/users-in-game2', async (req, res) => {
    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        // Use aggregation to replace null values with 0 for the game2 field
        const usersInGame2 = await collection.aggregate([
            {
                $project: {
                    _id: 0,
                    username: 1,
                    game2: { $ifNull: ["$game2", 0] } // Replace null with 0 for game2 field
                }
            }
        ]).toArray();

        // Send the retrieved data as a response
        res.send({ success: true, users: usersInGame2 });
    } catch (err) {
        console.error("Error fetching users in game2:", err);
        res.status(500).send({ success: false, message: "Error fetching users in game2." });
    }
});

// Update Game2 Route
app.post('/update-game2/:username', async (req, res) => {
    const { username } = req.params;
    let { game2 } = req.body;

    console.log("Received Request - Username:", username, "Game2 Score:", game2); // Debug statement

    if (!client) {
        res.status(500).send("Error: Database connection not established.");
        return;
    }

    // Parse game2 as an integer
    game2 = parseInt(game2);

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    try {
        // Find the existing game2 score for the specified username
        const existingUser = await collection.findOne({ username });

        if (!existingUser || !existingUser.game2 || existingUser.game2 < game2) {
            // Update the game2 field for the specified username only if it's null or lower than the current score
            const result = await collection.updateOne(
                { username },
                { $set: { game2 } }
            );

            if (result.modifiedCount === 1) {
                res.send({ success: true, message: "Game2 score updated successfully." });
            } else {
                res.send({ success: false, message: "Failed to update game2 score." });
            }
        } else {
            // The current score is not higher than the existing score, no update needed
            res.send({ success: false, message: "Current game2 score is not higher than the existing score." });
        }
    } catch (err) {
        console.error("Error updating game2 score:", err);
        res.status(500).send({ success: false, message: "Error updating game2 score." });
    }
});


app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
