const express = require("express");
const fetch   = require("node-fetch");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ─────────────────────────────────────────────────────────
   HELPER: classify symbol → decide which API to hit
───────────────────────────────────────────────────────── */
const BINANCE_CRYPTO = [
  "BTC","ETH","BNB","SOL","XRP","DOGE","ADA","AVAX","SHIB","TON",
  "LINK","DOT","TRX","MATIC","UNI","LTC","BCH","XLM","ATOM","APT",
  "ICP","ARB","OP","INJ","NEAR","MKR","AAVE","FIL","VET","ALGO"
];

function getSymbolType(symbol) {
  const s = symbol.toUpperCase();
  if (BINANCE_CRYPTO.includes(s)) return { type: "binance", binanceSymbol: s + "USDT" };
  if (s.endsWith(".IS"))          return { type: "yahoo",   yahooSymbol: s };
  return { type: "yahoo", yahooSymbol: s };
}

/* ─────────────────────────────────────────────────────────
   BINANCE — candles
───────────────────────────────────────────────────────── */
async function fetchBinanceCandles(binanceSymbol, interval = "1d", limit = 200) {
  const intervalMap = {
    "1m":"1m","5m":"5m","15m":"15m","30m":"30m",
    "1h":"1h","4h":"4h","1d":"1d","1w":"1w"
  };
  const bi = intervalMap[interval] || "1d";
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${bi}&limit=${limit}`;
  const r = await fetch(url, { headers: { "User-Agent": "nexus-terminal/1.0" } });
  if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
  const raw = await r.json();
  return raw.map(k => ({
    time:   Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchBinanceTicker(binanceSymbol) {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance ticker HTTP ${r.status}`);
  const d = await r.json();
  return {
    price:       parseFloat(d.lastPrice),
    change:      parseFloat(d.priceChangePercent),
    high24h:     parseFloat(d.highPrice),
    low24h:      parseFloat(d.lowPrice),
    volume24h:   parseFloat(d.quoteVolume),
  };
}

/* ─────────────────────────────────────────────────────────
   YAHOO FINANCE — candles + ticker
───────────────────────────────────────────────────────── */
const YF_INTERVAL_MAP = {
  "1m":"1m","5m":"5m","15m":"15m","30m":"30m",
  "1h":"60m","4h":"1d","1d":"1d","1w":"1wk"
};
const YF_RANGE_MAP = {
  "1m":"1d","5m":"5d","15m":"5d","30m":"1mo",
  "1h":"3mo","4h":"1y","1d":"2y","1w":"5y"
};

async function fetchYahooCandles(yahooSymbol, interval = "1d") {
  const yfi  = YF_INTERVAL_MAP[interval] || "1d";
  const range = YF_RANGE_MAP[interval] || "2y";
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yfi}&range=${range}&includePrePost=false`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; nexus-terminal/1.0)",
      "Accept": "application/json",
    }
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const json = await r.json();
  const res  = json?.chart?.result?.[0];
  if (!res) throw new Error("Yahoo: no data");

  const { timestamp: ts, indicators: { quote: [q] } } = res;
  const candles = ts.map((t, i) => ({
    time:   t,
    open:   q.open[i],
    high:   q.high[i],
    low:    q.low[i],
    close:  q.close[i],
    volume: q.volume[i] || 0,
  })).filter(d => d.open != null && d.close != null && d.high != null && d.low != null);

  return candles;
}

async function fetchYahooTicker(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; nexus-terminal/1.0)",
      "Accept": "application/json",
    }
  });
  if (!r.ok) throw new Error(`Yahoo ticker HTTP ${r.status}`);
  const json = await r.json();
  const res  = json?.chart?.result?.[0];
  if (!res) throw new Error("Yahoo ticker: no data");

  const meta = res.meta;
  return {
    price:     meta.regularMarketPrice,
    change:    ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100),
    high24h:   meta.regularMarketDayHigh,
    low24h:    meta.regularMarketDayLow,
    volume24h: meta.regularMarketVolume,
    currency:  meta.currency,
  };
}

/* ─────────────────────────────────────────────────────────
   API ROUTES
───────────────────────────────────────────────────────── */

// GET /api/candles/:symbol?interval=1d
app.get("/api/candles/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const interval   = req.query.interval || "1d";
  try {
    const { type, binanceSymbol, yahooSymbol } = getSymbolType(symbol);
    let candles;
    if (type === "binance") {
      candles = await fetchBinanceCandles(binanceSymbol, interval);
    } else {
      candles = await fetchYahooCandles(yahooSymbol, interval);
    }
    res.json({ ok: true, candles, source: type });
  } catch (e) {
    console.error(`[candles] ${symbol}:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/ticker/:symbol
app.get("/api/ticker/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const { type, binanceSymbol, yahooSymbol } = getSymbolType(symbol);
    let ticker;
    if (type === "binance") {
      ticker = await fetchBinanceTicker(binanceSymbol);
    } else {
      ticker = await fetchYahooTicker(yahooSymbol);
    }
    res.json({ ok: true, ...ticker, source: type });
  } catch (e) {
    console.error(`[ticker] ${symbol}:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/multi-ticker   — batch quote for sidebar
// ?symbols=BTC,ETH,NVDA,...
app.get("/api/multi-ticker", async (req, res) => {
  const symbols = (req.query.symbols || "").split(",").filter(Boolean).slice(0, 20);
  const results = {};
  await Promise.allSettled(
    symbols.map(async sym => {
      try {
        const { type, binanceSymbol, yahooSymbol } = getSymbolType(sym);
        if (type === "binance") {
          results[sym] = await fetchBinanceTicker(binanceSymbol);
        } else {
          results[sym] = await fetchYahooTicker(yahooSymbol);
        }
      } catch(e) {
        results[sym] = { error: e.message };
      }
    })
  );
  res.json({ ok: true, results });
});

// POST /api/ai-analyze  — proxy to Anthropic
app.post("/api/ai-analyze", async (req, res) => {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ ok:false, error:"ANTHROPIC_API_KEY not set" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-api-key":     ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch(e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Fallback → serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Nexus Terminal running on http://localhost:${PORT}`));
