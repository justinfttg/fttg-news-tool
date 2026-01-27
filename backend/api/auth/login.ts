import { Request, Response } from 'express';
import { z } from 'zod';
import { loginUser } from '../../src/services/auth/auth.service';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const input = LoginSchema.parse(req.body);
    const result = await loginUser(input.email, input.password);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(401).json({ error: message });
  }
}
