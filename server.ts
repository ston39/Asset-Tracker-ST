import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

async function startServer() {
  try {
    console.log("Initializing Express app...");
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
          },
          timeout: 10000
        });
        const $ = cheerio.load(response.data);
        
        let silverPrice = 0;
        
        $("tr").each((i, el) => {
          const rowText = $(el).text().toLowerCase();
          if (rowText.includes("bạc miếng phú quý 999") || 
              rowText.includes("bạc thương hiệu phú quý") ||
              rowText.includes("bạc miếng phú quý 999 1 lượng")) {
            const cells = $(el).find("td");
            if (cells.length >= 3) {
              const buyPriceText = $(cells[2]).text().trim().replace(/[^0-9]/g, "");
              if (buyPriceText) {
                silverPrice = parseInt(buyPriceText);
              }
            }
          }
        });

        if (silverPrice === 0) {
          $("div, span, p").each((i, el) => {
            const text = $(el).text().toLowerCase();
            if (text.includes("bạc miếng phú quý 999") && text.length < 100) {
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
        res.status(500).json({ error: `Failed to fetch silver price: ${error.message}`, success: false });
      }
    });

    // API 404 handler
    app.use("/api/*", (req, res) => {
      res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      console.log("Starting Vite in middleware mode...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false 
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached.");
    } else {
      app.use(express.static("dist"));
      app.get("*", (req, res) => {
        res.sendFile("index.html", { root: "dist" });
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Critical server startup error:", err);
    process.exit(1);
  }
}

startServer();
