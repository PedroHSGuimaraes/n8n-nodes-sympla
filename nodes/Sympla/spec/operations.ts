export const API_VERSIONS = ['1.5.0', '1.5.1', '1.6.0'] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

export type PaginationKind = 'cursor' | 'page' | 'none';

export interface OperationSpec {
	resource: string;
	operation: string;
	name: string;
	action: string;
	description: string;
	method: 'GET' | 'POST';
	path: string;
	pagination: PaginationKind;
	pageSizeMax: number;
	write: boolean;
	versions: readonly ApiVersion[];
	needs: readonly Need[];
	queries: readonly QueryKind[];
}

export type Need = 'event' | 'order' | 'participant' | 'ticket' | 'presentation' | 'qr';

export type QueryKind =
	| 'published'
	| 'presentationPublished'
	| 'timezone'
	| 'sort'
	| 'eventSort'
	| 'orderSort'
	| 'participantSort'
	| 'presentationSort'
	| 'from'
	| 'to'
	| 'fieldsEvent'
	| 'fieldsOrder'
	| 'fieldsParticipant'
	| 'fieldsParticipantShort'
	| 'fieldsPresentation'
	| 'cancelled'
	| 'buyerEmail'
	| 'participantEmail'
	| 'ticketNumberFilter'
	| 'orderStatus'
	| 'legacyOrderWindow'
	| 'onlineSector';

const ALL: readonly ApiVersion[] = API_VERSIONS;
const QR: readonly ApiVersion[] = ['1.5.1', '1.6.0'];
const LEGACY: readonly ApiVersion[] = ['1.5.0', '1.5.1'];

const participantFields: QueryKind = 'fieldsParticipant';

export const operations: OperationSpec[] = [
	{
		resource: 'event',
		operation: 'getMany',
		name: 'Get Many',
		action: 'Get many events',
		description: 'Lists the authenticated producer events',
		method: 'GET',
		path: '/events',
		pagination: 'cursor',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: [],
		queries: ['published', 'from', 'timezone', 'sort', 'eventSort', 'fieldsEvent'],
	},
	{
		resource: 'event',
		operation: 'get',
		name: 'Get',
		action: 'Get an event',
		description: 'Gets one event by its ID hash',
		method: 'GET',
		path: '/events/{eventId}',
		pagination: 'none',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event'],
		queries: ['timezone', 'fieldsEvent'],
	},
	{
		resource: 'order',
		operation: 'getMany',
		name: 'Get Many',
		action: 'Get many orders',
		description: 'Lists orders of one event',
		method: 'GET',
		path: '/events/{eventId}/orders',
		pagination: 'cursor',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event'],
		queries: ['timezone', 'from', 'to', 'fieldsOrder', 'cancelled', 'buyerEmail', 'orderStatus', 'orderSort', 'sort'],
	},
	{
		resource: 'order',
		operation: 'get',
		name: 'Get',
		action: 'Get an order',
		description: 'Gets one order by its sk',
		method: 'GET',
		path: '/events/{eventId}/orders/{orderId}',
		pagination: 'none',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event', 'order'],
		queries: ['legacyOrderWindow'],
	},
	{
		resource: 'order',
		operation: 'getManyByPresentation',
		name: 'Get Many by Presentation',
		action: 'Get many orders by presentation',
		description: 'Lists orders of one presentation',
		method: 'GET',
		path: '/events/{eventId}/presentations/{presentationId}/orders',
		pagination: 'cursor',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event', 'presentation'],
		queries: ['cancelled', 'buyerEmail', 'orderStatus', 'timezone', 'from', 'to', 'fieldsOrder', 'orderSort', 'sort'],
	},
	{
		resource: 'participant',
		operation: 'getMany',
		name: 'Get Many',
		action: 'Get many participants',
		description: 'Lists participants of one event',
		method: 'GET',
		path: '/events/{eventId}/participants',
		pagination: 'cursor',
		pageSizeMax: 500,
		write: false,
		versions: ALL,
		needs: ['event'],
		queries: ['cancelled', 'participantEmail', 'ticketNumberFilter', 'timezone', 'from', 'to', participantFields, 'participantSort', 'sort'],
	},
	{
		resource: 'participant',
		operation: 'get',
		name: 'Get',
		action: 'Get a participant',
		description: 'Gets one participant by ID',
		method: 'GET',
		path: '/events/{eventId}/participants/{participantId}',
		pagination: 'none',
		pageSizeMax: 500,
		write: false,
		versions: ALL,
		needs: ['event', 'participant'],
		queries: ['timezone', participantFields],
	},
	{
		resource: 'participant',
		operation: 'getByTicketNumber',
		name: 'Get by Ticket Number',
		action: 'Get a participant by ticket number',
		description: 'Gets one participant by ticket number',
		method: 'GET',
		path: '/events/{eventId}/participants/ticketNumber/{ticketNumber}',
		pagination: 'none',
		pageSizeMax: 500,
		write: false,
		versions: ALL,
		needs: ['event', 'ticket'],
		queries: ['timezone', 'fieldsParticipantShort'],
	},
	{
		resource: 'participant',
		operation: 'getManyByOrder',
		name: 'Get Many by Order',
		action: 'Get many participants by order',
		description: 'Lists participants of one order. The API requires fields.',
		method: 'GET',
		path: '/events/{eventId}/orders/{orderId}/participants',
		pagination: 'cursor',
		pageSizeMax: 500,
		write: false,
		versions: ALL,
		needs: ['event', 'order'],
		queries: ['fieldsParticipant', 'timezone', 'cancelled', 'participantSort', 'sort'],
	},
	{
		resource: 'participant',
		operation: 'getManyByPresentation',
		name: 'Get Many by Presentation',
		action: 'Get many participants by presentation',
		description: 'Lists participants of one presentation',
		method: 'GET',
		path: '/events/{eventId}/presentations/{presentationId}/participants',
		pagination: 'cursor',
		pageSizeMax: 500,
		write: false,
		versions: ALL,
		needs: ['event', 'presentation'],
		queries: [
			'cancelled',
			'participantEmail',
			'ticketNumberFilter',
			'timezone',
			'from',
			'to',
			'fieldsParticipantShort',
			'participantSort',
			'sort',
		],
	},
	{
		resource: 'participant',
		operation: 'checkIn',
		name: 'Check In',
		action: 'Check in a participant',
		description: 'Checks in one participant by ID. This writes attendance.',
		method: 'POST',
		path: '/events/{eventId}/participants/{participantId}/check-in',
		pagination: 'none',
		pageSizeMax: 1,
		write: true,
		versions: ALL,
		needs: ['event', 'participant'],
		queries: [],
	},
	{
		resource: 'participant',
		operation: 'checkInByTicketNumber',
		name: 'Check In by Ticket Number',
		action: 'Check in by ticket number',
		description: 'Checks in one participant by ticket number. This writes attendance.',
		method: 'POST',
		path: '/events/{eventId}/participants/ticketNumber/{ticketNumber}/check-in',
		pagination: 'none',
		pageSizeMax: 1,
		write: true,
		versions: ALL,
		needs: ['event', 'ticket'],
		queries: [],
	},
	{
		resource: 'participant',
		operation: 'checkInByQrCode',
		name: 'Check In by QR Code',
		action: 'Check in by QR code',
		description: 'Checks in with the QR payload. Absent from API 1.5.0. This writes attendance.',
		method: 'POST',
		path: '/events/{eventId}/qrcode/check-in',
		pagination: 'none',
		pageSizeMax: 1,
		write: true,
		versions: QR,
		needs: ['event', 'qr'],
		queries: [],
	},
	{
		resource: 'presentation',
		operation: 'getMany',
		name: 'Get Many',
		action: 'Get many presentations',
		description: 'Lists presentations of one event',
		method: 'GET',
		path: '/events/{eventId}/presentations',
		pagination: 'cursor',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event'],
		queries: ['presentationPublished', 'from', 'timezone', 'sort', 'presentationSort', 'onlineSector', 'fieldsPresentation'],
	},
	{
		resource: 'presentation',
		operation: 'get',
		name: 'Get',
		action: 'Get a presentation',
		description: 'Gets one presentation by ID',
		method: 'GET',
		path: '/events/{eventId}/presentations/{presentationId}',
		pagination: 'none',
		pageSizeMax: 200,
		write: false,
		versions: ALL,
		needs: ['event', 'presentation'],
		queries: ['timezone', 'fieldsPresentation'],
	},
];

export function findOperation(resource: string, operation: string): OperationSpec | undefined {
	return operations.find((item) => item.resource === resource && item.operation === operation);
}

export function paginationFor(version: ApiVersion, kind: PaginationKind): PaginationKind {
	if (kind === 'none') return 'none';
	return version === '1.6.0' ? 'cursor' : 'page';
}

export const legacyVersions: readonly ApiVersion[] = LEGACY;
export const ticketNumberFilterVersions: readonly ApiVersion[] = LEGACY;

export const resources = [
	{ name: 'Event', value: 'event', description: 'Producer events' },
	{ name: 'Order', value: 'order', description: 'Ticket orders' },
	{ name: 'Participant', value: 'participant', description: 'Ticket holders' },
	{ name: 'Presentation', value: 'presentation', description: 'Event presentations' },
] as const;
