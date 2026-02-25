import { z } from "zod";

export const userSchema = z.object({
  id: z.number(),
  name: z.string().min(1, "Name cannot be empty"),
  email: z.email("Invalid email address"),
  age: z.number().int().positive("Age must be a positive integer").min(18, "User must be at least 18 years old"),
  salary: z.number().positive("Salary must be a positive number"),
});
