/**
 * Public Whop checkout pixel (CINEM Tech business). Not a secret.
 * Loaded in the document head so Whop can detect it on app.cinem.tech.
 *
 * Snippet matches Whop's published head pixel
 * (https://docs.whop.com/developer/guides/pixel) with our existing business id.
 * The previous copy dropped one `)` on `scope().track`, which threw
 * `SyntaxError: missing ) after argument list` on every page load.
 */

export const WHOP_PIXEL_SCOPE = "biz_VrtL8S4duREQg4";
export const WHOP_PIXEL_ORIGIN = "https://t.whop.tw";

/** Exact Whop head snippet: loader IIFE + setScope + page track. */
export const WHOP_PIXEL_SNIPPET =
  '!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_VrtL8S4duREQg4");whop.track("page");';

/** Count `(` / `)` so a truncated paste cannot ship again. */
export function whopPixelParensBalanced(source = WHOP_PIXEL_SNIPPET) {
  let depth = 0;
  for (const ch of source) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Throws SyntaxError if the snippet cannot parse. */
export function assertWhopPixelParses(source = WHOP_PIXEL_SNIPPET) {
  Function.prototype.constructor(source);
}
