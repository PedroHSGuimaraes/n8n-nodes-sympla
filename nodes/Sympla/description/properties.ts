import type { INodeProperties } from 'n8n-workflow';

const expressionHint =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

function show(resource: string | string[], operation: string | string[], extra?: Record<string, string[]>): INodeProperties['displayOptions'] {
	return {
		show: {
			resource: Array.isArray(resource) ? resource : [resource],
			operation: Array.isArray(operation) ? operation : [operation],
			...extra,
		},
	};
}

function labels(names: readonly string[]): Array<{ name: string; value: string }> {
	return names
		.map((value) => ({ name: labelOf(value), value }))
		.sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

function labelOf(value: string): string {
	const known: Record<string, string> = {
		id: 'ID',
		url: 'URL',
		utm: 'UTM',
		reference_id: 'Reference ID',
		event_id: 'Event ID',
		order_id: 'Order ID',
		item_id: 'Item ID',
		presentation_id: 'Presentation ID',
		ticket_group_id: 'Ticket Group ID',
		ticket_subgroup_id: 'Ticket Subgroup ID',
		checkin: 'Check-in',
	};
	if (known[value]) return known[value];
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

const eventFields = labels([
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
]);

const orderFields = labels([
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
]);

const participantFields = labels([
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
]);

const participantShortFields = participantFields.filter(
	(field) => !String(field.value).startsWith('ticket_group') && !String(field.value).startsWith('ticket_subgroup'),
);

const presentationFields = labels([
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
]);

const listOperations = [
	'getMany',
	'getManyByOrder',
	'getManyByPresentation',
];

const readOperations = [
	'get',
	'getMany',
	'getManyByOrder',
	'getManyByPresentation',
	'getByTicketNumber',
];

function eventLocator(displayOptions: INodeProperties['displayOptions']): INodeProperties {
	return {
		displayName: 'Event Name or ID',
		name: 'eventId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: expressionHint,
		displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchEvents', searchable: true },
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'Event ID hash',
				validation: [{ type: 'regex', properties: { regex: '.+', errorMessage: 'Enter an event ID' } }],
			},
		],
	};
}

export function buildNodeProperties(): INodeProperties[] {
	return [
		{
			displayName: 'API Version',
			name: 'apiVersion',
			type: 'options',
			default: '1.6.0',
			noDataExpression: true,
			description: 'Published contract version. 1.6.0 uses cursor pagination. 1.5.0 has no QR check-in.',
			options: [
				{ name: 'Version 1.5.0', value: '1.5.0' },
				{ name: 'Version 1.5.1', value: '1.5.1' },
				{ name: 'Version 1.6.0', value: '1.6.0' },
			],
		},
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			default: 'event',
			noDataExpression: true,
			options: [
				{ name: 'Event', value: 'event', description: 'Producer events' },
				{ name: 'Order', value: 'order', description: 'Ticket orders' },
				{ name: 'Participant', value: 'participant', description: 'Ticket holders' },
				{ name: 'Presentation', value: 'presentation', description: 'Event presentations' },
			],
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			default: 'getMany',
			noDataExpression: true,
			displayOptions: { show: { resource: ['event'] } },
			options: [
				{ name: 'Get', value: 'get', action: 'Get an event', description: 'Gets one event by its ID hash' },
				{ name: 'Get Many', value: 'getMany', action: 'Get many events', description: 'Lists the authenticated producer events' },
			],
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			default: 'getMany',
			noDataExpression: true,
			displayOptions: { show: { resource: ['order'] } },
			options: [
				{ name: 'Get', value: 'get', action: 'Get an order', description: 'Gets one order by its sk' },
				{ name: 'Get Many', value: 'getMany', action: 'Get many orders', description: 'Lists orders of one event' },
				{
					name: 'Get Many by Presentation',
					value: 'getManyByPresentation',
					action: 'Get many orders by presentation',
					description: 'Lists orders of one presentation',
				},
			],
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			default: 'getMany',
			noDataExpression: true,
			displayOptions: { show: { resource: ['participant'], apiVersion: ['1.5.0'] } },
			options: participantOperations(false),
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			default: 'getMany',
			noDataExpression: true,
			displayOptions: { show: { resource: ['participant'], apiVersion: ['1.5.1', '1.6.0'] } },
			options: participantOperations(true),
		},
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			default: 'getMany',
			noDataExpression: true,
			displayOptions: { show: { resource: ['presentation'] } },
			options: [
				{ name: 'Get', value: 'get', action: 'Get a presentation', description: 'Gets one presentation by ID' },
				{ name: 'Get Many', value: 'getMany', action: 'Get many presentations', description: 'Lists presentations of one event' },
			],
		},
		{
			displayName: 'Check-in writes attendance in Sympla. Confirm the person and the event before running it.',
			name: 'noticeCheckIn',
			type: 'notice',
			default: '',
			displayOptions: {
				show: { resource: ['participant'], operation: ['checkIn', 'checkInByTicketNumber', 'checkInByQrCode'] },
			},
		},
		eventLocator({ show: { resource: ['event'], operation: ['get'] } }),
		eventLocator({
			show: {
				resource: ['order', 'participant', 'presentation'],
				operation: [
					'get',
					'getMany',
					'getManyByOrder',
					'getManyByPresentation',
					'getByTicketNumber',
					'checkIn',
					'checkInByTicketNumber',
					'checkInByQrCode',
				],
			},
		}),
		{
			displayName: 'Presentation Name or ID',
			name: 'presentationId',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
			description: `${expressionHint}. The API expects a numeric presentation ID.`,
			displayOptions: {
				show: {
					resource: ['order', 'participant'],
					operation: ['getManyByPresentation'],
				},
			},
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchPresentations', searchable: true },
				},
				{
					displayName: 'ID',
					name: 'id',
					type: 'string',
					placeholder: '123',
				},
			],
		},
		orderLocator(
			show('order', ['get']),
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. The value is the order sk.',
		),
		orderLocator(
			show('participant', ['getManyByOrder']),
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. The value is the order sk.',
		),
		{
			displayName: 'Participant ID',
			name: 'participantId',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
			description: `${expressionHint}. Version 1.6.0 changed this identifier.`,
			displayOptions: show('participant', ['get', 'checkIn']),
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchParticipants', searchable: true },
				},
				{
					displayName: 'ID',
					name: 'id',
					type: 'string',
					placeholder: 'Participant ID',
				},
			],
		},
		{
			displayName: 'Ticket Number',
			name: 'ticketNumber',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
			description: `${expressionHint}. The value is sent in the path.`,
			displayOptions: show('participant', ['getByTicketNumber', 'checkInByTicketNumber']),
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchTicketNumbers', searchable: true },
				},
				{
					displayName: 'Number',
					name: 'id',
					type: 'string',
					placeholder: 'Ticket number',
				},
			],
		},
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: show(['event', 'order', 'participant', 'presentation'], listOperations),
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 10000 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: {
					resource: ['event', 'order', 'participant', 'presentation'],
					operation: listOperations,
					returnAll: [false],
				},
			},
		},
		{
			displayName: 'Max Pages',
			name: 'maxPages',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 100,
			description:
				'Fails the node when another page still exists after this many requests. A partial list is not returned. Limit discards extra rows on the last page only after this cap is satisfied.',
			displayOptions: show(['event', 'order', 'participant', 'presentation'], listOperations),
		},
		{
			displayName: 'Page Size',
			name: 'pageSize',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 500 },
			default: 100,
			description:
				'Items requested in page_size. Events, orders, and presentations accept at most 200, and participant lists accept at most 500.',
			displayOptions: show(['event', 'order', 'participant', 'presentation'], listOperations),
		},
		{
			displayName: 'Page',
			name: 'page',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 1,
			description: 'Page number for API versions 1.5.0 and 1.5.1. It is ignored on version 1.6.0.',
			displayOptions: {
				show: {
					apiVersion: ['1.5.0', '1.5.1'],
					resource: ['event', 'order', 'participant', 'presentation'],
					operation: listOperations,
					returnAll: [false],
				},
			},
		},
		{
			displayName: 'Cursor',
			name: 'cursor',
			type: 'string',
			default: '',
			description: 'Value of pagination.next_cursor. Leave empty to read the first page of API 1.6.0.',
			displayOptions: {
				show: {
					apiVersion: ['1.6.0'],
					resource: ['event', 'order', 'participant', 'presentation'],
					operation: listOperations,
					returnAll: [false],
				},
			},
		},
		{
			displayName: 'Published',
			name: 'published',
			type: 'options',
			default: 'published',
			description: 'Publication filter. The API also accepts the aliases true and false, which this form does not send.',
			displayOptions: show('event', 'getMany'),
			options: [
				{ name: 'All', value: 'all' },
				{ name: 'Not Published', value: 'not_published' },
				{ name: 'Published', value: 'published' },
			],
		},
		{
			displayName: 'Published Only',
			name: 'presentationPublished',
			type: 'boolean',
			default: true,
			description: 'Whether to return only published presentations',
			displayOptions: show('presentation', 'getMany'),
		},
		{
			displayName: 'Online Sector',
			name: 'filterOnlineSector',
			type: 'boolean',
			default: true,
			description: 'Whether to keep only sectors with online sales',
			displayOptions: show('presentation', 'getMany'),
		},
		{
			displayName: 'Presentation Name or ID',
			name: 'presentationId',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			required: true,
			description: `${expressionHint}. The API expects a numeric presentation ID.`,
			displayOptions: show('presentation', 'get'),
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchPresentations', searchable: true },
				},
				{
					displayName: 'ID',
					name: 'id',
					type: 'string',
					placeholder: '123',
				},
			],
		},
		{
			displayName: 'Timezone',
			name: 'timezone',
			type: 'string',
			default: 'America/Sao_Paulo',
			description:
				'IANA timezone applied to input and output dates. The API default is America/Sao_Paulo. Get Order on API 1.6.0 has no query parameters, so this value is not sent for that operation.',
			displayOptions: { show: { operation: readOperations } },
		},
		{
			displayName: 'Sort',
			name: 'sort',
			type: 'options',
			default: 'asc',
			description: 'Sort direction sent as sort',
			displayOptions: show(['event', 'order', 'participant', 'presentation'], listOperations),
			options: [
				{ name: 'Ascending', value: 'asc' },
				{ name: 'Descending', value: 'desc' },
			],
		},
		{
			displayName: 'Sort Field',
			name: 'fieldSort',
			type: 'options',
			default: 'start_date',
			description: 'Sort field for events',
			displayOptions: show('event', 'getMany'),
			options: [
				{ name: 'End Date', value: 'end_date' },
				{ name: 'Name', value: 'name' },
				{ name: 'Start Date', value: 'start_date' },
			],
		},
		{
			displayName: 'Sort Field',
			name: 'fieldSort',
			type: 'options',
			default: 'order_date',
			description: 'Sort field for orders. order_date is the documented alias of created_at.',
			displayOptions: show('order', ['getMany', 'getManyByPresentation']),
			options: [
				{ name: 'Approved Date', value: 'approved_date' },
				{ name: 'Buyer Email', value: 'buyer_email' },
				{ name: 'ID', value: 'id' },
				{ name: 'Order Date', value: 'order_date' },
				{ name: 'Status', value: 'status' },
				{ name: 'Updated Date', value: 'updated_date' },
			],
		},
		{
			displayName: 'Sort Field',
			name: 'fieldSort',
			type: 'options',
			default: 'ticket_created_at',
			description: 'Sort field for participants. API 1.6.0 rejects the older sort names.',
			displayOptions: show('participant', listOperations),
			options: [
				{ name: 'Ticket Created At', value: 'ticket_created_at' },
				{ name: 'Ticket Updated At', value: 'ticket_updated_at' },
			],
		},
		{
			displayName: 'Sort Field',
			name: 'fieldSort',
			type: 'options',
			default: 'start_date',
			description: 'Sort field for presentations',
			displayOptions: show('presentation', 'getMany'),
			options: [{ name: 'Start Date', value: 'start_date' }],
		},
		{
			displayName: 'From',
			name: 'from',
			type: 'string',
			default: '',
			placeholder: '2026-01-01T00:00:00',
			description:
				'Start of the documented date filter, in local ISO-8601 interpreted in Timezone. On participant lists the API applies it to ticket_updated_at.',
			displayOptions: show(
				['event', 'order', 'participant', 'presentation'],
				['getMany', 'getManyByPresentation'],
			),
		},
		{
			displayName: 'To',
			name: 'to',
			type: 'string',
			default: '',
			placeholder: '2026-01-31T23:59:59',
			description:
				'End of the documented date filter, in local ISO-8601 interpreted in Timezone. On participant lists the API applies it to ticket_updated_at.',
			displayOptions: show(['order', 'participant', 'presentation'], ['getMany', 'getManyByPresentation']),
		},
		{
			displayName: 'Cancelled Filter',
			name: 'cancelledFilter',
			type: 'options',
			default: 'none',
			description: 'How cancelled records are included. None omits the query, which is the API default.',
			displayOptions: show(['order', 'participant'], ['getMany', 'getManyByOrder', 'getManyByPresentation']),
			options: [
				{ name: 'Include', value: 'include' },
				{ name: 'None', value: 'none' },
				{ name: 'Only', value: 'only' },
			],
		},
		{
			displayName: 'Buyer Email',
			name: 'buyerEmail',
			type: 'string',
			default: '',
			placeholder: 'name@email.com',
			description: 'Exact buyer email. An empty value is not sent.',
			displayOptions: show('order', ['getMany', 'getManyByPresentation']),
		},
		{
			displayName: 'Participant Email',
			name: 'participantEmail',
			type: 'string',
			default: '',
			placeholder: 'name@email.com',
			description: 'Exact participant email. An empty value is not sent.',
			displayOptions: show('participant', ['getMany', 'getManyByPresentation']),
		},
		{
			displayName: 'Ticket Number Filter',
			name: 'ticketNumberFilter',
			type: 'string',
			default: '',
			description: 'Exact ticket_number query. API 1.6.0 removed this filter and the node does not send it there.',
			displayOptions: {
				show: {
					apiVersion: ['1.5.0', '1.5.1'],
					resource: ['participant'],
					operation: ['getMany', 'getManyByPresentation'],
				},
			},
		},
		{
			displayName: 'Order Status',
			name: 'orderStatus',
			type: 'string',
			default: '',
			description:
				'Sent as status on API 1.5.0 and 1.5.1. The OpenAPI spec does not list allowed values. An empty value is omitted. API 1.6.0 removed this parameter.',
			displayOptions: {
				show: {
					apiVersion: ['1.5.0', '1.5.1'],
					resource: ['order'],
					operation: ['getMany', 'getManyByPresentation'],
				},
			},
		},
		{
			displayName: 'From',
			name: 'from',
			type: 'string',
			default: '',
			placeholder: '2026-01-01T00:00:00',
			description: 'Start date and time accepted by Get Order on API 1.5.0 and 1.5.1. API 1.6.0 removed it.',
			displayOptions: { show: { apiVersion: ['1.5.0', '1.5.1'], resource: ['order'], operation: ['get'] } },
		},
		{
			displayName: 'To',
			name: 'to',
			type: 'string',
			default: '',
			placeholder: '2026-01-31T23:59:59',
			description: 'End date and time accepted by Get Order on API 1.5.0 and 1.5.1. API 1.6.0 removed it.',
			displayOptions: { show: { apiVersion: ['1.5.0', '1.5.1'], resource: ['order'], operation: ['get'] } },
		},
		fieldsProperty('Event fields', eventFields, show('event', ['get', 'getMany'])),
		fieldsProperty('Order fields', orderFields, show('order', ['getMany', 'getManyByPresentation'])),
		fieldsProperty('Participant fields', participantFields, show('participant', ['get', 'getMany', 'getManyByOrder'])),
		fieldsProperty(
			'Participant fields',
			participantShortFields,
			show('participant', ['getByTicketNumber', 'getManyByPresentation']),
		),
		fieldsProperty('Presentation fields', presentationFields, show('presentation', ['get', 'getMany'])),
		{
			displayName: 'Item ID',
			name: 'qrItemId',
			type: 'string',
			default: '',
			required: true,
			description: 'QR field itemId',
			displayOptions: {
				show: { apiVersion: ['1.5.1', '1.6.0'], resource: ['participant'], operation: ['checkInByQrCode'] },
			},
		},
		{
			displayName: 'Signature',
			name: 'qrSignature',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'QR field signature, 130 to 132 characters',
			displayOptions: {
				show: { apiVersion: ['1.5.1', '1.6.0'], resource: ['participant'], operation: ['checkInByQrCode'] },
			},
		},
		{
			displayName: 'Timestamp',
			name: 'qrTimestamp',
			type: 'string',
			default: '',
			required: true,
			description: 'QR field timestamp as an integer',
			displayOptions: {
				show: { apiVersion: ['1.5.1', '1.6.0'], resource: ['participant'], operation: ['checkInByQrCode'] },
			},
		},
		{
			displayName: 'QR Version',
			name: 'qrVersion',
			type: 'string',
			default: '',
			required: true,
			description: 'QR field version',
			displayOptions: {
				show: { apiVersion: ['1.5.1', '1.6.0'], resource: ['participant'], operation: ['checkInByQrCode'] },
			},
		},
		{
			displayName: 'Wallet ID',
			name: 'qrWalletId',
			type: 'string',
			default: '',
			required: true,
			description: 'QR field walletId',
			displayOptions: {
				show: { apiVersion: ['1.5.1', '1.6.0'], resource: ['participant'], operation: ['checkInByQrCode'] },
			},
		},
		{
			displayName: 'Include Envelope',
			name: 'includeEnvelope',
			type: 'boolean',
			default: false,
			description: 'Whether to return the raw JSON page instead of one item per record',
		},
	];
}

function participantOperations(includeQr: boolean): INodeProperties['options'] {
	const options: INodeProperties['options'] = [
		{ name: 'Check In', value: 'checkIn', action: 'Check in a participant', description: 'Checks in one participant by ID. This writes attendance.' },
		{
			name: 'Check In by Ticket Number',
			value: 'checkInByTicketNumber',
			action: 'Check in by ticket number',
			description: 'Checks in one participant by ticket number. This writes attendance.',
		},
		{ name: 'Get', value: 'get', action: 'Get a participant', description: 'Gets one participant by ID' },
		{
			name: 'Get by Ticket Number',
			value: 'getByTicketNumber',
			action: 'Get a participant by ticket number',
			description: 'Gets one participant by ticket number',
		},
		{ name: 'Get Many', value: 'getMany', action: 'Get many participants', description: 'Lists participants of one event' },
		{
			name: 'Get Many by Order',
			value: 'getManyByOrder',
			action: 'Get many participants by order',
			description: 'Lists participants of one order. The API requires fields.',
		},
		{
			name: 'Get Many by Presentation',
			value: 'getManyByPresentation',
			action: 'Get many participants by presentation',
			description: 'Lists participants of one presentation',
		},
	];
	if (includeQr) {
		options.splice(1, 0, {
			name: 'Check In by QR Code',
			value: 'checkInByQrCode',
			action: 'Check in by QR code',
			description: 'Checks in with the QR payload. Absent from API 1.5.0. This writes attendance.',
		});
	}
	return options;
}

function orderLocator(displayOptions: INodeProperties['displayOptions'], description: string): INodeProperties {
	return {
		displayName: 'Order ID',
		name: 'orderId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description,
		displayOptions,
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchOrders', searchable: true },
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'Order sk',
			},
		],
	};
}

function fieldsProperty(
	displayName: string,
	options: Array<{ name: string; value: string }>,
	displayOptions: INodeProperties['displayOptions'],
): INodeProperties {
	return {
		displayName,
		name: 'fields',
		type: 'multiOptions',
		default: [],
		description: 'Response fields. An empty selection omits fields, except on participants by order, where the API requires it.',
		options,
		displayOptions,
	};
}

export const parameterNames = [
	'apiVersion',
	'eventId',
	'presentationId',
	'orderId',
	'participantId',
	'ticketNumber',
	'returnAll',
	'limit',
	'maxPages',
	'pageSize',
	'page',
	'cursor',
	'published',
	'presentationPublished',
	'filterOnlineSector',
	'timezone',
	'sort',
	'fieldSort',
	'from',
	'to',
	'cancelledFilter',
	'buyerEmail',
	'orderStatus',
	'participantEmail',
	'ticketNumberFilter',
	'fields',
	'qrItemId',
	'qrSignature',
	'qrTimestamp',
	'qrVersion',
	'qrWalletId',
	'includeEnvelope',
] as const;

export const locatorNames = new Set(['eventId', 'presentationId', 'orderId', 'participantId', 'ticketNumber']);
