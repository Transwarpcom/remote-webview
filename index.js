const http = require('http');
const url = require('url');
const { webkit, devices } = require('playwright');
const https = require('https')

process.on('uncaughtException', err => {
    console.log(err);
    console.log(err.stack);
});

let renderingCount = 0;
let renderedCount = 0;

async function post(uri, headers, body, encode) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(uri);
        let httpModule = http;
        if (parsedUrl.protocol === 'https:') {
            httpModule = https;
        }
        let isJson = false;
        try {
            JSON.parse(body);
            isJson = true;
        } catch (error) {

        }
        const req = httpModule.request(uri, {
            method: "POST",
            headers: {
                ...headers,
                'Content-Type': isJson ? "application/json; charset=UTF-8" : "application/x-www-form-urlencoded; charset=UTF-8",
                'Content-Length': body.length
            }
        }, res => {
            let list = [];
            res.on('data', chunk => {
                list.push(chunk);
            });
            res.on('end', () => {
                const data = Buffer.concat(list).toString(encode || 'utf-8');
                resolve(data);
            });
        }).on('error', err => {
            reject(err);
        });
        req.write(body);
        req.end();
    });
}

async function renderHtml({
    url,
    html,
    headers,
    js_source,
    proxy,
    http_method,
    body,
    encode,
    tag,
    sourceRegex
}) {
    if (http_method === "POST") {
        html = await post(url, headers, body, encode);
    }
    const launchOptions = {
        headless: true,
        baseURL: url
    };
    if (proxy) {
        // socks5://127.0.0.1:1080@用户名@密码
        const ms = proxy.match(new RegExp("(http|socks4|socks5)://(.*)?:(\\d{2,5})?(@.*@.*)?"))
        if (ms) {
            launchOptions.proxy = {
                server: ms[1] + "://" + ms[2] + ":" + ms[3]
            }
            if (ms[4]) {
                launchOptions.proxy.username = ms[4].split("@")[1]
                launchOptions.proxy.password = ms[4].split("@")[2]
            }
        }
    }
    const browser = await webkit.launch(launchOptions);
    const contextOptions = {
        ...devices['Desktop Safari'],
        acceptDownloads: false,
        baseURL: url,
        bypassCSP: true,
        extraHTTPHeaders: headers,
        ignoreHTTPSErrors: true,
        ...headers && headers['User-Agent'] ? { userAgent: headers['User-Agent'] } : {}
    };
    console.log("contextOptions", contextOptions);
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await page.route('**\/*.{png,jpg,jpeg,mp4,mp3}', route => route.abort());

    return new Promise(async (resolve, reject) => {
        const loadOptions = {
            timeout: 15000,
            waitUntil: 'load',
        };
        if (sourceRegex) {
            page.addListener('response', async (response) => {
                if (response.request().url.match(new RegExp(sourceRegex))) {
                    resolve(await response.text())
                }
            })
            if (html) {
                await page.setContent(html, loadOptions);
            } else {
                await page.goto(url, loadOptions);
            }
            if (js_source) {
                await page.evaluate(js_source);
            }
        } else {
            if (html) {
                await page.setContent(html, loadOptions).catch(reject);
            } else {
                await page.goto(url, loadOptions).catch(reject);
            }
            if (js_source) {
                let count = 0;
                while (count < 30) {
                    let result = await page.evaluate(js_source);
                    if (!result || result === 'null') {
                        count++;
                        await new Promise(r => setTimeout(r, 100));
                        continue;
                    }
                    if (typeof result !== "string") {
                        result = JSON.stringify(result);
                    }
                    resolve(result);
                    return;
                }
                reject("js_source evaluation failed after 30 attempts");
            } else {
                resolve(await page.content())
            }
        }
    }).finally(() => {
        browser.close();
    });
}

const server = http.createServer(async function(req, res) {
    var pathname = url.parse(req.url).pathname;
    if (pathname === '/render.html') {
        let body = '';
        req.on('data', function (chunk) {
            body += chunk;
        });

        req.on('end', async function () {
            body = JSON.parse(body);
            console.log("renderHtml ", body);
            renderingCount++;
            const result = await renderHtml(body).catch(err => {
                return err.toString();
            });
            renderingCount--;
            renderedCount++;
            // console.log("renderHtml result ", result);
            res.end(result);
        });
    } else if (pathname === '/health') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
        res.end(JSON.stringify({
            renderingCount: renderingCount,
            renderedCount: renderedCount,
        }));
    }
});

server.listen(8050);
console.log("Server listening on http://0.0.0.0:8050");