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
                '--disable-gpu',
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
            viewport: { width: 1440, height: 900 },
        });
        
        const page = await context.newPage();
        console.log('Navigating to GMGN.AI...');
        
        await page.goto('https://gmgn.ai/trade?chain=sol&tab=renowned', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('Waiting for table to render...');
        await page.waitForSelector('table tbody tr', { timeout: 45000 });

        // Human-like scroll to trigger lazy loading if needed
        await page.mouse.wheel(0, 500);
        await new Promise(r => setTimeout(r, 2000));

        console.log('Scraping table data directly from DOM...');
        const traders = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            return rows.map((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 5) return null;

                // Extracting name and address from the first few cells
                // Note: The exact selectors might need adjustment based on GMGN's class names
                const nameElement = row.querySelector('a[href*="/address/"]');
                const address = nameElement ? nameElement.getAttribute('href').split('/').pop() : 'Unknown';
                const name = nameElement ? nameElement.innerText.trim() : 'Unknown';
                
                // Get PNL and Winrate (usually in specific columns)
                // This is a simplified extraction; GMGN table structure is complex
                const pnlText = cells[3] ? cells[3].innerText.trim() : '0';
                const winrateText = cells[5] ? cells[5].innerText.trim() : '0';

                return {
                    rank: index + 1,
                    name: name,
                    address: address,
                    pnl_1d_percent: pnlText,
                    winrate_1d: winrateText,
                    // Fill other fields with placeholders or extracted data
                    sol_balance: cells[2] ? cells[2].innerText.trim() : '0',
                };
            }).filter(t => t !== null);
        });

        // If DOM scraping fails or returns little data, try the API method one last time with correct headers
        if (traders.length === 0) {
            console.log('DOM scraping returned 0 rows. Attempting API fallback...');
            const apiUrl = "https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/1d?tag=renowned&orderby=pnl_1d&direction=desc";
            const apiData = await page.evaluate(async (url) => {
                const response = await fetch(url);
                return await response.json();
            }, apiUrl);
            return apiData;
        }

        console.log(`Success! Scraped ${traders.length} traders from the table.`);
        return { data: { rank: traders } };

    } catch (error) {
        console.error('Error during scraping:', error.message);
        return { error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { fetchTopTraders };
