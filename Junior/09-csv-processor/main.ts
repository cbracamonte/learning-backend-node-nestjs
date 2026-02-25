import { processCsv } from "./src/processors";
import { shutdownPool } from "./src/services";

async function main(){
    await processCsv("users_10000.csv");
    await shutdownPool();
}

main().catch(console.error);