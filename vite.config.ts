import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'silver-scraper-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/scrape-silver') {
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

                res.setHeader('Content-Type', 'application/json');
                if (silverPrice > 0) {
                  res.end(JSON.stringify({ price: silverPrice, success: true }));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Could not find silver price on page", success: false }));
                }
              } catch (error: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Failed to fetch silver price: ${error.message}`, success: false }));
              }
              return;
            }
            next();
          });
        }
      }
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
