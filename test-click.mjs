import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/consultation/6ac1d4e0e86941aa1fb771e8', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded');
  const html = await page.content();
  fs.writeFileSync('scratch/page-html.txt', html);
  
  await browser.close();
})();
