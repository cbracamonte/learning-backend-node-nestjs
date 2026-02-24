import { User, UserCsvRow} from '../types';
import { userSchema } from '../schemas';

type ParseResult =
  | { success: true; data: User }
  | { success: false; raw: UserCsvRow; errors: string[] };

export function parseUser(row: UserCsvRow): ParseResult {
    const user = {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        age: parseInt(row.age, 10),
        salary: parseFloat(row.salary)
    };

    const result = userSchema.safeParse(user);

    if (!result.success) {
        const errors = result.error.issues.map(
            (issue) => `[${issue.path.join('.')}] ${issue.message}`
        );
        return { success: false, raw: row, errors };
    }

    return { success: true, data: result.data };
}

