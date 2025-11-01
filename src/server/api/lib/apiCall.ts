import { z } from "zod";

class ApiError extends Error {
	constructor(
		public statusCode: number,
		message: string,
		public errorJson?: string,
	) {
		super(message);
		this.name = "ApiError";
		this.statusCode = statusCode;
		this.message = message;
		this.errorJson = errorJson;
	}
}

export async function apiCall<TRequest, TResponse>(
	url: string,
	method: "GET" | "POST" | "PUT" | "DELETE",
	schema: z.ZodType<TResponse>,
	data?: TRequest,
): Promise<TResponse> {
	try {
		const response = await fetch(url, {
			method,
			headers: {
				"Content-Type": "application/json",
			},
			body: data ? JSON.stringify(data) : undefined,
		});

		if (!response.ok) {
			const errorMessage = await response.json();
			throw new ApiError(
				response.status,
				`HTTP error! status: ${response.status}`,
				JSON.stringify(errorMessage),
			);
		}

		const responseData = await response.json();
		return schema.parse(responseData);
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		if (error instanceof z.ZodError) {
			console.error(error);
			throw new ApiError(
				400,
				`Validation error: ${error.message}`,
				JSON.stringify(error.errors),
			);
		}
		if (error instanceof Error) {
			throw new ApiError(
				500,
				`Unexpected error: ${error.message}`,
				JSON.stringify(error),
			);
		}
		throw new ApiError(500, "An unknown error occurred");
	}
}
