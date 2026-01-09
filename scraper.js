const { chromium } = require('playwright-chromium');

async function fetchTopTraders() {
    console.log('Attempting to launch browser...');
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        console.log('Browser launched successfully!');
    } catch (launchError) {
        console.error('CRITICAL: Browser failed to launch:', launchError.message);
        return { error: `Browser launch failed: ${launchError.message}` };
    }
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        console.log('Navigating to GMGN.AI (this can take 10-20 seconds on AWS)...');
        await page.goto('https://gmgn.ai/trade?chain=sol&tab=renowned', {
            waitUntil: 'networkidle', // Wait for network to be quiet
            timeout: 90000
        });

        console.log('Page reached. Waiting for data table...');
        await page.waitForSelector('table', { timeout: 45000 });
        
        // Wait a bit for session establishment
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Fetching data from API via evaluate...');
        const apiUrl = "https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/1d?tag=renowned&device_id=bfd67d47-9b5f-4880-af3f-b045f74f9f06&fp_did=4b6c8f31a3b0edb9a8d9ce8c2ef2da69&client_id=gmgn_web_20260107-9619-f09ff1f&from_app=gmgn&app_ver=20260107-9619-f09ff1f&tz_name=Europe%2FBerlin&tz_offset=3600&app_lang=en-US&os=web&worker=0&orderby=pnl_1d&direction=desc";

        const data = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url);
                return await response.json();
            } catch (e) {
                return { error: e.message };
            }
        }, apiUrl);

        return data;
    } catch (error) {
        console.error('Error during scraping:', error);
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = { fetchTopTraders };



