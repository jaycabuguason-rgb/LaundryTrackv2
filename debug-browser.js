const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', exception => {
    console.log(`Uncaught exception: "${exception}"`);
    console.log(exception.stack);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console error: "${msg.text()}"`);
    }
  });

  try {
    await page.goto('http://localhost:3001');
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Error navigating:', err);
  } finally {
    await browser.close();
  }
})();
