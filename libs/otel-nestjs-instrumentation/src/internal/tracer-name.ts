/**
 * Try to get package name dynamically for better tracer naming
 */
function getTracerName(): string {
	try {
		// Try to read package.json from the current working directory
		const fs = require('fs') as typeof import('fs');
		const path = require('path') as typeof import('path');
		const packageJsonPath = path.resolve(process.cwd(), 'package.json');
		const packageJson = JSON.parse(
			fs.readFileSync(packageJsonPath, 'utf-8'),
		) as { name?: string };
		return packageJson.name ?? '@codibre/otel-nestjs-instrumentation';
	} catch {
		// If we can't read package.json, use fallback
		return '@codibre/otel-nestjs-instrumentation';
	}
}
export const tracerName = getTracerName();
