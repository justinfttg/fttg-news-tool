import { Request, Response } from 'express';
import { z } from 'zod';
import { registerUser } from '../../src/services/auth/auth.service';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  orgId: z.string().uuid().optional(),
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input.email, input.password, input.orgId);
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(400).json({ error: message });
  }
}
