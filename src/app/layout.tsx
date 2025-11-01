import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { Navigation } from "./_components/Navigation";

export const metadata: Metadata = {
	title: "Apex Exchange Order Monitor",
	description: "A simple order monitor for the Apex Exchange",
	icons: [{ rel: "icon", url: "/favicon.png" }],
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${GeistSans.variable}`}>
			<body className="bg-black text-green-400 p-4">
				<TRPCReactProvider>
					<div className="max-w-7xl mx-auto font-mono">
						<div className="mb-4">
							<span className="text-yellow-400">user@exchange:</span>
							<span className="text-blue-400">~/order-monitor</span>
							<span className="text-green-400"> ./monitor.sh</span>
						</div>
						<Navigation />
						<main>{children}</main>
					</div>
				</TRPCReactProvider>
			</body>
		</html>
	);
}
