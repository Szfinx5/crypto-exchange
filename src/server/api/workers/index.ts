import "./exchangePostingWorker.ts";
import "./executeTransactionsWorker.ts";
import chalk from "chalk";

// When this file is run, both workers are started automatically
console.log(chalk.yellow("BullMQ workers started (posting + transactions)."));
