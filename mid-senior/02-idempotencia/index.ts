import { bootstrap } from "./src/config/bootstrap";

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
