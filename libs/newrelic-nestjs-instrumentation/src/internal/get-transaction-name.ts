import { ExecutionContext } from '@nestjs/common';

export function getTransactionName(context: ExecutionContext) {
	const handler = context.getHandler();
	const controller = context.getClass();
	const transactionName = `${controller.name}.${handler.name}`;
	return transactionName;
}
