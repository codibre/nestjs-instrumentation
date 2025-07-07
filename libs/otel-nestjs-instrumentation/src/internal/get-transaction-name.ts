import { ExecutionContext } from '@nestjs/common';

/**
 * Get a descriptive transaction name from the NestJS execution context.
 * Formats it as 'ControllerName.methodName' for better trace organization.
 *
 * @param context - The NestJS execution context
 * @returns A formatted transaction name string
 *
 * @internal
 */
export function getTransactionName(context: ExecutionContext): string {
	try {
		const controllerClass = context.getClass();
		const handlerMethod = context.getHandler();

		const controllerName = controllerClass?.name || 'UnknownController';
		const methodName = handlerMethod?.name || 'unknownMethod';

		return `${controllerName}.${methodName}`;
	} catch {
		// Fallback if context extraction fails
		return 'UnknownTransaction';
	}
}
