import puppeteer from "puppeteer";
import * as fs from "fs";

class Screenshot {

    constructor() {
        const screenshotsDir = './screenshots';
        try {
            fs.accessSync(screenshotsDir, fs.constants.F_OK);
        } catch (err) {
            fs.mkdirSync(screenshotsDir);
        }
    }

    public getConfig = (isDev: boolean) => {
        if (isDev) {
            return {
                headless: true
            }
        } else {
            return {
                executablePath: '/usr/bin/chromium',
                args: [
                    '--no-sandbox'
                ]
            }
        }
    }

    public async takeScreenshotFor1Day(cityName: string, cityId: number, isDev: boolean): Promise<boolean> {
        let result = false
        const browser = await puppeteer.launch(this.getConfig(isDev))
        try {
            const targetClass = ".widget.now"
            const page = await browser.newPage();
            await page.goto(`https://www.gismeteo.com/weather-${cityName}-${cityId}/now/`);
            await page.setViewport({width: 1080, height: 1024});
            await page.waitForSelector('.fc-button.fc-cta-consent.fc-primary-button');
            await page.click('.fc-button.fc-cta-consent.fc-primary-button');
            const column1El = await page.$(targetClass);
            if (column1El) {
                result = true
                const element = await page.$(targetClass);
                await element!.screenshot({
                    'path': `screenshots/1-${cityId}.png`,
                });
            }
        } catch (e) {
            console.log(e)
        }
        await browser.close()
        return result
    }

    public async takeScreenshotFor3Days(cityName: string, cityId: number, isDev: boolean): Promise<boolean> {
        const targetClass = ".widget-body"
        let result = false
        const browser = await puppeteer.launch(this.getConfig(isDev))
        try {
            const page = await browser.newPage();
            await page.goto(`https://www.gismeteo.com/weather-${cityName}-${cityId}/3-days`);
            await page.waitForSelector('.fc-button.fc-cta-consent.fc-primary-button');
            await page.click('.fc-button.fc-cta-consent.fc-primary-button');
            await page.setViewport({width: 1080, height: 1024});
            await page.waitForSelector(targetClass);
            const column1El = await page.$(targetClass);
            if (column1El) {
                result = true
                await column1El.screenshot({
                    'path': `screenshots/3-${cityId}.png`,
                });
            }
        } catch (e) {
            console.log(e)
        }
        await browser.close()
        return result
    }

    public async takeScreenshotFor10Days(cityName: string, cityId: number, isDev: boolean): Promise<boolean> {
        let result = false
        const browser = await puppeteer.launch(this.getConfig(isDev))
        const page = await browser.newPage();
        try {
            await page.goto(`https://www.gismeteo.com/weather-${cityName}-${cityId}/10-days/`);
            await page.setViewport({width: 1080, height: 1024});
            await page.waitForSelector('.widget-body');
            await page.waitForSelector('.fc-button.fc-cta-consent.fc-primary-button');
            await page.click('.fc-button.fc-cta-consent.fc-primary-button');
            const column1El = await page.$('.widget-body');
            if (column1El) {
                result = true
                const element = await page.$('.widget-body');
                await element!.screenshot({
                    'path': `screenshots/10-${cityId}.png`,
                });
            }
        } catch (e) {
            console.log(e)
        }
        await browser.close()
        return result
    }

}

const screenshot = new Screenshot()
export default screenshot
