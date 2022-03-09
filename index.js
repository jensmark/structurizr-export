#!/usr/bin/env node

const puppeteer = require('puppeteer');
const yargs = require('yargs')
const fs = require('fs');
const path = require('path')


const argv = yargs
    .option('url', {
        alias: 'u',
        description: 'Url to workspace diagrams',
        default: 'http://localhost:8080/workspace',
        type: 'string'
    })
    .option('output', {
        alias: 'o',
        description: 'Output folder',
        default: './diagrams',
        type: 'string'
    })
    .help()
    .alias('help', 'h')
    .wrap(100)
    .locale('en').argv;

const url = argv.url + "/diagrams";
const outputBase = path.normalize(argv.output);

if (!fs.existsSync(outputBase)) {
    console.log(`'${outputBase}' does not exist`)
    process.exit()
}

(async () => {
    const browser = await puppeteer.launch({ ignoreHTTPSErrors: false, headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForFunction('structurizr.scripting.isDiagramRendered() === true');

    await page.exposeFunction('save', (content, filename, contentType='utf8') => {
        console.log("Writing " + filename);
        if (contentType === 'base64') {
            content = content.replace(/^data:image\/png;base64,/, "");
        }
        fs.writeFile(filename, content, contentType, function (err) {
            if (err) throw err;
        });
    });

    const views = await page.evaluate(() => {
        return structurizr.scripting.getViews();
    });

    for ({ key: diagramKey } of views) {
        await page.evaluate((diagramKey) => {
            structurizr.scripting.changeView(diagramKey);
        }, diagramKey);

        await page.waitForFunction('structurizr.scripting.isDiagramRendered() === true');

        const diagramFilenameSvg = path.join(outputBase, diagramKey + '.svg');
        const diagramFilenamePng = path.join(outputBase, diagramKey + '.png');

        await page.evaluate((diagramFilenameSvg) => {
            const svg = structurizr.scripting.exportCurrentDiagramToSVG({ interactive: true });
            window.save(svg, diagramFilenameSvg)
        }, diagramFilenameSvg);

        
        await page.evaluate((diagramFilenamePng) => {
            structurizr.scripting.exportCurrentDiagramToPNG({ crop: false }, function (png) {
                window.save(png, diagramFilenamePng, 'base64');
            })
        }, diagramFilenamePng);
    }

    await browser.close();
})();