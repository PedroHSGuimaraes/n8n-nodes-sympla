import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class SymplaApi implements ICredentialType {
	name = 'symplaApi';
	displayName = 'Sympla API';
	documentationUrl = 'https://developers.sympla.com.br/api-doc/';
	icon: Icon = { light: 'file:sympla.svg', dark: 'file:sympla.dark.svg' };
	httpRequestNode = {
		name: 'Sympla',
		docsUrl: 'https://developers.sympla.com.br/api-doc/',
		apiBaseUrl: 'https://api.sympla.com.br/public',
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Access token from Minha Conta, Integrações. It is sent in the s_token header. The value is omitted from error messages.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.sympla.com.br/public',
			required: true,
			description:
				'Official public API base. HTTPS only. The credential test calls read-only GET /v1.6.0/events with published=all and page_size=1.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				s_token: '={{$credentials.token}}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1.6.0/events',
			method: 'GET',
			qs: {
				published: 'all',
				timezone: 'America/Sao_Paulo',
				sort: 'asc',
				page_size: 1,
			},
		},
	};
}
