import type { SymplaRequest } from './buildRequest';
import { SymplaInputError } from './values';

export const REQUEST_TIMEOUT_MS = 60_000;
const READ_MAX_ATTEMPTS = 4;

export interface RawResponse {
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	body: unknown;
}

export interface CallOptions {
	method: string;
	url: string;
	qs?: Record<string, string | number | boolean>;
	body?: unknown;
	json?: boolean;
	timeout: number;
}

export interface HttpCall {
	(options: CallOptions): Promise<RawResponse>;
}

export function assertBaseUrl(value: unknown): string {
	const text = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
	let url: URL | undefined;
	try {
		url = new URL(text);
	} catch {
		url = undefined;
	}
	if (!url) throw new SymplaInputError('A URL base é inválida.');
	if (url.protocol !== 'https:') throw new SymplaInputError('A URL base precisa usar HTTPS.');
	if (url.username || url.password) throw new SymplaInputError('A URL base não pode conter usuário ou senha.');
	if (url.search || url.hash) throw new SymplaInputError('A URL base não pode ter query string nem fragmento.');
	return text;
}

export class SymplaApiError extends Error {
	readonly name = 'SymplaApiError';
	readonly statusCode?: number;

	constructor(message: string, statusCode?: number) {
		super(message);
		this.statusCode = statusCode;
	}
}

export function redactText(value: string): string {
	return value
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
		.replace(/(s_token|token|authorization|bearer|signature|password)\s*[:=]\s*\S+/gi, '$1=[redacted]');
}

export interface PageInfo {
	nextCursor: string;
	hasNext: boolean;
	page: number;
}

export async function performRequest(input: {
	call: HttpCall;
	sleep: (ms: number) => Promise<void>;
	baseUrl: string;
	request: SymplaRequest;
}): Promise<{ items: unknown[]; page: PageInfo }> {
	const baseUrl = assertBaseUrl(input.baseUrl);
	if (input.request.pagination === 'none') {
		const response = await requestOnce(input.call, input.sleep, `${baseUrl}${input.request.path}`, input.request);
		const page = pageInfo(response.body);
		if (input.request.includeEnvelope) return { items: [response.body], page };
		return { items: itemsOf(response), page };
	}
	const items: unknown[] = [];
	const seen = new Set<string>();
	let cursor = typeof input.request.query.cursor === 'string' ? input.request.query.cursor : undefined;
	let pageNumber = typeof input.request.query.page === 'number' ? input.request.query.page : 1;
	if (cursor) seen.add(cursor);
	let page = pageInfo(undefined);
	for (let index = 1; index <= input.request.maxPages; index += 1) {
		const query = { ...input.request.query };
		if (input.request.pagination === 'cursor') {
			if (cursor) query.cursor = cursor;
			else delete query.cursor;
		} else {
			query.page = pageNumber;
		}
		const response = await requestOnce(input.call, input.sleep, `${baseUrl}${input.request.path}`, {
			...input.request,
			query,
		});
		items.push(...itemsOf(response));
		page = pageInfo(response.body);
		if (input.request.limit !== undefined && items.length >= input.request.limit) {
			return { items: items.slice(0, input.request.limit), page };
		}
		if (input.request.pagination === 'cursor') {
			if (!page.nextCursor) return { items, page };
			if (seen.has(page.nextCursor)) {
				throw new SymplaApiError('A paginação repetiu um cursor. A lista parcial não foi devolvida.');
			}
			seen.add(page.nextCursor);
			cursor = page.nextCursor;
			continue;
		}
		if (!page.hasNext) return { items, page };
		pageNumber += 1;
	}
	throw new SymplaApiError(
		`A lista passou de ${input.request.maxPages} páginas. Aumente Max Pages. A lista parcial não foi devolvida.`,
	);
}

async function requestOnce(
	call: HttpCall,
	sleep: (ms: number) => Promise<void>,
	url: string,
	request: SymplaRequest,
): Promise<RawResponse> {
	const attempts = request.retry === 'read' ? READ_MAX_ATTEMPTS : 1;
	let fatal: SymplaApiError | undefined;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await call({
				method: request.method,
				url,
				qs: request.query,
				body: request.body,
				json: true,
				timeout: REQUEST_TIMEOUT_MS,
			});
			if (response.statusCode < 400) return response;
			const retryable = request.retry === 'read' && (response.statusCode === 502 || response.statusCode === 504);
			if (!retryable || attempt === attempts) {
				fatal = new SymplaApiError(errorMessage(response, request.retry), response.statusCode);
				break;
			}
			await sleep(backoffMs(attempt));
		} catch (error) {
			if (error instanceof SymplaApiError || error instanceof SymplaInputError) {
				fatal = error instanceof SymplaApiError ? error : new SymplaApiError(error.message);
				break;
			}
			if (request.retry !== 'read' || attempt === attempts) {
				const reason = error instanceof Error ? error.message : 'falha de rede';
				const suffix = request.retry === 'write' ? ' A escrita não foi repetida.' : '';
				fatal = new SymplaApiError(`Falha de rede ao chamar a Sympla: ${redactText(reason)}.${suffix}`);
				break;
			}
			await sleep(backoffMs(attempt));
		}
	}
	throw fatal ?? new SymplaApiError('Falha ao chamar a Sympla.');
}

function itemsOf(response: RawResponse): unknown[] {
	if (response.statusCode === 204 || response.body === undefined || response.body === '') return [];
	const body = asRecord(response.body);
	const data = 'data' in body ? body.data : response.body;
	if (Array.isArray(data)) return data;
	if (data === undefined || data === null) return [];
	return [data];
}

function paginationOf(body: unknown): Record<string, unknown> {
	const record = asRecord(body);
	return asRecord(record.pagination);
}

function pageInfo(body: unknown): PageInfo {
	const pagination = paginationOf(body);
	const nextCursor = typeof pagination.next_cursor === 'string' ? pagination.next_cursor : '';
	const page = typeof pagination.page === 'number' ? pagination.page : 0;
	return {
		nextCursor,
		hasNext: pagination.has_next === true || nextCursor !== '',
		page,
	};
}

function asRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
	return {};
}

function errorMessage(response: RawResponse, retry: 'read' | 'write'): string {
	const body = asRecord(response.body);
	const title = typeof body.title === 'string' ? body.title : '';
	const detail = typeof body.detail === 'string' ? body.detail : '';
	const message = typeof body.message === 'string' ? body.message : '';
	const text = redactText([title, detail, message].filter((part) => part !== '').join(' — ') || 'A Sympla recusou a requisição.');
	const writeNote = retry === 'write' ? ' A escrita não foi repetida.' : '';
	return `Sympla respondeu ${response.statusCode}: ${text}.${writeNote}`.replace(/\.\.$/, '.');
}

function backoffMs(attempt: number): number {
	return Math.min(500 * 2 ** (attempt - 1), 8000);
}
