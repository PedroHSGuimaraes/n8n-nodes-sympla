import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { assertBaseUrl, type RawResponse } from './api/transport';
import { versionOf } from './api/values';

function locatorValue(value: unknown): string {
	if (value && typeof value === 'object' && 'value' in value) return String((value as { value?: unknown }).value ?? '').trim();
	return String(value ?? '').trim();
}

async function authedGet(
	this: ILoadOptionsFunctions,
	path: string,
	query: Record<string, string | number | boolean>,
): Promise<unknown> {
	const credentials = await this.getCredentials('symplaApi');
	const baseUrl = assertBaseUrl(credentials.baseUrl);
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'symplaApi', {
		method: 'GET',
		url: `${baseUrl}${path}`,
		qs: query,
		json: true,
		timeout: 60_000,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	})) as RawResponse;
	if (response.statusCode >= 400) {
		throw new Error(`A busca na Sympla respondeu ${response.statusCode}.`);
	}
	return response.body;
}

function rows(body: unknown): Record<string, unknown>[] {
	if (!body || typeof body !== 'object') return [];
	const data = (body as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	return data.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row));
}

function pageToken(body: unknown, version: string): string | undefined {
	if (!body || typeof body !== 'object') return undefined;
	const pagination = (body as { pagination?: Record<string, unknown> }).pagination;
	if (!pagination) return undefined;
	if (version === '1.6.0') {
		return typeof pagination.next_cursor === 'string' && pagination.next_cursor !== '' ? pagination.next_cursor : undefined;
	}
	if (pagination.has_next === true && typeof pagination.page === 'number') return String(pagination.page + 1);
	return undefined;
}

function matches(filter: string | undefined, name: string, value: string): boolean {
	const needle = filter?.trim().toLowerCase();
	if (!needle) return true;
	return name.toLowerCase().includes(needle) || value.toLowerCase().includes(needle);
}

function pageQuery(version: string, paginationToken?: string): Record<string, string | number> {
	if (version === '1.6.0') return paginationToken ? { cursor: paginationToken } : {};
	return { page: paginationToken ? Number(paginationToken) : 1 };
}

export const listSearch = {
	async searchEvents(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const version = versionOf(this.getCurrentNodeParameter('apiVersion'));
		const body = await authedGet.call(this, `/v${version}/events`, {
			published: 'all',
			timezone: 'America/Sao_Paulo',
			sort: 'asc',
			field_sort: 'name',
			page_size: 100,
			fields: 'id,name',
			...pageQuery(version, paginationToken),
		});
		const results = rows(body)
			.filter((row) => row.id !== undefined)
			.map((row) => ({
				name: typeof row.name === 'string' && row.name.trim() !== '' ? row.name.trim() : String(row.id),
				value: String(row.id),
			}))
			.filter((row) => matches(filter, row.name, row.value));
		return { results, paginationToken: pageToken(body, version) };
	},
	async searchOrders(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const version = versionOf(this.getCurrentNodeParameter('apiVersion'));
		const eventId = locatorValue(this.getCurrentNodeParameter('eventId'));
		if (!eventId) return { results: [] };
		const body = await authedGet.call(this, `/v${version}/events/${encodeURIComponent(eventId)}/orders`, {
			timezone: 'America/Sao_Paulo',
			sort: 'desc',
			field_sort: 'order_date',
			page_size: 100,
			fields: 'id,buyer_first_name,buyer_last_name,buyer_email,order_date',
			...pageQuery(version, paginationToken),
		});
		const results = rows(body)
			.filter((row) => row.id !== undefined)
			.map((row) => {
				const buyer = [row.buyer_first_name, row.buyer_last_name].filter((part) => typeof part === 'string' && part.trim() !== '').join(' ');
				const email = typeof row.buyer_email === 'string' ? row.buyer_email : '';
				const when = typeof row.order_date === 'string' ? row.order_date : '';
				const name = [buyer, email, when, String(row.id)].filter((part) => part !== '').join(' — ');
				return { name, value: String(row.id) };
			})
			.filter((row) => matches(filter, row.name, row.value));
		return { results, paginationToken: pageToken(body, version) };
	},
	async searchParticipants(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const found = await participantRows.call(this, paginationToken);
		return {
			paginationToken: found.paginationToken,
			results: found.rows
				.filter((row) => row.id !== undefined)
				.map((row) => ({ name: participantLabel(row), value: String(row.id) }))
				.filter((row) => matches(filter, row.name, row.value)),
		};
	},
	async searchTicketNumbers(this: ILoadOptionsFunctions, filter?: string, paginationToken?: string): Promise<INodeListSearchResult> {
		const found = await participantRows.call(this, paginationToken);
		return {
			paginationToken: found.paginationToken,
			results: found.rows
				.filter((row) => typeof row.ticket_number === 'string' && row.ticket_number.trim() !== '')
				.map((row) => ({ name: participantLabel(row), value: String(row.ticket_number).trim() }))
				.filter((row) => matches(filter, row.name, row.value)),
		};
	},
	async searchPresentations(
		this: ILoadOptionsFunctions,
		filter?: string,
		paginationToken?: string,
	): Promise<INodeListSearchResult> {
		const version = versionOf(this.getCurrentNodeParameter('apiVersion'));
		const eventId = locatorValue(this.getCurrentNodeParameter('eventId'));
		if (!eventId) return { results: [] };
		const query: Record<string, string | number | boolean> = {
			published: true,
			timezone: 'America/Sao_Paulo',
			sort: 'asc',
			field_sort: 'start_date',
			page_size: 100,
			fields: 'id,start_date',
			...pageQuery(version, paginationToken),
		};
		const body = await authedGet.call(this, `/v${version}/events/${encodeURIComponent(eventId)}/presentations`, query);
		const needle = filter?.trim().toLowerCase();
		const results = rows(body)
			.filter((row) => row.id !== undefined)
			.map((row) => {
				const when = typeof row.start_date === 'string' ? row.start_date : '';
				const name = when !== '' ? `${row.id} — ${when}` : String(row.id);
				return { name, value: String(row.id) };
			})
			.filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.value.includes(needle));
		return { results, paginationToken: pageToken(body, version) };
	},
};

async function participantRows(
	this: ILoadOptionsFunctions,
	paginationToken?: string,
): Promise<{ rows: Record<string, unknown>[]; paginationToken?: string }> {
	const version = versionOf(this.getCurrentNodeParameter('apiVersion'));
	const eventId = locatorValue(this.getCurrentNodeParameter('eventId'));
	if (!eventId) return { rows: [] };
	const body = await authedGet.call(this, `/v${version}/events/${encodeURIComponent(eventId)}/participants`, {
		timezone: 'America/Sao_Paulo',
		sort: 'desc',
		field_sort: 'ticket_created_at',
		page_size: 100,
		fields: 'id,first_name,last_name,email,ticket_number',
		...pageQuery(version, paginationToken),
	});
	return { rows: rows(body), paginationToken: pageToken(body, version) };
}

function participantLabel(row: Record<string, unknown>): string {
	const person = [row.first_name, row.last_name].filter((part) => typeof part === 'string' && part.trim() !== '').join(' ');
	const email = typeof row.email === 'string' ? row.email : '';
	const ticket = typeof row.ticket_number === 'string' ? row.ticket_number : '';
	const id = row.id !== undefined ? String(row.id) : '';
	return [person, email, ticket, id].filter((part) => part !== '').join(' — ');
}
