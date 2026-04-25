const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Secret key for signing tokens - added to Render Env Variables
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
};

// --- SECURITY MIDDLEWARE ---
// This checks if the user is logged in before allowing contact access
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied. Please login." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Session expired. Login again." });
        req.user = user; // This contains the user's ID from the database
        next();
    });
};

// --- AUTH ROUTES ---

// 1. Register User
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await mysql.createConnection(dbConfig);
        
        await connection.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );
        res.status(201).json({ message: "User registered successfully!" });
        await connection.end();
    } catch (err) {
        res.status(500).json({ error: "Username already exists or database error." });
    }
});

// 2. Login User
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(400).json({ error: "User not found" });

        const isPasswordValid = await bcrypt.compare(password, users[0].password);
        if (!isPasswordValid) return res.status(400).json({ error: "Invalid credentials" });

        // Generate the Token (Valid for 2 hours)
        const token = jwt.sign(
            { id: users[0].id, username: users[0].username }, 
            JWT_SECRET, 
            { expiresIn: '2h' }
        );

        res.json({ token, username: users[0].username });
        await connection.end();
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- PROTECTED CONTACT ROUTES ---

// Get ONLY contacts created by the logged-in user
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            `SELECT c.contact_id, c.first_name, c.last_name, e.email, p.phone_number 
             FROM contacts c 
             LEFT JOIN emails e ON c.contact_id = e.contact_id 
             LEFT JOIN phone_numbers p ON c.contact_id = p.contact_id 
             WHERE c.user_id = ? 
             ORDER BY c.contact_id DESC`, 
            [req.user.id]
        );
        res.json(rows);
        await connection.end();
    } catch (err) {
        res.status(500).json({ error: "Could not fetch your contacts." });
    }
});

// Add contact linked to current user
app.post('/api/contacts', authenticateToken, async (req, res) => {
    const { first_name, last_name, email, phone_number } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        const [contactResult] = await connection.execute(
            'INSERT INTO contacts (first_name, last_name, user_id) VALUES (?, ?, ?)',
            [first_name, last_name, req.user.id]
        );
        const contactId = contactResult.insertId;

        if (email) {
            await connection.execute('INSERT INTO emails (contact_id, email) VALUES (?, ?)', [contactId, email]);
        }
        if (phone_number) {
            await connection.execute('INSERT INTO phone_numbers (contact_id, phone_number) VALUES (?, ?)', [contactId, phone_number]);
        }

        await connection.commit();
        res.json({ message: "Contact saved!", id: contactId });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: "Failed to save contact" });
    } finally {
        if (connection) await connection.end();
    }
});

const PORT = process.env.PORT || 3000;
// Update a contact
app.put('/api/contacts/:id', authenticateToken, async (req, res) => {
    const { first_name, last_name, email, phone_number } = req.body;
    const contactId = req.params.id;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        // 1. Update name
        await connection.execute(
            'UPDATE contacts SET first_name = ?, last_name = ? WHERE contact_id = ? AND user_id = ?',
            [first_name, last_name, contactId, req.user.id]
        );

        // 2. Update Email (Using UPSERT logic)
        await connection.execute(
            'INSERT INTO emails (contact_id, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = ?',
            [contactId, email, email]
        );

        // 3. Update Phone
        await connection.execute(
            'INSERT INTO phone_numbers (contact_id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = ?',
            [contactId, phone_number, phone_number]
        );

        await connection.commit();
        res.json({ message: "Contact updated successfully" });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: "Failed to update contact" });
    } finally {
        if (connection) await connection.end();
    }
});
app.listen(PORT, () => console.log(`🚀 Secure Server running on port ${PORT}`));
