/**
 * 04 - LIBUV E I/O INTERNO
 *
 * Vamos a demostrar cómo funciona el thread pool interno.
 */

import { pbkdf2 } from "crypto";

const start = Date.now();

function runCryptoTask(id: number) {
  pbkdf2("password", "salt", 100000, 512, "sha512", () => {
    console.log(`Task ${id} terminada en ${Date.now() - start}ms`);
  });
}

for (let i = 1; i <= 4; i++) {
  console.log(`Iniciando task ${i}...`);
  runCryptoTask(i);
}
