import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API route to scrape silver price
  app.get("/api/scrape-silver", async (req, res) => {
    try {
      const response = await axios.get("https://giabac.phuquygroup.vn/", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      
      let silverPrice = 0;
      
      // The site likely has a table. We look for rows.
      // Based on common structures for these sites:
      $("tr").each((i, el) => {
        const rowText = $(el).text().toLowerCase();
        if (rowText.includes("bạc miếng phú quý 999") || 
            rowText.includes("bạc thương hiệu phú quý") ||
            rowText.includes("bạc miếng phú quý 999 1 lượng")) {
          const cells = $(el).find("td");
          if (cells.length >= 3) {
            // Usually: Product | Unit | Buy | Sell
            // We want Buy Price (GIÁ MUA VÀO)
            const buyPriceText = $(cells[2]).text().trim().replace(/[^0-9]/g, "");
            if (buyPriceText) {
              silverPrice = parseInt(buyPriceText);
            }
          }
        }
      });

      if (silverPrice === 0) {
        // Fallback: try to find by specific class or other patterns if tr/td fails
        // Some sites use divs
        $("div, span, p").each((i, el) => {
          const text = $(el).text().toLowerCase();
          if (text.includes("bạc miếng phú quý 999") && text.length < 100) {
             // Try to find the next sibling or parent's child that looks like a number
             const priceMatch = $(el).parent().text().match(/[0-9]{1,3}(\.[0-9]{3})+/);
             if (priceMatch) {
               silverPrice = parseInt(priceMatch[0].replace(/\./g, ""));
             }
          }
        });
      }

      if (silverPrice > 0) {
        res.json({ price: silverPrice, success: true });
      } else {
        res.status(404).json({ error: "Could not find silver price on page", success: false });
      }
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to fetch silver price", success: false });
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
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("index.html", { root: "dist" });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
