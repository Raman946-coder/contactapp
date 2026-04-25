const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 1. CLOUD DATABASE CONNECTION (Aiven)
// When deploying to Render, we will set these variables in the Render Dashboard.
const db = mysql.createPool({
  host: process.env.DB_HOST || "mysql-76ab014-rk-0cad.c.aivencloud.com",
  port: process.env.DB_PORT || 24059,
  user: process.env.DB_USER || "avnadmin",
  password: process.env.DB_PASSWORD || "AVNS_EdM28o6YcS7o4WRGtjD",
  database: process.env.DB_NAME || "defaultdb",
  ssl: {
    rejectUnauthorized: false // Required for Aiven/Cloud SSL connections
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Cloud Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to Aiven Cloud MySQL");
    connection.release();
  }
});

// 2. API ROUTES (CRUD)

// GET: Fetch all
app.get("/contacts", (req, res) => {
  const sql = `
    SELECT c.contact_id, c.first_name, c.last_name, e.email, p.phone_number
    FROM contacts c
    LEFT JOIN emails e ON c.contact_id = e.contact_id
    LEFT JOIN phone_numbers p ON c.contact_id = p.contact_id
    ORDER BY c.contact_id DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// POST: Add new
app.post("/add", (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  const sql1 = "INSERT INTO contacts (first_name, last_name) VALUES (?, ?)";
  
  db.query(sql1, [first_name, last_name], (err, result) => {
    if (err) return res.status(500).json(err);
    const contactId = result.insertId;
    const sql2 = "INSERT INTO emails (contact_id, email) VALUES (?, ?)";
    const sql3 = "INSERT INTO phone_numbers (contact_id, phone_number) VALUES (?, ?)";

    db.query(sql2, [contactId, email || null], (err2) => {
      db.query(sql3, [contactId, phone || null], (err3) => {
        if (err2 || err3) return res.status(500).json({ error: "Secondary insert failed" });
        res.send("Contact added successfully");
      });
    });
  });
});

// PUT: Update
app.put("/update/:id", (req, res) => {
  const contactId = req.params.id;
  const { first_name, last_name, email, phone } = req.body;
  const sql1 = "UPDATE contacts SET first_name = ?, last_name = ? WHERE contact_id = ?";
  const sql2 = "UPDATE emails SET email = ? WHERE contact_id = ?";
  const sql3 = "UPDATE phone_numbers SET phone_number = ? WHERE contact_id = ?";

  db.query(sql1, [first_name, last_name, contactId], (err) => {
    db.query(sql2, [email, contactId], (err2) => {
      db.query(sql3, [phone, contactId], (err3) => {
        if (err || err2 || err3) return res.status(500).json({ error: "Update failed" });
        res.send("Update successful");
      });
    });
  });
});

// DELETE
app.delete("/delete/:id", (req, res) => {
  const contactId = req.params.id;
  const sqlEmail = "DELETE FROM emails WHERE contact_id = ?";
  const sqlPhone = "DELETE FROM phone_numbers WHERE contact_id = ?";
  const sqlContact = "DELETE FROM contacts WHERE contact_id = ?";

  db.query(sqlEmail, [contactId], (err) => {
    db.query(sqlPhone, [contactId], (err2) => {
      db.query(sqlContact, [contactId], (err3) => {
        if (err || err2 || err3) return res.status(500).json({ error: "Delete failed" });
        res.send("Deleted successfully");
      });
    });
  });
});

// 3. START SERVER
// The process.env.PORT is necessary for Render to assign a port automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});