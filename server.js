const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
};

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';

// --- MIDDLEWARE: PROTECT ROUTES ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        await connection.end();
        res.json({ message: "User created" });
    } catch (err) {
        res.status(500).json({ error: "Username already exists or server error" });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        await connection.end();

        if (users.length === 0 || !(await bcrypt.compare(password, users[0].password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: users[0].id, username: username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- CONTACT ROUTES (CRUD) ---

// 1. GET ALL CONTACTS (For Logged In User)
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT c.contact_id, c.first_name, c.last_name, e.email, p.phone_number 
            FROM contacts c
            LEFT JOIN emails e ON c.contact_id = e.contact_id
            LEFT JOIN phone_numbers p ON c.contact_id = p.contact_id
            WHERE c.user_id = ?`, [req.user.id]);
        await connection.end();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch contacts" });
    }
});

// 2. ADD NEW CONTACT
app.post('/api/contacts', authenticateToken, async (req, res) => {
    const { first_name, last_name, email, phone_number } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        const [contactResult] = await connection.execute(
            'INSERT INTO contacts (user_id, first_name, last_name) VALUES (?, ?, ?)',
            [req.user.id, first_name, last_name]
        );
        const contactId = contactResult.insertId;

        if (email) await connection.execute('INSERT INTO emails (contact_id, email) VALUES (?, ?)', [contactId, email]);
        if (phone_number) await connection.execute('INSERT INTO phone_numbers (contact_id, phone_number) VALUES (?, ?)', [contactId, phone_number]);

        await connection.commit();
        res.json({ message: "Contact added", id: contactId });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: "Failed to add contact" });
    } finally {
        if (connection) await connection.end();
    }
});

// 3. UPDATE CONTACT
app.put('/api/contacts/:id', authenticateToken, async (req, res) => {
    const { first_name, last_name, email, phone_number } = req.body;
    const contactId = req.params.id;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();

        // Update basic info (Ensures only owner can update)
        await connection.execute(
            'UPDATE contacts SET first_name = ?, last_name = ? WHERE contact_id = ? AND user_id = ?',
            [first_name, last_name, contactId, req.user.id]
        );

        // Update/Insert Email
        await connection.execute(
            'INSERT INTO emails (contact_id, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = ?',
            [contactId, email, email]
        );

        // Update/Insert Phone
        await connection.execute(
            'INSERT INTO phone_numbers (contact_id, phone_number) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone_number = ?',
            [contactId, phone_number, phone_number]
        );

        await connection.commit();
        res.json({ message: "Contact updated" });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ error: "Update failed" });
    } finally {
        if (connection) await connection.end();
    }
});

// 4. DELETE CONTACT
app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        // Cascade delete will handle emails and phone_numbers if foreign keys are set to ON DELETE CASCADE
        const [result] = await connection.execute(
            'DELETE FROM contacts WHERE contact_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        await connection.end();

        if (result.affectedRows === 0) return res.status(404).json({ error: "Not authorized or not found" });
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
