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
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ] 
        });
        console.log('Browser launched successfully!');
    } catch (launchError) {
        console.error('CRITICAL: Browser failed to launch:', launchError.message);
        return { error: `Browser launch failed: ${launchError.message}` };
    }

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
        });
        
        const page = await context.newPage();

        console.log('Navigating to GMGN.AI...');
        // Increased timeout and changed waitUntil for better stability
        await page.goto('https://gmgn.ai/trade?chain=sol&tab=renowned', {
            waitUntil: 'load', 
            timeout: 90000
        });

        // Small human-like delay
        await new Promise(r => setTimeout(r, 5000));

        // Check for Cloudflare/Bot detection
        const content = await page.content();
        if (content.includes('Verify you are human') || content.includes('Cloudflare')) {
            console.log('Bot detected by Cloudflare! Saving debug screenshot...');
            await page.screenshot({ path: 'debug_error.png' });
            return { error: 'Blocked by Cloudflare bot protection.' };
        }

        console.log('Page loaded. Waiting for table...');
        await page.waitForSelector('table', { timeout: 45000 });
        
        console.log('Fetching data via session-authenticated evaluate...');
        // Use a cleaner API URL - removing some of the hardcoded tracking IDs that might trigger flags
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

        if (!data || data.error) {
            console.log('API fetch failed, attempting to scrape table directly as backup...');
            // Add backup scraping logic here if needed
        }

        return data;
    } catch (error) {
        console.error('Error during scraping:', error);
        // Take a screenshot of the failure
        try {
            const page = (await browser.pages())[0];
            if (page) await page.screenshot({ path: 'error_screenshot.png' });
        } catch (e) {}
        return { error: error.message };
    } finally {
        await browser.close();
    }
}
    } catch (error) {
        console.error('Error during scraping:', error);
        return { error: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = { fetchTopTraders };



