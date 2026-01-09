const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function fetchTopTraders() {
    console.log('Attempting to launch browser with stealth...');
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', // Critical for AWS/Docker
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-blink-features=AutomationControlled'
            ] 
        });
        console.log('Browser launched successfully!');
    } catch (launchError) {
        console.error('CRITICAL: Browser failed to launch:', launchError.message);
        return { error: `Browser launch failed: ${launchError.message}` };
    }

    try {
        console.log('Creating browser context...');
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 }, // Smaller viewport uses less RAM
            deviceScaleFactor: 1,
        });
        
        console.log('Opening new page...');
        const page = await context.newPage();

        // Reduce timeouts for AWS so we don't wait forever
        page.setDefaultTimeout(60000);

        console.log('Navigating to GMGN.AI...');
        await page.goto('https://gmgn.ai/trade?chain=sol&tab=renowned', {
            waitUntil: 'domcontentloaded', // Faster than 'load'
            timeout: 60000
        });

        console.log('Checking for Cloudflare...');
        const content = await page.content();
        if (content.includes('Verify you are human') || content.includes('Cloudflare')) {
            console.log('Bot detected by Cloudflare! Saving debug screenshot...');
            await page.screenshot({ path: 'debug_error.png' });
            return { error: 'Blocked by Cloudflare bot protection.' };
        }

        console.log('Waiting for data table to appear...');
        // Wait for either the table or a known data element
        await page.waitForSelector('table', { timeout: 30000 });
        
        console.log('Fetching data via API evaluate...');
        const apiUrl = "https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/1d?tag=renowned&orderby=pnl_1d&direction=desc";

        const data = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url, {
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'accept-language': 'en-US,en;q=0.9',
                    }
                });
                return await response.json();
            } catch (e) {
                return { error: e.message };
            }
        }, apiUrl);

        if (!data || data.error || (data.data && data.data.rank && data.data.rank.length === 0)) {
            console.log('API returned no data. Possible detection or empty result.');
            await page.screenshot({ path: 'no_data_debug.png' });
        } else {
            console.log(`Success! Found ${data.data?.rank?.length || 0} traders.`);
        }

        return data;
    } catch (error) {
        console.error('Error during scraping process:', error.message);
        try {
            const pages = await browser.pages();
            if (pages.length > 0) {
                await pages[0].screenshot({ path: 'error_screenshot.png' });
                console.log('Error screenshot saved as error_screenshot.png');
            }
        } catch (e) {
            console.error('Could not take error screenshot:', e.message);
        }
        return { error: error.message };
    } finally {
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    }
}

module.exports = { fetchTopTraders };
