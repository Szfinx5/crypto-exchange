"use client";
import { formOptions, useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { useState } from "react";
import { z } from "zod";
import { type RouterInputs, api } from "~/trpc/react";

type OrderFormValues = RouterInputs["order"]["create"];

export default function OrderPage() {
	const [output, setOutput] = useState<string[]>([]);

	const {
		mutate: createOrder,
		isPending,
		isError,
		error,
		isSuccess,
	} = api.order.create.useMutation({
		onSuccess: () => {
			setOutput((prev) => [...prev, "Order submitted successfully!"]);
		},
		onError: (err) => {
			setOutput((prev) => [...prev, `Error: ${err.message}`]);
		},
	});

	const formOpts = formOptions<OrderFormValues>({
		defaultValues: {
			userId: crypto.randomUUID(),
			price: 100_000,
			quantity: 1,
			side: "buy",
			market: "BTC-USDT",
		},
	});

	const form = useForm({
		...formOpts,
		onSubmit: async (values) => {
			if (values.value.price === 0 || values.value.quantity === 0) {
				setOutput((prev) => [
					...prev,
					"Error: Price and quantity must be greater than 0",
				]);
				return;
			}
			createOrder(values.value);
		},
	});

	return (
		<div className="font-mono text-green-400">
			<h1 className="text-xl mb-4 text-yellow-400">Place Order</h1>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					void form.handleSubmit();
				}}
				className="space-y-4"
			>
				<div>
					<form.Field
						name="userId"
						children={(field) => (
							<input type="hidden" value={field.state.value} />
						)}
					/>
					<label htmlFor="price" className="block mb-1">
						$ set_price
					</label>
					<form.Field
						name="price"
						validatorAdapter={zodValidator()}
						validators={{
							onChange: z.number().positive("Price must be greater than 0"),
						}}
						children={(field) => (
							<>
								<input
									id="price"
									type="number"
									value={field.state.value}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									className="w-full p-1 bg-black border border-green-400 text-green-400 focus:outline-none focus:border-yellow-400"
								/>
								{field.state.meta.errors?.[0] && (
									<div className="text-red-500 text-sm mt-1">
										$ {field.state.meta.errors[0]}
									</div>
								)}
							</>
						)}
					/>
				</div>

				<div>
					<label htmlFor="quantity" className="block mb-1">
						$ set_quantity
					</label>
					<form.Field
						name="quantity"
						validatorAdapter={zodValidator()}
						validators={{
							onChange: z.number().positive("Quantity must be greater than 0"),
						}}
						children={(field) => (
							<>
								<input
									id="quantity"
									type="number"
									value={field.state.value}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									className="w-full p-1 bg-black border border-green-400 text-green-400 focus:outline-none focus:border-yellow-400"
								/>
								{field.state.meta.errors?.[0] && (
									<div className="text-red-500 text-sm mt-1">
										$ {field.state.meta.errors[0]}
									</div>
								)}
							</>
						)}
					/>
				</div>

				<div>
					<label htmlFor="side" className="block mb-1">
						$ set_side
					</label>
					<form.Field
						name="side"
						children={(field) => (
							<select
								id="side"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as "buy" | "sell")
								}
								className="w-full p-1 bg-black border border-green-400 text-green-400 focus:outline-none focus:border-yellow-400"
							>
								<option value="buy">buy</option>
								<option value="sell">sell</option>
							</select>
						)}
					/>
				</div>

				<div>
					<label htmlFor="market" className="block mb-1">
						$ set_market
					</label>
					<form.Field
						name="market"
						children={(field) => (
							<input
								id="market"
								type="text"
								value={field.state.value}
								disabled
								className="w-full p-1 bg-black border border-green-400 text-green-400 opacity-50 cursor-not-allowed"
							/>
						)}
					/>
				</div>

				<button
					type="submit"
					disabled={isPending}
					className="w-full p-2 bg-green-400 text-black hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
				>
					$ {isPending ? "submitting_order..." : "submit_order"}
				</button>
			</form>

			{output.length > 0 && (
				<div className="mt-4 p-2 border border-green-400">
					<h2 className="text-yellow-400 mb-2">Output:</h2>
					{output.map((line, index) => (
						<div
							key={`${line.slice(0, 10)}-${index}`}
							className="text-green-400"
						>
							$ {line}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
