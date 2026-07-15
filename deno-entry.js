// Deno Deploy 入口包装器
// 将 Cloudflare Workers 版 edgetunnel 适配到 Deno Deploy 运行时
// 用法：deno run --allow-net --allow-env --allow-read deno-entry.js

import worker from './_worker.js';
import { createHash } from 'node:crypto';

// Polyfill: Deno 不支持 crypto.subtle.digest('MD5', ...)，用 node:crypto 替代
const origDigest = crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest = async (algorithm, data) => {
	const algName = typeof algorithm === 'string' ? algorithm : algorithm?.name;
	if (algName?.toUpperCase() === 'MD5') {
		const hash = createHash('md5').update(new Uint8Array(data)).digest();
		return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
	}
	return origDigest(algorithm, data);
};

const env = Deno.env.toObject();

const ctx = {
	waitUntil(promise) {
		Promise.resolve(promise).catch((err) => console.error('[waitUntil error]', err));
	},
};

Deno.serve(async (request) => {
	try {
		Object.defineProperty(request, 'cf', {
			value: { colo: 'hkg' },
			writable: true,
			configurable: true,
			enumerable: true,
		});
	} catch (_) {}

	return worker.fetch(request, env, ctx);
});