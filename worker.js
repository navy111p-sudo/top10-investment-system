// Top 10 US Market Cap Investment System - Real-time Version
// Uses Stooq (primary) + Yahoo Finance (fallback) for live stock data

const CANDIDATE_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA',
  'AVGO', 'BRK-B', 'LLY', 'WMT', 'JPM', 'V', 'MA', 'UNH', 'XOM',
  'ORCL', 'HD', 'PG', 'JNJ', 'COST', 'ABBV', 'BAC', 'NFLX', 'KO',
  'CRM', 'CVX', 'AMD', 'TSM'
];

// Hardcoded shares outstanding (billions) — used to compute market cap from live price.
// These change slowly (buybacks, splits), so acceptable for ranking.
const SHARES_B = {
  AAPL: 15.12,   MSFT: 7.43,    NVDA: 24.55,   AMZN: 10.67,
  GOOGL: 12.12,  GOOG: 12.12,   META: 2.53,    TSLA: 3.22,
  AVGO: 4.69,    'BRK-B': 2.17, LLY: 0.949,    WMT: 8.04,
  JPM: 2.78,     V: 1.88,       MA: 0.925,     UNH: 0.918,
  XOM: 4.35,     ORCL: 2.78,    HD: 0.993,     PG: 2.34,
  JNJ: 2.41,     COST: 0.443,   ABBV: 1.77,    BAC: 7.60,
  NFLX: 0.426,   KO: 4.31,      CRM: 0.961,    CVX: 1.75,
  AMD: 1.62,     TSM: 5.19,
};

const META = {
  AAPL:   { name: 'Apple Inc.',          sector: '기술',     debtRatio: 134.0 },
  MSFT:   { name: 'Microsoft Corp.',     sector: '기술',     debtRatio: 32.0 },
  NVDA:   { name: 'NVIDIA Corp.',        sector: '반도체',   debtRatio: 22.5 },
  AMZN:   { name: 'Amazon.com Inc.',     sector: '소비재',   debtRatio: 58.0 },
  GOOGL:  { name: 'Alphabet Inc. (A)',   sector: '기술',     debtRatio: 11.0 },
  GOOG:   { name: 'Alphabet Inc. (C)',   sector: '기술',     debtRatio: 11.0 },
  META:   { name: 'Meta Platforms',      sector: '기술',     debtRatio: 29.0 },
  TSLA:   { name: 'Tesla Inc.',          sector: '자동차',   debtRatio: 17.0 },
  AVGO:   { name: 'Broadcom Inc.',       sector: '반도체',   debtRatio: 105.0 },
  'BRK-B':{ name: 'Berkshire Hathaway',  sector: '금융',     debtRatio: 24.0 },
  LLY:    { name: 'Eli Lilly',           sector: '제약',     debtRatio: 228.0 },
  WMT:    { name: 'Walmart Inc.',        sector: '소비재',   debtRatio: 52.0 },
  JPM:    { name: 'JPMorgan Chase',      sector: '금융',     debtRatio: 130.0 },
  V:      { name: 'Visa Inc.',           sector: '금융',     debtRatio: 45.0 },
  MA:     { name: 'Mastercard Inc.',     sector: '금융',     debtRatio: 280.0 },
  UNH:    { name: 'UnitedHealth Group',  sector: '헬스케어', debtRatio: 78.0 },
  XOM:    { name: 'Exxon Mobil',         sector: '에너지',   debtRatio: 21.0 },
  ORCL:   { name: 'Oracle Corp.',        sector: '기술',     debtRatio: 490.0 },
  HD:     { name: 'Home Depot',          sector: '소비재',   debtRatio: 1200.0 },
  PG:     { name: 'Procter & Gamble',    sector: '소비재',   debtRatio: 70.0 },
  JNJ:    { name: 'Johnson & Johnson',   sector: '제약',     debtRatio: 45.0 },
  COST:   { name: 'Costco Wholesale',    sector: '소비재',   debtRatio: 40.0 },
  ABBV:   { name: 'AbbVie Inc.',         sector: '제약',     debtRatio: 280.0 },
  BAC:    { name: 'Bank of America',     sector: '금융',     debtRatio: 140.0 },
  NFLX:   { name: 'Netflix Inc.',        sector: '미디어',   debtRatio: 65.0 },
  KO:     { name: 'Coca-Cola Co.',       sector: '소비재',   debtRatio: 185.0 },
  CRM:    { name: 'Salesforce Inc.',     sector: '기술',     debtRatio: 18.0 },
  CVX:    { name: 'Chevron Corp.',       sector: '에너지',   debtRatio: 20.0 },
  AMD:    { name: 'Advanced Micro Dev.', sector: '반도체',   debtRatio: 5.0 },
  TSM:    { name: 'Taiwan Semi.',        sector: '반도체',   debtRatio: 28.0 },
};

// --- Stooq fetcher ---
async function fetchFromStooq(symbol) {
  // Stooq uses .us suffix, BRK-B -> brk-b.us, but stooq may need BRK-B.US
  const s = symbol.toLowerCase().replace('.', '-');
  const url = `https://stooq.com/q/l/?s=${s}.us&f=sd2t2ohlcv&h&e=csv`;
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 30, cacheEverything: true }
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const cols = lines[1].split(',');
    // Symbol,Date,Time,Open,High,Low,Close,Volume
    if (cols.length < 7) return null;
    const close = parseFloat(cols[6]);
    const open  = parseFloat(cols[3]);
    if (!isFinite(close) || close <= 0) return null;
    return {
      price: close,
      open,
      change: close - open,
      changePct: open > 0 ? ((close - open) / open * 100) : 0,
    };
  } catch (e) { return null; }
}

// --- Yahoo fetcher (fallback) ---
async function fetchFromYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 30, cacheEverything: true }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    if (!r) return null;
    const meta = r.meta || {};
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose ?? meta.previousClose;
    if (typeof price !== 'number') return null;
    return {
      price,
      open: prev,
      change: typeof prev === 'number' ? (price - prev) : 0,
      changePct: (typeof prev === 'number' && prev > 0) ? ((price - prev) / prev * 100) : 0,
    };
  } catch (e) { return null; }
}

async function fetchQuote(symbol) {
  // Try Stooq first, fallback to Yahoo
  let q = await fetchFromStooq(symbol);
  if (!q) q = await fetchFromYahoo(symbol);
  return q;
}

async function getTop10() {
  const results = await Promise.all(
    CANDIDATE_TICKERS.map(async (t) => {
      const q = await fetchQuote(t);
      if (!q) return null;
      const shares = SHARES_B[t];
      if (!shares) return null;
      const marketCap = shares * q.price * 1e9; // USD
      const m = META[t] || { name: t, sector: '기타', debtRatio: 0 };
      return {
        ticker: t,
        name: m.name,
        sector: m.sector,
        price: q.price,
        priceChange: q.change,
        changePct: q.changePct,
        marketCap: marketCap / 1e12,
        marketCapRaw: marketCap,
        per: null,
        debtRatio: m.debtRatio,
      };
    })
  );
  const valid = results.filter(Boolean);
  valid.sort((a, b) => b.marketCapRaw - a.marketCapRaw);
  return valid.slice(0, 10);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/quotes') {
      const top10 = await getTop10();
      return new Response(JSON.stringify({
        asOf: new Date().toISOString(),
        source: 'stooq+yahoo',
        data: top10,
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    if (url.pathname === '/api/debug') {
      const sym = url.searchParams.get('s') || 'AAPL';
      const stooq = await fetchFromStooq(sym);
      const yahoo = await fetchFromYahoo(sym);
      return new Response(JSON.stringify({ sym, stooq, yahoo }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  }
};
