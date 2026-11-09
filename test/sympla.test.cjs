const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const { Sympla } = require('../dist/nodes/Sympla/Sympla.node');
const { SymplaApi } = require('../dist/credentials/SymplaApi.credentials');
const { buildRequest } = require('../dist/nodes/Sympla/api/buildRequest');
const { performRequest, SymplaApiError } = require('../dist/nodes/Sympla/api/transport');
const { operations } = require('../dist/nodes/Sympla/spec/operations');

const BASE = 'https://api.sympla.com.br/public';

function callWith(pages) {
	const seen = [];
	return {
		seen,
		async call(options) {
			seen.push({ url: options.url, qs: options.qs, method: options.method, body: options.body });
			const page = pages.shift();
			if (!page) throw new Error('sem página');
			return page;
		},
	};
}

describe('contrato da API pública', () => {
	it('lista eventos na 1.6.0 com os query obrigatórios e o header documentado', () => {
		const request = buildRequest('event', 'getMany', { apiVersion: '1.6.0', published: 'all', returnAll: false });
		assert.equal(request.path, '/v1.6.0/events');
		assert.equal(request.query.published, 'all');
		assert.equal(request.query.timezone, 'America/Sao_Paulo');
		assert.equal(request.query.sort, 'asc');
		assert.equal(request.query.field_sort, 'start_date');
		assert.equal(request.query.page_size, 100);
		assert.equal(request.query.cursor, undefined);
		assert.equal(request.retry, 'read');
		const credential = new SymplaApi();
		assert.equal(credential.authenticate.properties.headers.s_token, '={{$credentials.token}}');
		assert.equal(credential.test.request.url, '/v1.6.0/events');
	});

	it('não envia ticket_number na versão 1.6.0 e envia na 1.5.1', () => {
		const current = buildRequest('participant', 'getMany', {
			apiVersion: '1.6.0',
			eventId: 'evt',
			ticketNumberFilter: 'ABC',
		});
		assert.equal(current.query.ticket_number, undefined);
		assert.equal(current.query.cursor, undefined);
		const legacy = buildRequest('participant', 'getMany', {
			apiVersion: '1.5.1',
			eventId: 'evt',
			ticketNumberFilter: 'ABC',
			returnAll: false,
			page: 2,
		});
		assert.equal(legacy.path, '/v1.5.1/events/evt/participants');
		assert.equal(legacy.query.ticket_number, 'ABC');
		assert.equal(legacy.query.page, 2);
		assert.equal(legacy.pagination, 'page');
		assert.equal(legacy.limit, 50);
	});

	it('exige fields na lista de participantes do pedido e monta o QR sem JSON livre', () => {
		assert.throws(
			() => buildRequest('participant', 'getManyByOrder', { apiVersion: '1.6.0', eventId: 'evt', orderId: 'ord' }),
			/fields/,
		);
		const qr = buildRequest('participant', 'checkInByQrCode', {
			apiVersion: '1.6.0',
			eventId: 'evt',
			qrItemId: 'item',
			qrSignature: 'a'.repeat(130),
			qrTimestamp: '1700000000',
			qrVersion: '1',
			qrWalletId: 'wallet',
		});
		assert.equal(qr.method, 'POST');
		assert.equal(qr.retry, 'write');
		assert.deepEqual(qr.body, {
			itemId: 'item',
			signature: 'a'.repeat(130),
			timestamp: 1700000000,
			version: 1,
			walletId: 'wallet',
		});
		assert.throws(
			() => buildRequest('participant', 'checkInByQrCode', { apiVersion: '1.5.0', eventId: 'evt' }),
			/não existe na versão 1\.5\.0/,
		);
	});

	it('segue o cursor e falha no teto sem devolver a lista parcial', async () => {
		const transport = callWith([
			{ statusCode: 200, headers: {}, body: { data: [{ id: '1' }], pagination: { next_cursor: 'c2', page_size: 1, quantity: 1 } } },
			{ statusCode: 200, headers: {}, body: { data: [{ id: '2' }], pagination: { next_cursor: 'c3', page_size: 1, quantity: 1 } } },
		]);
		await assert.rejects(
			() =>
				performRequest({
					call: transport.call,
					sleep: async () => {},
					baseUrl: BASE,
					request: buildRequest('event', 'getMany', { apiVersion: '1.6.0', returnAll: true, maxPages: 1, pageSize: 1 }),
				}),
			(error) => error instanceof SymplaApiError && /passou de 1 páginas/.test(error.message),
		);
		assert.equal(transport.seen.length, 1);
	});

	it('não repete check-in', async () => {
		let attempts = 0;
		await assert.rejects(
			() =>
				performRequest({
					call: async () => {
						attempts += 1;
						return { statusCode: 502, headers: {}, body: { title: 'upstream' } };
					},
					sleep: async () => {},
					baseUrl: BASE,
					request: buildRequest('participant', 'checkIn', {
						apiVersion: '1.6.0',
						eventId: 'evt',
						participantId: 'p1',
					}),
				}),
			/não foi repetida/,
		);
		assert.equal(attempts, 1);
	});

	it('pagina a versão 1.5 por página e para quando has_next é falso', async () => {
		const transport = callWith([
			{ statusCode: 200, headers: {}, body: { data: [{ id: '1' }], pagination: { has_next: true, page: 1 } } },
			{ statusCode: 200, headers: {}, body: { data: [{ id: '2' }], pagination: { has_next: false, page: 2 } } },
		]);
		const result = await performRequest({
			call: transport.call,
			sleep: async () => {},
			baseUrl: BASE,
			request: buildRequest('event', 'getMany', { apiVersion: '1.5.0', returnAll: true, pageSize: 10 }),
		});
		assert.deepEqual(result.items.map((item) => item.id), ['1', '2']);
		assert.equal(transport.seen[0].qs.page, 1);
		assert.equal(transport.seen[1].qs.page, 2);
		assert.equal(transport.seen[0].qs.cursor, undefined);
	});
});

describe('node e exemplos', () => {
	it('não tem campo JSON e cobre as 15 operações documentadas', () => {
		const node = new Sympla();
		assert.equal(node.description.credentials[0].name, 'symplaApi');
		assert.match(node.description.usableAsTool.replacements.description, /Prefer read operations/);
		const types = [];
		const walk = (items) => {
			for (const item of items ?? []) {
				types.push(item.type);
				if (item.type === 'json') assert.fail(item.name);
				walk(item.options);
				if (item.type === 'collection' || item.type === 'fixedCollection') {
					for (const option of item.options ?? []) walk(option.values);
				}
			}
		};
		walk(node.description.properties);
		assert.equal(types.includes('json'), false);
		assert.equal(operations.length, 15);
		const coverage = fs.readFileSync(path.join(__dirname, '../docs/COBERTURA.md'), 'utf8');
		for (const operation of operations) {
			assert.equal(coverage.includes(operation.path), true, operation.path);
		}
		const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
		assert.equal(pkg.n8n.strict, true);
		assert.equal(pkg.engines.node, '>=24.0.0');
	});

	it('mantém os workflows sem token', () => {
		const dir = path.join(__dirname, '../workflows');
		for (const file of fs.readdirSync(dir)) {
			const workflow = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
			assert.equal(/s_token|Bearer |password/i.test(JSON.stringify(workflow)), false, file);
			assert.ok(
				workflow.nodes.some((node) =>
					['n8n-nodes-sympla.sympla', 'n8n-nodes-sympla.symplaTrigger'].includes(node.type),
				),
				file,
			);
		}
	});
});
