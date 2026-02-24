import fs from "fs";
import csv from "csv-parser";
import { UserCsvRow, User } from "../types";
import { parseUser } from "../validators";
import { logger, metrics } from "../infraestructure";
import { validateInWorker, writeProcessedUsers } from "../services";

const BATCH_SIZE = 100;

export async function processCsv(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const allUsers: User[] = [];
    const invalidRecords: { raw: UserCsvRow; errors: string[] }[] = [];
    const validationPromises: Promise<void>[] = [];
    let processed = 0;

    const stream = fs.createReadStream(filePath).pipe(csv());

    stream.on("data", (row: UserCsvRow) => {
      const result = parseUser(row);

      if (!result.success) {
        invalidRecords.push({ raw: result.raw, errors: result.errors });
        metrics.incrementProcessed();
        metrics.incrementInvalid();
        return;
      }

      const user = result.data;
      allUsers.push(user);

      const p = validateInWorker(user).then((isValid) => {
        metrics.incrementProcessed();
        if (isValid) {
          metrics.incrementValid();
        } else {
          metrics.incrementInvalid();
        }

        processed++;
        if (processed % BATCH_SIZE === 0) {
          logger.info({ processed, total: allUsers.length }, "Progreso");
        }
      });

      validationPromises.push(p);
    });

    stream.on("end", async () => {
      try {
        await Promise.all(validationPromises);

        const { validFile, invalidFile } = await writeProcessedUsers(allUsers, invalidRecords);

        if (invalidFile) {
          logger.warn({ file: invalidFile, count: invalidRecords.length }, "Registros inválidos guardados");
        }

        logger.info({
          ...metrics.snapshot(),
          file: validFile,
          invalidParsed: invalidRecords.length,
        }, "Procesamiento de CSV finalizado");

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", (error) => {
      logger.error({ error, message: "Error al procesar el CSV" });
      reject(error);
    });
  });
}



/* 
 Versión sin optimización de concurrencia, para comparar tiempos de ejecución:
*/ 
// const BATCH_SIZE = 100;

// export async function processCsv(filePath: string): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const allUsers: User[] = [];
//     let batch: User[] = [];
//     let valid = 0;
//     let invalid = 0;

//     const stream = fs.createReadStream(filePath).pipe(csv());

//     const invalidRecords: { raw: UserCsvRow; errors: string[] }[] = [];

//     stream.on("data", async (row: UserCsvRow) => {
//       stream.pause();

//       const result = parseUser(row);
//       if (result.success) {
//         allUsers.push(result.data);
//         batch.push(result.data);
//         valid++;
//       } else {
//         invalidRecords.push({ raw: result.raw, errors: result.errors });
//         logger.warn({ raw: result.raw, errors: result.errors }, "Registro inválido");
//         invalid++;
//       }

//       if (batch.length === BATCH_SIZE) {
//         logger.info({ batchSize: batch.length, totalSoFar: allUsers.length }, "Batch procesado");
//         batch = [];
//       }

//       stream.resume();
//     });

//     stream.on("end", async () => {
//       if (batch.length) {
//         logger.info({ batchSize: batch.length, totalSoFar: allUsers.length }, "Último batch procesado");
//       }

//       const timestamp = Date.now();
//       const jsonFilePath = `processed_users_${timestamp}.json`;
//       await fs.promises.writeFile(jsonFilePath, JSON.stringify(allUsers, null, 2));

//       if (invalidRecords.length > 0) {
//         const invalidFilePath = `invalid_users_${timestamp}.json`;
//         await fs.promises.writeFile(invalidFilePath, JSON.stringify(invalidRecords, null, 2));
//         logger.warn({ file: invalidFilePath, count: invalidRecords.length }, "Registros inválidos guardados");
//       }

//       logger.info({
//         file: jsonFilePath,
//         validUsers: valid,
//         invalidUsers: invalid,
//         total: allUsers.length,
//       }, "Procesamiento de CSV finalizado");

//       resolve();
//     });

//     stream.on("error", (error) => {
//       logger.error({ error, message: "Error al procesar el CSV" });
//       reject(error);
//     });
//   });
// }


