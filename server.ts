import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("assets.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    units REAL NOT NULL,
    buyPrice REAL NOT NULL,
    currentPrice REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'VNĐ',
    buyDate TEXT,
    note TEXT,
    passcode TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec("ALTER TABLE assets ADD COLUMN buyDate TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE assets ADD COLUMN note TEXT");
} catch (e) {}

try {
  db.exec("ALTER TABLE assets ADD COLUMN passcode TEXT");
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS market_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    price REAL NOT NULL,
    passcode TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, passcode)
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/assets", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode || passcode === "") return res.status(401).json({ error: "Passcode required" });
    
    const assets = db.prepare("SELECT * FROM assets WHERE passcode = ? ORDER BY updatedAt DESC").all(passcode);
    res.json(assets);
  });

  app.post("/api/assets", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode) return res.status(401).json({ error: "Passcode required" });

    let { name, category, type, units, buyPrice, currentPrice, currency, buyDate, note } = req.body;
    
    // If currentPrice is not provided or is 0, try to find a market price for this type or category
    if (!currentPrice || currentPrice === 0) {
      const marketPrice = db.prepare(`
        SELECT price FROM market_prices 
        WHERE (UPPER(symbol) = UPPER(?) OR UPPER(symbol) = UPPER(?)) AND passcode = ?
      `).get(type, category, passcode);
      
      if (marketPrice) {
        currentPrice = marketPrice.price;
      }
    }

    const info = db.prepare(`
      INSERT INTO assets (name, category, type, units, buyPrice, currentPrice, currency, buyDate, note, passcode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, type, units, buyPrice, currentPrice || 0, currency || 'VNĐ', buyDate, note, passcode);
    
    const newAsset = db.prepare("SELECT * FROM assets WHERE id = ?").get(info.lastInsertRowid);
    res.json(newAsset);
  });

  app.put("/api/assets/:id", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode || passcode === "") return res.status(401).json({ error: "Passcode required" });

    const { id } = req.params;
    const { name, category, type, units, buyPrice, currentPrice, currency, buyDate, note } = req.body;
    
    // Ensure the asset belongs to the user
    const asset = db.prepare("SELECT * FROM assets WHERE id = ? AND passcode = ?").get(id, passcode);
    if (!asset) return res.status(403).json({ error: "Unauthorized" });

    db.prepare(`
      UPDATE assets 
      SET name = ?, category = ?, type = ?, units = ?, buyPrice = ?, currentPrice = ?, currency = ?, buyDate = ?, note = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ? AND passcode = ?
    `).run(name, category, type, units, buyPrice, currentPrice, currency || 'VNĐ', buyDate, note, id, passcode);
    
    const updatedAsset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id);
    res.json(updatedAsset);
  });

  app.delete("/api/assets/:id", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode || passcode === "") return res.status(401).json({ error: "Passcode required" });

    const { id } = req.params;
    const result = db.prepare("DELETE FROM assets WHERE id = ? AND passcode = ?").run(Number(id), passcode);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Asset not found or unauthorized" });
    }
    
    res.json({ success: true });
  });

  // Market Price Routes
  app.get("/api/market-prices", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode) return res.status(401).json({ error: "Passcode required" });
    
    const prices = db.prepare("SELECT * FROM market_prices WHERE passcode = ? ORDER BY symbol ASC").all(passcode);
    res.json(prices);
  });

  app.put("/api/market-prices", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode) return res.status(401).json({ error: "Passcode required" });

    const { symbol, price } = req.body;
    
    // Upsert market price
    db.prepare(`
      INSERT INTO market_prices (symbol, price, passcode, updatedAt)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol, passcode) DO UPDATE SET
        price = excluded.price,
        updatedAt = CURRENT_TIMESTAMP
    `).run(symbol, price, passcode);

    // Automatically update all assets with this symbol (matching type OR category)
    // We use UPPER() to ensure case-insensitive matching
    db.prepare(`
      UPDATE assets 
      SET currentPrice = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE (UPPER(type) = UPPER(?) OR UPPER(category) = UPPER(?)) AND passcode = ?
    `).run(price, symbol, symbol, passcode);
    
    res.json({ success: true });
  });

  app.delete("/api/market-prices/:symbol", (req, res) => {
    const passcode = req.headers["x-passcode"];
    if (!passcode || passcode === "") return res.status(401).json({ error: "Passcode required" });

    const { symbol } = req.params;
    const result = db.prepare("DELETE FROM market_prices WHERE symbol = ? AND passcode = ?").run(symbol, passcode);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Market price not found or unauthorized" });
    }
    
    res.json({ success: true });
  });

  app.post("/api/auth/change-passcode", (req, res) => {
    const currentPasscode = req.headers["x-passcode"];
    const { newPasscode } = req.body;

    if (!currentPasscode || currentPasscode === "") return res.status(401).json({ error: "Current passcode required" });
    if (!newPasscode || newPasscode.trim() === "") return res.status(400).json({ error: "New passcode required" });

    try {
      db.transaction(() => {
        // Update assets
        db.prepare("UPDATE assets SET passcode = ? WHERE passcode = ?").run(newPasscode, currentPasscode);
        // Update market prices
        db.prepare("UPDATE market_prices SET passcode = ? WHERE passcode = ?").run(newPasscode, currentPasscode);
      })();
      res.json({ success: true });
    } catch (error) {
      console.error("Change passcode error:", error);
      res.status(500).json({ error: "Failed to change passcode. It might already be in use." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
