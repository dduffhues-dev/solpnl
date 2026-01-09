const express = require('express');
const { fetchTopTraders } = require('./scraper');

const app = express();
const port = process.env.PORT || 8000;

// Simple in-memory cache
let cache = {
    data: null,
    lastUpdated: null
};
const CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

app.get('/top-traders', async (req, res) => {
    const refresh = req.query.refresh === 'true';
    const now = Date.now();

    if (refresh || !cache.data || (cache.lastUpdated && now - cache.lastUpdated > CACHE_EXPIRATION_MS)) {
        console.log('Fetching fresh data from GMGN...');
        try {
            const data = await fetchTopTraders();
            
            if (data.error) {
                if (cache.data) {
                    console.log('Error fetching fresh data, serving stale cache.');
                    return res.json({
                        status: 'stale_data_error',
                        error: data.error,
                        last_updated: new Date(cache.lastUpdated).toISOString(),
                        traders: cache.data
                    });
                }
                return res.status(500).json({ error: data.error });
            }

            const traders = (data.data?.rank || []).map((item, index) => ({
                rank: index + 1,
                name: item.name || item.twitter_name || 'Unknown',
                address: item.address,
                sol_balance: item.sol_balance,
                pnl_1d_percent: item.pnl_1d,
                pnl_1d_usd: item.realized_profit_1d,
                winrate_1d: item.winrate_1d,
                buy_1d: item.buy_1d,
                sell_1d: item.sell_1d,
                volume_1d: item.volume_1d,
                follow_count: item.follow_count,
                twitter: item.twitter_username ? `https://x.com/${item.twitter_username}` : null,
                tags: item.tags || []
            }));

            cache.data = traders;
            cache.lastUpdated = now;
        } catch (error) {
            if (cache.data) {
                console.log('Exception fetching fresh data, serving stale cache.');
                return res.json({
                    status: 'stale_data_exception',
                    error: error.message,
                    last_updated: new Date(cache.lastUpdated).toISOString(),
                    traders: cache.data
                });
            }
            return res.status(500).json({ error: error.message });
        }
    }

    res.json({
        status: 'success',
        last_updated: new Date(cache.lastUpdated).toISOString(),
        count: cache.data.length,
        traders: cache.data
    });
});

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to GMGN Top Traders API. Use /top-traders to get data.' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`Note: On AWS, use your Public IP and ensure port ${port} is open in Security Groups.`);
});



