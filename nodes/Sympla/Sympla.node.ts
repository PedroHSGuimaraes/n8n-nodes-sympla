import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	sleep,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { buildRequest } from './api/buildRequest';
import { redactText, performRequest, SymplaApiError, type CallOptions, type RawResponse } from './api/transport';
import { SymplaInputError } from './api/values';
import { buildNodeProperties, locatorNames, parameterNames } from './description/properties';
import { listSearch } from './methods';

export class Sympla implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sympla',
		name: 'sympla',
		icon: { light: 'file:sympla.svg', dark: 'file:sympla.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Reads events, orders, participants, and presentations from the Sympla public API, and can check in a ticket.',
		defaults: { name: 'Sympla' },
		usableAsTool: {
			replacements: {
				description:
					'Sympla public API tool. Prefer read operations. Check-in writes attendance and must run only after a person confirms. The public contract does not publish a rate limit or a webhook. Use API version 1.6.0 unless a legacy client requires 1.5.x.',
			},
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'symplaApi', required: true }],
		codex: {
			categories: ['Productivity', 'Data & Storage'],
			resources: {
				primaryDocumentation: [{ url: 'https://developers.sympla.com.br/api-doc/' }],
			},
		},
		properties: buildNodeProperties(),
	};

	methods = { listSearch };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('symplaApi');
		const call = async (options: CallOptions): Promise<RawResponse> => {
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
		};

		for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const saved = this.getNode().parameters;
				const params: Record<string, unknown> = {};
				for (const name of parameterNames) {
					if (!(name in saved)) continue;
					params[name] = this.getNodeParameter(name, itemIndex, '', {
						extractValue: locatorNames.has(name),
					});
				}
				const request = buildRequest(resource, operation, params);
				const result = await performRequest({
					call,
					sleep,
					baseUrl: String(credentials.baseUrl ?? ''),
					request,
				});
				for (const item of result.items) {
					const json =
						item && typeof item === 'object' && !Array.isArray(item)
							? (item as IDataObject)
							: { data: item as IDataObject['data'] };
					returnData.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				const message = failureMessage(error);
				if (this.continueOnFail()) {
					returnData.push({ json: { message }, pairedItem: { item: itemIndex } });
					continue;
				}
				if (error instanceof SymplaInputError || error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), message, { itemIndex });
				}
				throw new NodeApiError(this.getNode(), { message }, { itemIndex, message });
			}
		}
		return [returnData];
	}
}

function failureMessage(error: unknown): string {
	if (error instanceof SymplaApiError || error instanceof SymplaInputError) return error.message;
	if (error instanceof Error) return redactText(error.message);
	return 'Falha ao executar a Sympla.';
}
