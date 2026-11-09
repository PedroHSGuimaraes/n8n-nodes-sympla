import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
} from 'n8n-workflow';

import { redactText, SymplaApiError, type CallOptions, type RawResponse } from '../Sympla/api/transport';
import { emptyMemory, runPoll, watchOf, type PollMemory } from '../Sympla/api/poll';
import { integerInRange, SymplaInputError } from '../Sympla/api/values';
import { listSearch } from '../Sympla/methods';

const expressionHint =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

export class SymplaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sympla Trigger',
		name: 'symplaTrigger',
		icon: { light: 'file:sympla.svg', dark: 'file:sympla.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["watch"]}}',
		description: 'Polls Sympla for new orders, participants, or check-ins. The public API has no webhook.',
		defaults: { name: 'Sympla Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'symplaApi', required: true }],
		codex: {
			categories: ['Productivity'],
			resources: {
				primaryDocumentation: [{ url: 'https://developers.sympla.com.br/api-doc/' }],
			},
		},
		properties: [
			{
				displayName:
					'This trigger polls the public API on the workflow schedule. Sympla does not publish a webhook, and this node does not register one. The first active poll stores a watermark and emits nothing. Later active polls emit only records newer than that watermark. A manual test returns the current page and does not move the watermark. Check-ins are participants whose checkin field is present; the API has no check-in feed, and from filters ticket_updated_at.',
				name: 'noticePolling',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'API Version',
				name: 'apiVersion',
				type: 'options',
				default: '1.6.0',
				noDataExpression: true,
				description: 'Published contract version. 1.6.0 uses cursor pagination. 1.5.x uses page pagination.',
				options: [
					{ name: 'Version 1.5.0', value: '1.5.0' },
					{ name: 'Version 1.5.1', value: '1.5.1' },
					{ name: 'Version 1.6.0', value: '1.6.0' },
				],
			},
			{
				displayName: 'Event Name or ID',
				name: 'eventId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: expressionHint,
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
					},
				],
			},
			{
				displayName: 'Watch',
				name: 'watch',
				type: 'options',
				default: 'orders',
				noDataExpression: true,
				description:
					'Orders use order_date. Participants use ticket_created_at. Check-ins use ticket_updated_at and the checkin field.',
				options: [
					{ name: 'Check Ins', value: 'checkIns', description: 'Participants with a check-in, newest update first' },
					{ name: 'Orders', value: 'orders', description: 'Orders of the event, newest order date first' },
					{ name: 'Participants', value: 'participants', description: 'Participants of the event, newest ticket first' },
				],
			},
			{
				displayName: 'Timezone',
				name: 'timezone',
				type: 'string',
				default: 'America/Sao_Paulo',
				description: 'IANA timezone sent as timezone. The API default is America/Sao_Paulo.',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 200 },
				default: 100,
				description: 'Items requested in page_size. Orders accept at most 200. Participant lists accept at most 500; this trigger stays at 200.',
			},
			{
				displayName: 'Max Pages',
				name: 'maxPages',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 10,
				description:
					'Fails the poll when the watermark is still ahead after this many requests. The watermark is not moved and nothing is emitted.',
			},
			{
				displayName: 'Manual Limit',
				name: 'manualLimit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 20,
				description: 'How many current records a manual test returns. Active polls ignore it and do not drop newer records to fit a limit.',
			},
		],
	};

	methods = { listSearch: { searchEvents: listSearch.searchEvents } };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		try {
			const credentials = await this.getCredentials('symplaApi');
			const watch = watchOf(this.getNodeParameter('watch'));
			const manual = this.getMode() === 'manual';
			const stored = this.getWorkflowStaticData('node');
			const memory = memoryOf(stored);
			const result = await runPoll({
				call: async (options: CallOptions): Promise<RawResponse> => {
					const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'symplaApi', {
						method: options.method as IHttpRequestMethods,
						url: options.url,
						qs: options.qs,
						body: options.body as IHttpRequestOptions['body'],
						json: options.json,
						timeout: options.timeout,
						returnFullResponse: true,
						ignoreHttpStatusErrors: true,
					})) as RawResponse;
					return {
						statusCode: response.statusCode,
						headers: response.headers ?? {},
						body: response.body,
					};
				},
				sleep,
				baseUrl: String(credentials.baseUrl ?? ''),
				apiVersion: this.getNodeParameter('apiVersion'),
				eventId: this.getNodeParameter('eventId', '', { extractValue: true }),
				watch,
				timezone: this.getNodeParameter('timezone'),
				pageSize: this.getNodeParameter('pageSize'),
				maxPages: integerInRange(this.getNodeParameter('maxPages'), 'Max Pages', 1, 1000, 10),
				manualLimit: integerInRange(this.getNodeParameter('manualLimit'), 'Manual Limit', 1, 10000, 20),
				memory,
				manual,
				budgetMs: this.getPollBudgetMs(),
			});
			if (!manual) {
				stored.ready = result.memory.ready;
				stored.watermark = result.memory.watermark;
				stored.seen = result.memory.seen;
			}
			if (result.items.length === 0) return null;
			return [result.items.map((item) => ({ json: jsonOf(item) }))];
		} catch (error) {
			const message = failureMessage(error);
			if (error instanceof SymplaInputError || error instanceof NodeOperationError) {
				throw new NodeOperationError(this.getNode(), message);
			}
			throw new NodeApiError(this.getNode(), { message }, { message });
		}
	}
}

function memoryOf(stored: IDataObject): PollMemory {
	const seen = Array.isArray(stored.seen) ? stored.seen.filter((item): item is string => typeof item === 'string') : [];
	if (stored.ready !== true) return emptyMemory();
	return {
		ready: true,
		watermark: typeof stored.watermark === 'string' ? stored.watermark : '',
		seen,
	};
}

function jsonOf(item: unknown): IDataObject {
	if (item && typeof item === 'object' && !Array.isArray(item)) return item as IDataObject;
	return { data: item as IDataObject['data'] };
}

function failureMessage(error: unknown): string {
	if (error instanceof SymplaApiError || error instanceof SymplaInputError) return error.message;
	if (error instanceof Error) return redactText(error.message);
	return 'Falha ao consultar a Sympla.';
}
