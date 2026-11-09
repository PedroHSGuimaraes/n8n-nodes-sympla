export class SymplaInputError extends Error {
	readonly name = 'SymplaInputError';

	constructor(message: string) {
		super(message);
	}
}

export function text(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '';
}

export function requiredText(value: unknown, label: string): string {
	const parsed = text(value);
	if (!parsed) throw new SymplaInputError(`${label} é obrigatório.`);
	if (parsed.includes('/') || parsed.includes('?') || parsed.includes('#')) {
		throw new SymplaInputError(`${label} não pode alterar o caminho da URL.`);
	}
	return parsed;
}

export function optionalText(value: unknown): string | undefined {
	const parsed = text(value);
	return parsed === '' ? undefined : parsed;
}

export function integerInRange(value: unknown, label: string, min: number, max: number, fallback: number): number {
	if (value === undefined || value === null || value === '') return fallback;
	const parsed = typeof value === 'number' ? value : Number(text(value));
	if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
		throw new SymplaInputError(`${label} precisa ser um inteiro entre ${min} e ${max}.`);
	}
	return parsed;
}

export function stringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => text(item)).filter((item) => item !== '');
	}
	const single = text(value);
	if (!single) return [];
	return single.split(',').map((item) => item.trim()).filter((item) => item !== '');
}

export function versionOf(value: unknown): '1.5.0' | '1.5.1' | '1.6.0' {
	const parsed = text(value) || '1.6.0';
	if (parsed === '1.5.0' || parsed === '1.5.1' || parsed === '1.6.0') return parsed;
	throw new SymplaInputError('API Version precisa ser 1.5.0, 1.5.1 ou 1.6.0.');
}
