"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [{ name: "Order", path: "/" }];

export function Navigation() {
	const pathname = usePathname();

	return (
		<div className="mb-4">
			{navItems.map((item) => (
				<Link
					key={item.path}
					href={item.path}
					className={`mr-4 ${
						pathname === item.path ? "text-yellow-400" : "text-green-400"
					}`}
				>
					{pathname === item.path ? ">" : "$"} {item.name}
				</Link>
			))}
		</div>
	);
}
