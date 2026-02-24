import fs from "fs";
import { User } from "../types";
import { UserCsvRow } from "../types";

type InvalidRecord = {
  raw: UserCsvRow;
  errors: string[];
};

type WriteResult = {
  validFile: string;
  invalidFile?: string;
};

export async function writeProcessedUsers(
  users: User[],
  invalidRecords: InvalidRecord[],
  timestamp: number = Date.now()
): Promise<WriteResult> {
  const validFile = `processed_users_${timestamp}.json`;
  await fs.promises.writeFile(validFile, JSON.stringify(users, null, 2));

  let invalidFile: string | undefined;

  if (invalidRecords.length > 0) {
    invalidFile = `invalid_users_${timestamp}.json`;
    await fs.promises.writeFile(invalidFile, JSON.stringify(invalidRecords, null, 2));
  }

  return { validFile, invalidFile };
}
