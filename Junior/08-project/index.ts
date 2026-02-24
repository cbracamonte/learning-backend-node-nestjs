import { bootstrap } from "./src/app";


bootstrap().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});