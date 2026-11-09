import {
	findOperation,
	legacyVersions,
	paginationFor,
	ticketNumberFilterVersions,
	type ApiVersion,
	type OperationSpec,
	type QueryKind,
} from '../spec/operations';
import { integerInRange, optionalText, requiredText, stringList, text, versionOf, SymplaInputError } from './values';

export interface SymplaRequest {
	method: 'GET' | 'POST';
	path: string;
	query: Record<string, string | number | boolean>;
	body?: Record<string, string | number>;
	pagination: 'cursor' | 'page' | 'none';
	retry: 'read' | 'write';
	maxPages: number;
	limit?: number;
	includeEnvelope: boolean;
}

const EVENT_FIELDS = [
	'id',
	'reference_id',
	'start_date',
	'end_date',
	'name',
	'detail',
	'private_event',
	'published',
	'cancelled',
	'image',
	'url',
	'address',
	'host',
	'category_prim',
	'category_sec',
] as const;

const ORDER_FIELDS = [
	'id',
	'event_id',
	'order_date',
	'order_status',
	'updated_date',
	'approved_date',
	'discount_code',
	'transaction_type',
	'order_total_sale_price',
	'order_total_net_value',
	'buyer_first_name',
	'buyer_last_name',
	'buyer_email',
	'presentation_id',
	'invoice_info',
	'utm',
] as const;

const PARTICIPANT_FIELDS = [
	'id',
	'ticket_status',
	'item_id',
	'event_id',
	'presentation_id',
	'order_id',
	'order_status',
	'order_date',
	'order_updated_at',
	'order_approved_date',
	'order_discount',
	'first_name',
	'last_name',
	'email',
	'ticket_number',
	'ticket_created_at',
	'ticket_updated_at',
	'ticket_num_qr_code',
	'ticket_name',
	'sector_name',
	'marked_place_name',
	'access_information',
	'ticket_sale_price',
	'ticket_net_value',
	'ticket_group_id',
	'ticket_group_name',
	'ticket_subgroup_id',
	'ticket_subgroup_name',
	'checkin',
	'custom_form',
] as const;

const PARTICIPANT_SHORT_FIELDS = PARTICIPANT_FIELDS.filter(
	(field) => !field.startsWith('ticket_group') && !field.startsWith('ticket_subgroup'),
);

const PRESENTATION_FIELDS = [
	'id',
	'event_id',
	'presentation_url',
	'closed',
	'enabled',
	'private_presentation',
	'published',
	'start_date',
	'end_date',
	'start_date_utc',
	'end_date_utc',
	'sectors',
] as const;

const SORTS: Record<string, readonly string[]> = {
	eventSort: ['end_date', 'name', 'start_date'],
	orderSort: ['approved_date', 'buyer_email', 'id', 'order_date', 'status', 'updated_date'],
	participantSort: ['ticket_created_at', 'ticket_updated_at'],
	presentationSort: ['start_date'],
};

export function buildRequest(resource: string, operation: string, params: Record<string, unknown>): SymplaRequest {
	const spec = findOperation(resource, operation);
	if (!spec) throw new SymplaInputError('Operação não suportada.');
	const version = versionOf(params.apiVersion);
	if (!spec.versions.includes(version)) {
		throw new SymplaInputError(`${spec.name} não existe na versão ${version} da API pública.`);
	}
	const query: Record<string, string | number | boolean> = {};
	for (const kind of spec.queries) applyQuery(kind, spec, version, params, query);
	const envelope = params.includeEnvelope === true && params.returnAll !== true;
	const singlePage = params.singlePage === true;
	let pagination: SymplaRequest['pagination'] = 'none';
	let limit: number | undefined;
	if (spec.pagination !== 'none') {
		const pageSize = integerInRange(params.pageSize, 'Page Size', 1, spec.pageSizeMax, 100);
		query.page_size = pageSize;
		const mode = paginationFor(version, spec.pagination);
		if (params.returnAll !== true) {
			if (mode === 'cursor') {
				const cursor = optionalText(params.cursor);
				if (cursor) query.cursor = cursor;
			} else {
				query.page = integerInRange(params.page, 'Page', 1, 100000, 1);
			}
		}
		const follow = params.returnAll === true || (!singlePage && !envelope);
		pagination = follow ? mode : 'none';
		if (params.returnAll !== true && !singlePage && !envelope) {
			limit = integerInRange(params.limit, 'Limit', 1, 10000, 50);
		}
	}
	const path = `/v${version}${fillPath(spec, params)}`;
	const body = spec.needs.includes('qr') ? qrBody(params) : undefined;
	return {
		method: spec.method,
		path,
		query,
		body,
		pagination,
		retry: spec.write ? 'write' : 'read',
		maxPages: integerInRange(params.maxPages, 'Max Pages', 1, 1000, 100),
		limit,
		includeEnvelope: envelope,
	};
}

function fillPath(spec: OperationSpec, params: Record<string, unknown>): string {
	let path = spec.path;
	if (spec.needs.includes('event')) path = path.replace('{eventId}', requiredText(params.eventId, 'Event ID'));
	if (spec.needs.includes('order')) path = path.replace('{orderId}', requiredText(params.orderId, 'Order ID'));
	if (spec.needs.includes('participant')) {
		path = path.replace('{participantId}', requiredText(params.participantId, 'Participant ID'));
	}
	if (spec.needs.includes('ticket')) path = path.replace('{ticketNumber}', requiredText(params.ticketNumber, 'Ticket Number'));
	if (spec.needs.includes('presentation')) {
		const presentationId = requiredText(params.presentationId, 'Presentation ID');
		if (!/^\d+$/.test(presentationId)) throw new SymplaInputError('Presentation ID precisa ser numérico.');
		path = path.replace('{presentationId}', presentationId);
	}
	return path;
}

function applyQuery(
	kind: QueryKind,
	spec: OperationSpec,
	version: ApiVersion,
	params: Record<string, unknown>,
	query: Record<string, string | number | boolean>,
): void {
	switch (kind) {
		case 'published':
			query.published = choice(params.published, ['all', 'not_published', 'published'], 'published');
			return;
		case 'presentationPublished':
			query.published = params.presentationPublished !== false;
			return;
		case 'timezone':
			query.timezone = optionalText(params.timezone) ?? 'America/Sao_Paulo';
			return;
		case 'sort':
			query.sort = choice(params.sort, ['asc', 'desc'], 'asc');
			return;
		case 'eventSort':
		case 'orderSort':
		case 'participantSort':
		case 'presentationSort': {
			const allowed = SORTS[kind] ?? [];
			const fallback =
				kind === 'orderSort' ? 'order_date' : kind === 'participantSort' ? 'ticket_created_at' : 'start_date';
			const selected = optionalText(params.fieldSort) ?? fallback;
			if (!allowed.includes(selected)) {
				throw new SymplaInputError(`Sort Field ${selected} não é aceito nesta operação.`);
			}
			query.field_sort = selected;
			return;
		}
		case 'from': {
			const value = optionalText(params.from);
			if (value) query.from = value;
			return;
		}
		case 'to': {
			const value = optionalText(params.to);
			if (value) query.to = value;
			return;
		}
		case 'cancelled': {
			const value = optionalText(params.cancelledFilter);
			if (value && value !== 'none') query.cancelled_filter = choice(value, ['include', 'only'], 'none');
			return;
		}
		case 'buyerEmail': {
			const value = optionalText(params.buyerEmail);
			if (value) query.buyer_email = value;
			return;
		}
		case 'participantEmail': {
			const value = optionalText(params.participantEmail);
			if (value) query.participant_email = value;
			return;
		}
		case 'orderStatus': {
			if (!legacyVersions.includes(version)) return;
			const value = optionalText(params.orderStatus);
			if (value) query.status = value;
			return;
		}
		case 'legacyOrderWindow': {
			if (!legacyVersions.includes(version)) return;
			query.timezone = optionalText(params.timezone) ?? 'America/Sao_Paulo';
			const from = optionalText(params.from);
			const to = optionalText(params.to);
			if (from) query.from = from;
			if (to) query.to = to;
			return;
		}
		case 'ticketNumberFilter': {
			if (!ticketNumberFilterVersions.includes(version)) return;
			const value = optionalText(params.ticketNumberFilter);
			if (value) query.ticket_number = value;
			return;
		}
		case 'onlineSector':
			query.filter_online_sector = params.filterOnlineSector !== false;
			return;
		case 'fieldsEvent':
			assignFields(query, params.fields, EVENT_FIELDS, false);
			return;
		case 'fieldsOrder':
			assignFields(query, params.fields, ORDER_FIELDS, false);
			return;
		case 'fieldsParticipant':
			assignFields(query, params.fields, PARTICIPANT_FIELDS, spec.operation === 'getManyByOrder');
			return;
		case 'fieldsParticipantShort':
			assignFields(query, params.fields, PARTICIPANT_SHORT_FIELDS, false);
			return;
		case 'fieldsPresentation':
			assignFields(query, params.fields, PRESENTATION_FIELDS, false);
			return;
		default:
			return assertQuery(kind);
	}
}

function assignFields(
	query: Record<string, string | number | boolean>,
	value: unknown,
	allowed: readonly string[],
	required: boolean,
): void {
	const selected = stringList(value);
	if (selected.length === 0) {
		if (required) throw new SymplaInputError('A documentação exige fields nesta lista.');
		return;
	}
	for (const field of selected) {
		if (!allowed.includes(field)) throw new SymplaInputError(`O campo ${field} não está na lista documentada.`);
	}
	query.fields = selected.join(',');
}

function choice(value: unknown, allowed: readonly string[], fallback: string): string {
	const selected = text(value) || fallback;
	if (!allowed.includes(selected)) throw new SymplaInputError(`Valor não documentado: ${selected}.`);
	return selected;
}

function qrBody(params: Record<string, unknown>): Record<string, string | number> {
	const signature = requiredText(params.qrSignature, 'Signature');
	if (signature.length < 130 || signature.length > 132) {
		throw new SymplaInputError('Signature precisa ter 130 a 132 caracteres, como no contrato do QR.');
	}
	const timestamp = Number(text(params.qrTimestamp));
	if (!Number.isInteger(timestamp)) throw new SymplaInputError('Timestamp do QR precisa ser um inteiro.');
	const version = Number(text(params.qrVersion));
	if (!Number.isFinite(version)) throw new SymplaInputError('Version do QR precisa ser numérica.');
	return {
		itemId: requiredText(params.qrItemId, 'Item ID'),
		signature,
		timestamp,
		version,
		walletId: requiredText(params.qrWalletId, 'Wallet ID'),
	};
}

function assertQuery(kind: never): never {
	throw new SymplaInputError(`Filtro desconhecido: ${JSON.stringify(kind)}`);
}

