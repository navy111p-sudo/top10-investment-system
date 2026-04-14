// Top 10 US Market Cap Investment System - Real-time Version
// Uses Yahoo Finance API for live stock data

const CANDIDATE_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA',
  'AVGO', 'BRK-B', 'LLY', 'WMT', 'JPM', 'V', 'MA', 'UNH', 'XOM',
  'ORCL', 'HD', 'PG', 'JNJ', 'COST', 'ABBV', 'BAC', 'NFLX', 'KO',
  'CRM', 'CVX', 'AMD', 'TSM'
];

// Metadata fallbacks (sector, PER estimates, debt ratio) — used when API doesn't supply
const META = {
  AAPL:  { name: 'Apple Inc.',              sector: '기술',     debtRatio: 134.0 },
  MSFT:  { name: 'Microsoft Corp.',         sector: '기술',     debtRatio: 32.0 },
  NVDA:  { name: 'NVIDIA Corp.',            sector: '반도체',   debtRatio: 22.5 },
  AMZN:  { name: 'Amazon.com Inc.',         sector: '소비재',   debtRatio: 58.0 },
  GOOGL: { name: 'Alphabet Inc. (A)',       sector: '기술',     debtRatio: 11.0 },
  GOOG:  { name: 'Alphabet Inc. (C)',       sector: '기술',     debtRatio: 11.0 },
  META:  { name: 'Meta Platforms',          sector: '기술',     debtRatio: 29.0 },
  TSLA:  { name: 'Tesla Inc.',              sector: '자동차',   debtRatio: 17.0 },
  AVGO:  { name: 'Broadcom Inc.',           sector: '반도체',   debtRatio: 105.0 },
  'BRK-B': { name: 'Berkshire Hathaway',    sector: '금융',     debtRatio: 24.0 },
  LLY:   { name: 'Eli Lilly',               sector: '제약',     debtRatio: 228.0 },
  WMT:   { name: 'Walmart Inc.',            sector: '소비재',   debtRatio: 52.0 },
  JPM:   { name: 'JPMorgan Chase',          sector: '금융',     debtRatio: 130.0 },
  V:     { name: 'Visa Inc.',               sector: '금융',     debtRatio: 45.0 },
  MA:    { name: 'Mastercard Inc.',         sector: '금융',     debtRatio: 280.0 },
  UNH:   { name: 'UnitedHealth Group',      sector: '헬스케어', debtRatio: 78.0 },
  XOM:   { name: 'Exxon Mobil',             sector: '에너지',   debtRatio: 21.0 },
  ORCL:  { name: 'Oracle Corp.',            sector: '기술',     debtRatio: 490.0 },
  HD:    { name: 'Home Depot',              sector: '소비재',   debtRatio: 1200.0 },
  PG:    { name: 'Procter & Gamble',        sector: '소비재',   debtRatio: 70.0 },
};

async function fetchQuote(symbol) {
  // Use Yahoo Finance chart endpoint (works without auth)
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
    const currency = meta.currency || 'USD';
    if (typeof price !== 'number') return null;
    return {
      symbol,
      price,
      previousClose: prev,
      change: (typeof prev === 'number') ? (price - prev) : 0,
      changePct: (typeof prev === 'number' && prev > 0) ? ((price - prev) / prev * 100) : 0,
      currency,
      shares: meta.sharesOutstanding || null,
      marketCap: (meta.sharesOutstanding && price) ? (meta.sharesOutstanding * price) : null,
    };
  } catch (e) {
    return null;
  }
}

async function fetchQuoteSummary(symbol) {
  // Fetch marketCap and other fundamentals from quoteSummary
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail,defaultKeyStatistics`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;
    return {
      marketCap: r.price?.marketCap?.raw ?? null,
      per: r.summaryDetail?.trailingPE?.raw ?? null,
      forwardPER: r.summaryDetail?.forwardPE?.raw ?? null,
      dividendYield: r.summaryDetail?.dividendYield?.raw ?? null,
    };
  } catch (e) {
    return null;
  }
}

async function getTop10() {
  // Fetch all candidates in parallel
  const results = await Promise.all(
    CANDIDATE_TICKERS.map(async (t) => {
      const [q, s] = await Promise.all([fetchQuote(t), fetchQuoteSummary(t)]);
      if (!q) return null;
      const mcap = s?.marketCap ?? q.marketCap;
      if (!mcap) return null;
      const m = META[t] || { name: t, sector: '기타', debtRatio: 0 };
      return {
        ticker: t,
        name: m.name,
        sector: m.sector,
        price: q.price,
        priceChange: q.change,
        changePct: q.changePct,
        previousClose: q.previousClose,
        marketCap: mcap / 1e12, // trillion USD
        marketCapRaw: mcap,
        per: s?.per ?? null,
        forwardPER: s?.forwardPER ?? null,
        dividendYield: s?.dividendYield ?? null,
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

    // API endpoint: real-time quotes
    if (url.pathname === '/api/quotes') {
      const top10 = await getTop10();
      return new Response(JSON.stringify({
        asOf: new Date().toISOString(),
        data: top10,
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Fallback to static assets (index.html, etc.)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  }
};
