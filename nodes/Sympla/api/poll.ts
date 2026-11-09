import { buildRequest, type SymplaRequest } from './buildRequest';
import { performRequest, SymplaApiError, type HttpCall } from './transport';
import { text, versionOf, SymplaInputError } from './values';

export type PollWatch = 'orders' | 'participants' | 'checkIns';

export interface PollMemory {
	ready: boolean;
	watermark: string;
	seen: string[];
}

const SEEN_CAP = 2000;

export function watchOf(value: unknown): PollWatch {
	const parsed = text(value);
	if (parsed === 'orders' || parsed === 'participants' || parsed === 'checkIns') return parsed;
	throw new SymplaInputError('Watch precisa ser orders, participants ou checkIns.');
}

export function emptyMemory(): PollMemory {
	return { ready: false, watermark: '', seen: [] };
}

export function stampField(watch: PollWatch): 'order_date' | 'ticket_created_at' | 'ticket_updated_at' {
	switch (watch) {
		case 'orders':
			return 'order_date';
		case 'participants':
			return 'ticket_created_at';
		case 'checkIns':
			return 'ticket_updated_at';
		default:
			return assertWatch(watch);
	}
}

export function buildPollPageRequest(input: {
	apiVersion: unknown;
	eventId: unknown;
	watch: PollWatch;
	timezone: unknown;
	pageSize: unknown;
	cursor?: unknown;
	page?: unknown;
}): SymplaRequest {
	return buildRequest(input.watch === 'orders' ? 'order' : 'participant', 'getMany', {
		apiVersion: input.apiVersion,
		eventId: input.eventId,
		timezone: input.timezone,
		sort: 'desc',
		fieldSort: stampField(input.watch),
		pageSize: input.pageSize,
		returnAll: false,
		singlePage: true,
		cursor: input.cursor,
		page: input.page,
	});
}

export function prepareMemory(watch: PollWatch, items: readonly unknown[]): PollMemory {
	let watermark = '';
	const seen: string[] = [];
	for (const item of items) {
		const stamp = readStamp(item, stampField(watch));
		if (stamp > watermark) watermark = stamp;
		const key = identity(watch, item);
		if (key) seen.push(key);
	}
	return { ready: true, watermark, seen: cap(seen) };
}

export function scanNew(watch: PollWatch, memory: PollMemory, items: readonly unknown[]): {
	emit: unknown[];
	memory: PollMemory;
	stop: boolean;
} {
	const original = new Set(memory.seen);
	const seen = new Set(memory.seen);
	const emit: unknown[] = [];
	let watermark = memory.watermark;
	let stop = false;
	for (const item of items) {
		const stamp = readStamp(item, stampField(watch));
		if (watermark && stamp && stamp < watermark) {
			stop = true;
			break;
		}
		const key = identity(watch, item);
		if (key && original.has(key)) stop = true;
		if (key && !seen.has(key) && include(watch, item)) emit.push(item);
		if (key) seen.add(key);
		if (stamp > watermark) watermark = stamp;
	}
	return {
		emit,
		stop,
		memory: { ready: true, watermark, seen: cap([...seen]) },
	};
}

export function visibleItems(watch: PollWatch, items: readonly unknown[], limit: number): unknown[] {
	return items.filter((item) => include(watch, item) && identity(watch, item) !== undefined).slice(0, limit);
}

export async function runPoll(input: {
	call: HttpCall;
	sleep: (ms: number) => Promise<void>;
	baseUrl: string;
	apiVersion: unknown;
	eventId: unknown;
	watch: PollWatch;
	timezone: unknown;
	pageSize: unknown;
	maxPages: number;
	manualLimit: number;
	memory: PollMemory;
	manual: boolean;
	now?: () => number;
	budgetMs?: number;
}): Promise<{ memory: PollMemory; items: unknown[] }> {
	const version = versionOf(input.apiVersion);
	const started = (input.now ?? Date.now)();
	const budget = input.budgetMs ?? Number.POSITIVE_INFINITY;
	const assertBudget = (): void => {
		if ((input.now ?? Date.now)() - started >= budget) {
			throw new SymplaApiError("O polling passou do tempo desta execução. A marca d'água não avançou.");
		}
	};
	const load = async (cursor?: string, page?: number) => {
		assertBudget();
		const request = buildPollPageRequest({
			apiVersion: input.apiVersion,
			eventId: input.eventId,
			watch: input.watch,
			timezone: input.timezone,
			pageSize: input.pageSize,
			cursor,
			page,
		});
		return performRequest({
			call: input.call,
			sleep: input.sleep,
			baseUrl: input.baseUrl,
			request,
		});
	};

	if (input.manual) {
		const page = await load(undefined, 1);
		return { memory: input.memory, items: visibleItems(input.watch, page.items, input.manualLimit) };
	}
	const first = await load(undefined, 1);
	if (!input.memory.ready) {
		return { memory: prepareMemory(input.watch, first.items), items: [] };
	}

	let cursor: string | undefined;
	let pageNumber = 1;
	let memory = input.memory;
	const emit: unknown[] = [];
	let current = first;
	for (let index = 1; index <= input.maxPages; index += 1) {
		const scanned = scanNew(input.watch, memory, current.items);
		memory = scanned.memory;
		emit.push(...scanned.emit);
		const more = version === '1.6.0' ? current.page.nextCursor !== '' : current.page.hasNext;
		if (scanned.stop || !more) return { memory, items: emit };
		if (index === input.maxPages) break;
		if (version === '1.6.0') {
			if (current.page.nextCursor === cursor) {
				throw new SymplaApiError("A paginação do polling repetiu um cursor. A marca d'água não avançou.");
			}
			cursor = current.page.nextCursor;
		} else {
			pageNumber += 1;
		}
		current = await load(cursor, pageNumber);
	}
	throw new SymplaApiError(
		`O polling passou de ${input.maxPages} páginas antes da marca d'água. Aumente Max Pages. A marca d'água não avançou.`,
	);
}

function include(watch: PollWatch, item: unknown): boolean {
	if (watch === 'checkIns') return isCheckedIn(asRecord(item).checkin);
	return true;
}

function identity(watch: PollWatch, item: unknown): string | undefined {
	const row = asRecord(item);
	const id = text(row.id);
	if (!id) return undefined;
	if (watch !== 'checkIns') return id;
	if (!isCheckedIn(row.checkin)) return undefined;
	const checkin = asRecord(row.checkin);
	const token =
		text(checkin.check_in_id) || text(checkin.id) || text(checkin.check_in_date) || text(checkin.date) || 'yes';
	return `${id}:${token}`;
}

function isCheckedIn(value: unknown): boolean {
	if (value === true) return true;
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	if (record.check_in === false) return false;
	if (record.check_in === true) return true;
	return Boolean(text(record.check_in_date) || text(record.date) || text(record.check_in_id) || text(record.id));
}

function readStamp(item: unknown, field: string): string {
	const value = asRecord(item)[field];
	return typeof value === 'string' ? value : '';
}

function cap(values: readonly string[]): string[] {
	return values.slice(-SEEN_CAP);
}

function asRecord(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
	return {};
}

function assertWatch(watch: never): never {
	throw new SymplaInputError(`Acompanhamento desconhecido: ${JSON.stringify(watch)}`);
}
