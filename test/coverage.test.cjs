const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const { Sympla } = require('../dist/nodes/Sympla/Sympla.node');
const { SymplaTrigger } = require('../dist/nodes/SymplaTrigger/SymplaTrigger.node');
const { buildRequest } = require('../dist/nodes/Sympla/api/buildRequest');
const { performRequest, SymplaApiError } = require('../dist/nodes/Sympla/api/transport');
const { operations } = require('../dist/nodes/Sympla/spec/operations');
const { listSearch } = require('../dist/nodes/Sympla/methods');
const poll = require('../dist/nodes/Sympla/api/poll');

const BASE = 'https://api.sympla.com.br/public';
const VERSIONS = ['1.5.0', '1.5.1', '1.6.0'];
const paths = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/paths.json'), 'utf8'));

function sample(version) {
	return {
		apiVersion: version,
		eventId: 'evt',
		orderId: 'ord',
		participantId: 'part',
		ticketNumber: 'T-1',
		presentationId: '42',
		returnAll: false,
		singlePage: true,
		pageSize: 10,
		fields: ['id'],
		from: '2026-01-01T00:00:00',
		to: '2026-01-02T00:00:00',
		orderStatus: 'approved',
		ticketNumberFilter: 'T-9',
		qrItemId: 'item',
		qrSignature: 'a'.repeat(130),
		qrTimestamp: '1700000000',
		qrVersion: '1',
		qrWalletId: 'wallet',
	};
}

function filled(spec) {
	return spec.path
		.replace('{eventId}', 'evt')
		.replace('{orderId}', 'ord')
		.replace('{participantId}', 'part')
		.replace('{ticketNumber}', 'T-1')
		.replace('{presentationId}', '42');
}

describe('fixtures de todas as operações', () => {
	it('cobre os 44 caminhos do OpenAPI, sem /error e sem webhook', () => {
		const produced = new Set();
		for (const spec of operations) {
			for (const version of spec.versions) produced.add(`/v${version}${spec.path}`);
		}
		assert.deepEqual([...produced].sort(), paths);
		assert.equal(paths.some((item) => item.includes('webhook')), false);
	});

	for (const spec of operations) {
		for (const version of VERSIONS) {
			it(`${spec.resource}.${spec.operation} ${version}`, () => {
				const params = sample(version);
				if (!spec.versions.includes(version)) {
					assert.throws(() => buildRequest(spec.resource, spec.operation, params), /não existe na versão/);
					return;
				}
				const request = buildRequest(spec.resource, spec.operation, params);
				assert.equal(request.method, spec.method);
				assert.equal(request.path, `/v${version}${filled(spec)}`);
				assert.equal(request.retry, spec.write ? 'write' : 'read');
				assert.equal(request.pagination, 'none');
				if (spec.operation === 'getManyByOrder') assert.equal(request.query.fields, 'id');
				if (spec.needs.includes('qr')) {
					assert.equal(request.body.itemId, 'item');
					assert.equal(request.body.signature.length, 130);
					assert.equal(request.body.timestamp, 1700000000);
				} else {
					assert.equal(request.body, undefined);
				}
				if (spec.resource === 'order' && spec.operation === 'get') {
					assert.equal(request.query.status, undefined);
					if (version === '1.6.0') {
						assert.equal(request.query.timezone, undefined);
						assert.equal(request.query.from, undefined);
					} else {
						assert.equal(request.query.timezone, 'America/Sao_Paulo');
						assert.equal(request.query.from, '2026-01-01T00:00:00');
						assert.equal(request.query.to, '2026-01-02T00:00:00');
					}
				}
				if (spec.queries.includes('orderStatus')) {
					assert.equal(request.query.status, version === '1.6.0' ? undefined : 'approved');
				}
				if (spec.queries.includes('ticketNumberFilter')) {
					assert.equal(request.query.ticket_number, version === '1.6.0' ? undefined : 'T-9');
				}
			});
		}
	}
});

describe('paginação e retentativa', () => {
	it('corta no Limit e não busca a página seguinte', async () => {
		const seen = [];
		const result = await performRequest({
			call: async (options) => {
				seen.push(options.url);
				return {
					statusCode: 200,
					headers: {},
					body: { data: [{ id: '1' }, { id: '2' }], pagination: { next_cursor: 'c2' } },
				};
			},
			sleep: async () => {},
			baseUrl: BASE,
			request: buildRequest('event', 'getMany', { apiVersion: '1.6.0', returnAll: false, limit: 1, pageSize: 2 }),
		});
		assert.deepEqual(result.items.map((item) => item.id), ['1']);
		assert.equal(seen.length, 1);
	});

	it('falha no teto do Limit sem devolver a lista parcial', async () => {
		let calls = 0;
		await assert.rejects(
			() =>
				performRequest({
					call: async () => {
						calls += 1;
						return { statusCode: 200, headers: {}, body: { data: [{ id: String(calls) }], pagination: { has_next: true, page: calls } } };
					},
					sleep: async () => {},
					baseUrl: BASE,
					request: buildRequest('event', 'getMany', {
						apiVersion: '1.5.1',
						returnAll: false,
						limit: 5,
						maxPages: 1,
						pageSize: 1,
					}),
				}),
			(error) => error instanceof SymplaApiError && /passou de 1 páginas/.test(error.message),
		);
		assert.equal(calls, 1);
	});

	it('repete leitura em 502 e não repete falha de rede de escrita', async () => {
		let reads = 0;
		const result = await performRequest({
			call: async () => {
				reads += 1;
				if (reads === 1) return { statusCode: 502, headers: {}, body: { title: 'upstream' } };
				return { statusCode: 200, headers: {}, body: { data: { id: 'evt' } } };
			},
			sleep: async () => {},
			baseUrl: BASE,
			request: buildRequest('event', 'get', { apiVersion: '1.6.0', eventId: 'evt' }),
		});
		assert.equal(result.items[0].id, 'evt');
		assert.equal(reads, 2);
		let writes = 0;
		await assert.rejects(
			() =>
				performRequest({
					call: async () => {
						writes += 1;
						throw new Error('socket s_token=secret');
					},
					sleep: async () => {},
					baseUrl: BASE,
					request: buildRequest('participant', 'checkInByTicketNumber', {
						apiVersion: '1.5.0',
						eventId: 'evt',
						ticketNumber: 'T-1',
					}),
				}),
			(error) => error instanceof SymplaApiError && /não foi repetida/.test(error.message) && !/secret/.test(error.message),
		);
		assert.equal(writes, 1);
	});

	it('recusa cursor repetido', async () => {
		const cursors = ['c2', 'c2'];
		await assert.rejects(
			() =>
				performRequest({
					call: async () => ({
						statusCode: 200,
						headers: {},
						body: { data: [{ id: '1' }], pagination: { next_cursor: cursors.shift() } },
					}),
					sleep: async () => {},
					baseUrl: BASE,
					request: buildRequest('order', 'getMany', { apiVersion: '1.6.0', eventId: 'evt', returnAll: true, maxPages: 5 }),
				}),
			/repetiu um cursor/,
		);
	});
});

describe('polling', () => {
	it('monta a página com a ordenação documentada e sem webhook', () => {
		const orders = poll.buildPollPageRequest({
			apiVersion: '1.6.0',
			eventId: 'evt',
			watch: 'orders',
			timezone: 'America/Sao_Paulo',
			pageSize: 20,
		});
		assert.equal(orders.path, '/v1.6.0/events/evt/orders');
		assert.equal(orders.query.field_sort, 'order_date');
		assert.equal(orders.query.sort, 'desc');
		assert.equal(orders.pagination, 'none');
		assert.equal(orders.retry, 'read');
		const people = poll.buildPollPageRequest({
			apiVersion: '1.5.1',
			eventId: 'evt',
			watch: 'participants',
			pageSize: 20,
			page: 2,
		});
		assert.equal(people.query.field_sort, 'ticket_created_at');
		assert.equal(people.query.page, 2);
		const checkins = poll.buildPollPageRequest({
			apiVersion: '1.6.0',
			eventId: 'evt',
			watch: 'checkIns',
			pageSize: 20,
			cursor: 'abc',
		});
		assert.equal(checkins.query.field_sort, 'ticket_updated_at');
		assert.equal(checkins.query.cursor, 'abc');
	});

	it('guarda a marca no primeiro poll ativo e só emite o que chegou depois', async () => {
		const first = await poll.runPoll(
			pollInput([{ data: [{ id: 'a', order_date: '2026-01-01 10:00:00' }], pagination: {} }], poll.emptyMemory(), false),
		);
		assert.deepEqual(first.items, []);
		assert.equal(first.memory.ready, true);
		assert.equal(first.memory.watermark, '2026-01-01 10:00:00');
		const second = await poll.runPoll(
			pollInput(
				[
					{
						data: [
							{ id: 'b', order_date: '2026-01-02 10:00:00' },
							{ id: 'a', order_date: '2026-01-01 10:00:00' },
						],
						pagination: {},
					},
				],
				first.memory,
				false,
			),
		);
		assert.deepEqual(second.items.map((item) => item.id), ['b']);
	});

	it('no teste manual devolve a página e não move a marca', async () => {
		const memory = poll.emptyMemory();
		const result = await poll.runPoll(
			pollInput([{ data: [{ id: 'a', order_date: '2026-01-01 10:00:00' }], pagination: {} }], memory, true),
		);
		assert.equal(result.items[0].id, 'a');
		assert.equal(result.memory.ready, false);
		assert.equal(memory.ready, false);
	});

	it('emite check-in novo e ignora quem não tem check-in', () => {
		const memory = poll.prepareMemory('checkIns', [
			{ id: 'p1', ticket_updated_at: '2026-01-01 10:00:00', checkin: { check_in: true, check_in_id: 4 } },
		]);
		const scanned = poll.scanNew('checkIns', memory, [
			{ id: 'p2', ticket_updated_at: '2026-01-03 10:00:00', checkin: { check_in: true, check_in_id: 5 } },
			{ id: 'p1', ticket_updated_at: '2026-01-01 10:00:00', checkin: { check_in: true, check_in_id: 4 } },
			{ id: 'p3', ticket_updated_at: '2026-01-04 10:00:00', checkin: { check_in: false } },
			{ id: 'p4', ticket_updated_at: '2026-01-04 11:00:00' },
		]);
		assert.deepEqual(scanned.emit.map((item) => item.id), ['p2']);
	});

	it('não avança a marca quando ainda há página além do teto', async () => {
		const memory = poll.prepareMemory('orders', [{ id: 'old', order_date: '2026-01-01 00:00:00' }]);
		const input = pollInput(
			[{ data: [{ id: 'new', order_date: '2026-01-02 00:00:00' }], pagination: { next_cursor: 'more' } }],
			memory,
			false,
		);
		input.maxPages = 1;
		await assert.rejects(() => poll.runPoll(input), /passou de 1 páginas/);
		assert.deepEqual(memory.seen, ['old']);
	});
});

describe('listas do formulário', () => {
	it('busca evento, pedido, participante, ingresso e apresentação', async () => {
		const calls = [];
		const body = {
			data: [
				{
					id: 'evt',
					name: 'Show',
					buyer_first_name: 'Ana',
					buyer_last_name: 'Lima',
					buyer_email: 'ana@example.com',
					order_date: '2026-01-01 10:00:00',
					first_name: 'Ana',
					last_name: 'Lima',
					email: 'ana@example.com',
					ticket_number: 'T-1',
					start_date: '2026-02-01 20:00:00',
				},
			],
			pagination: {},
		};
		const context = {
			getCurrentNodeParameter(name) {
				return name === 'apiVersion' ? '1.6.0' : 'evt';
			},
			async getCredentials() {
				return { baseUrl: BASE };
			},
			helpers: {
				async httpRequestWithAuthentication(_type, options) {
					calls.push(options);
					return { statusCode: 200, headers: {}, body };
				},
			},
		};
		const events = await listSearch.searchEvents.call(context, 'show');
		const orders = await listSearch.searchOrders.call(context, 'ana');
		const participants = await listSearch.searchParticipants.call(context, 'lima');
		const tickets = await listSearch.searchTicketNumbers.call(context, 'T-1');
		const presentations = await listSearch.searchPresentations.call(context, '2026');
		assert.equal(events.results[0].value, 'evt');
		assert.equal(orders.results[0].value, 'evt');
		assert.match(orders.results[0].name, /Ana Lima/);
		assert.equal(participants.results[0].value, 'evt');
		assert.equal(tickets.results[0].value, 'T-1');
		assert.equal(presentations.results[0].value, 'evt');
		assert.deepEqual(
			calls.map((call) => call.url),
			[
				`${BASE}/v1.6.0/events`,
				`${BASE}/v1.6.0/events/evt/orders`,
				`${BASE}/v1.6.0/events/evt/participants`,
				`${BASE}/v1.6.0/events/evt/participants`,
				`${BASE}/v1.6.0/events/evt/presentations`,
			],
		);
		assert.equal(calls[1].qs.field_sort, 'order_date');
		assert.equal(calls[2].qs.fields.includes('ticket_number'), true);
	});

	it('declara no node cada busca usada pelo formulário', () => {
		const node = new Sympla();
		const trigger = new SymplaTrigger();
		const names = new Set();
		const walk = (items) => {
			for (const item of items ?? []) {
				if (item.typeOptions?.searchListMethod) names.add(item.typeOptions.searchListMethod);
				walk(item.options);
				if (item.modes) walk(item.modes);
			}
		};
		walk(node.description.properties);
		walk(trigger.description.properties);
		for (const name of names) assert.equal(typeof listSearch[name], 'function', name);
		assert.equal(trigger.description.polling, true);
		assert.deepEqual(trigger.description.inputs, []);
		assert.equal(trigger.description.usableAsTool, undefined);
		assert.match(trigger.description.name, /Trigger$/);
		assert.match(trigger.description.displayName, /Trigger/);
		const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
		assert.equal(pkg.n8n.nodes.includes('dist/nodes/SymplaTrigger/SymplaTrigger.node.js'), true);
	});

	it('mostra o evento em obter evento e em listas que dependem dele, e o fuso só nas leituras', () => {
		const node = new Sympla();
		const properties = node.description.properties;
		const names = (values) => visibleNames(properties, values);
		assert.equal(names({ resource: 'event', operation: 'get' }).includes('eventId'), true);
		assert.equal(names({ resource: 'event', operation: 'getMany' }).includes('eventId'), false);
		assert.equal(names({ resource: 'participant', operation: 'getMany' }).includes('eventId'), true);
		assert.equal(names({ resource: 'participant', operation: 'checkIn' }).includes('eventId'), true);
		assert.equal(names({ resource: 'order', operation: 'getMany' }).includes('eventId'), true);
		assert.equal(names({ resource: 'presentation', operation: 'get' }).includes('eventId'), true);
		assert.equal(names({ resource: 'participant', operation: 'getMany' }).includes('timezone'), true);
		assert.equal(names({ resource: 'participant', operation: 'checkInByQrCode' }).includes('timezone'), false);
		assert.equal(names({ resource: 'event', operation: 'get' }).includes('timezone'), true);
	});
});

function visibleNames(properties, values) {
	return properties
		.filter((property) => {
			const { show, hide } = property.displayOptions ?? {};
			if (show) {
				for (const key of Object.keys(show)) {
					const current = values[key];
					if (typeof current === 'string' && current.startsWith('=')) continue;
					if (!show[key].includes(current)) return false;
				}
			}
			if (hide) {
				for (const key of Object.keys(hide)) {
					if (hide[key].includes(values[key])) return false;
				}
			}
			return true;
		})
		.map((property) => property.name);
}

function pollInput(pages, memory, manual) {
	const pending = pages.slice();
	return {
		async call() {
			const page = pending.shift();
			if (!page) throw new Error('sem página');
			return { statusCode: 200, headers: {}, body: page };
		},
		sleep: async () => {},
		baseUrl: BASE,
		apiVersion: '1.6.0',
		eventId: 'evt',
		watch: 'orders',
		timezone: 'America/Sao_Paulo',
		pageSize: 10,
		maxPages: 5,
		manualLimit: 20,
		memory,
		manual,
	};
}
