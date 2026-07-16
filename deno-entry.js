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

// KV 适配器：用 Deno KV 替代 Cloudflare KV
let _kv = null;
try {
	_kv = await Deno.openKv();
} catch (_) {}

if (_kv) {
	env.KV = {
		async get(key) {
			const result = await _kv.get(key);
			return result.value;
		},
		async put(key, value) {
			await _kv.set(key, value);
		},
		async delete(key) {
			await _kv.delete(key);
		},
		async list({ prefix } = {}) {
			const entries = [];
			for await (const entry of _kv.list({ prefix })) {
				entries.push(entry);
			}
			return entries;
		},
	};
}

const ctx = {
	waitUntil(promise) {
		Promise.resolve(promise).catch((err) => console.error('[waitUntil error]', err));
	},
};

Deno.serve(async (request) => {
	try {
		Object.defineProperty(request, 'cf', {
			value: {
				colo: 'hkg',
				asn: 0,
				asOrganization: 'Deno Deploy',
				country: 'HK',
				city: 'Hong Kong',
				continent: 'AS',
				latitude: '22.30',
				longitude: '114.20',
				timezone: 'Asia/Hong_Kong',
			},
			writable: true,
			configurable: true,
			enumerable: true,
		});
	} catch (_) {}

	return worker.fetch(request, env, ctx);
});