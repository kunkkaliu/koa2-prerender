/**
 * @module  koa2-prerender
 *
 * @author  kunkkaliu
 * @date  2018/4/11
 */
const url = require('url');
const rp = require('request-promise-native');
const crawlerUserAgents = [
    'baiduspider',
    'facebookexternalhit',
    'twitterbot',
    'rogerbot',
    'linkedinbot',
    'embedly',
    'quora link preview',
    'showyoubot',
    'outbrain',
    'pinterest',
    'developers.google.com/+/web/snippet'
];
const extensionsToIgnore = [
    '.js',
    '.css',
    '.xml',
    '.less',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.pdf',
    '.doc',
    '.txt',
    '.ico',
    '.rss',
    '.zip',
    '.mp3',
    '.rar',
    '.exe',
    '.wmv',
    '.doc',
    '.avi',
    '.ppt',
    '.mpg',
    '.mpeg',
    '.tif',
    '.wav',
    '.mov',
    '.psd',
    '.ai',
    '.xls',
    '.mp4',
    '.m4a',
    '.swf',
    '.dat',
    '.dmg',
    '.iso',
    '.flv',
    '.m4v',
    '.torrent'
];

const DEFAULT_PRERENDER = 'http://service.prerender.io/';

/**
 * Should pre-render?
 *
 * @method  ShouldPreRender
 * @params  {Object} options
 * @return  {Boolean}
 *
 */
function shouldPreRender(options) {
    let hasExtensionToIgnore = extensionsToIgnore.some((extension) => {
        return options.url.indexOf(extension) !== -1;
    });

    let isBot = crawlerUserAgents.some((crawlerUserAgent) => {
        return options.userAgent.toLowerCase().indexOf(crawlerUserAgent) !== -1;
    });

    // do not pre-rend when:
    if (!options.userAgent) {
        return false;
    }

    if (options.method !== 'GET') {
        return false;
    }

    if (hasExtensionToIgnore) {
        return false;
    }

    // do pre-render when:
    let query = url.parse(options.url, true).query;
    if (query && Object.prototype.hasOwnProperty.call(query, '_escaped_fragment_')) {
        return true;
    }

    if (options.bufferAgent) {
        return true;
    }

    return isBot;
}

/*
 * Pre-render middleware
 *
 * @method preRenderMiddleware
 * @param {Object} options
 */
module.exports = function preRenderMiddleware (options) {
    options = options || {};
    options.prerender = options.prerender || DEFAULT_PRERENDER;

    /*
     * Pre-render
     *
     * @method preRender
     * @param {context, next} ctx, next
     */
    return async function preRender(ctx, next) {
        const protocol = options.protocol || ctx.protocol;
        const host = options.host || ctx.host;
        const headers = {
            'User-Agent': ctx.accept.headers['user-agent']
        };

        const prePreRenderToken = options.prerenderToken || process.env.PRERENDER_TOKEN;

        if(prePreRenderToken) {
            headers['X-Prerender-Token'] = prePreRenderToken;
        }

        const isPreRender = shouldPreRender({
            userAgent: ctx.get('user-agent'),
            bufferAgent: ctx.get('x-bufferbot'),
            method: ctx.method,
            url: ctx.url
        });

        let renderUrl;
        let preRenderUrl;
        let response;

        // Pre-render generate the site and return
        if (isPreRender) {
            renderUrl = protocol + '://' + host + ctx.url;
            preRenderUrl = options.prerender + renderUrl;
            response = await rp({
                url: preRenderUrl,
                headers: headers,
                gzip: true
            });

            await next();
            ctx.body = response || '';
            ctx.set('X-Prerender', 'true');
        } else {
            await next();
            ctx.set('X-Prerender', 'false');
        }
    };
};