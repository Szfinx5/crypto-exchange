import "./index.ts";

console.log("Workers started. Press Ctrl+C to stop.");
process.on("SIGINT", () => {
	console.log("Received SIGINT, shutting down gracefully...");
	process.exit(0);
});
process.on("SIGTERM", () => {
	console.log("Received SIGTERM, shutting down gracefully...");
	process.exit(0);
});
