import * as functions from "firebase-functions";
import axios from "axios";
import * as cheerio from "cheerio";
import * as cors from "cors";

const corsHandler = cors({ origin: true });

export const scrapeSilver = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    console.log("Scraping silver price request received");
    try {
      const response = await axios.get("https://giabac.phuquygroup.vn/", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
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
});

export const scrapeGold = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    console.log("PNJ Gold scraping request received");
    try {
      const response = await axios.get("https://www.pnj.com.vn/site/gia-vang", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
      });
      const $ = cheerio.load(response.data);
      
      let goldPrice = 0;
      
      // PNJ typically uses a table. We look for "Nhẫn Trơn PNJ 999.9"
      $("tr").each((i, el) => {
        const rowText = $(el).text().trim().toLowerCase();
        if (rowText.includes("nhẫn trơn pnj 999.9")) {
          // Use find("td, th") because the first cell (name) might be a <th>
          const cells = $(el).find("td, th");
          
          // Based on the table structure:
          // Index 0: Name (e.g., "Nhẫn Trơn PNJ 999.9")
          // Index 1: Buy price (Giá mua)
          // Index 2: Sell price (Giá bán)
          if (cells.length >= 2) {
            // We want "Giá mua" which is index 1
            const buyPriceText = $(cells[1]).text().trim().replace(/[^0-9]/g, "");
            if (buyPriceText) {
              const price = parseInt(buyPriceText);
              // PNJ units are 1,000 VND per Chi. 
              // If the value is 18,380, it means 18,380,000 VND.
              if (price > 0 && price < 1000000) {
                goldPrice = price * 1000;
              } else {
                goldPrice = price;
              }
              console.log(`Matched PNJ row. Name: ${$(cells[0]).text().trim()}, Raw Buy: ${buyPriceText}, Final: ${goldPrice}`);
            }
          }
        }
      });

      if (goldPrice > 0) {
        res.json({ price: goldPrice, success: true });
      } else {
        res.status(404).json({ error: "Could not find PNJ gold price on page", success: false });
      }
    } catch (error: any) {
      console.error("PNJ Gold scraping error:", error.message);
      res.status(500).json({ error: `Failed to fetch PNJ gold price: ${error.message}`, success: false });
    }
  });
});
