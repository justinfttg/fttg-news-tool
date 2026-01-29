import { createClient } from '@supabase/supabase-js';
import { cors } from './_cors';

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return;

  try {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    const sb = createClient(url, key);
    const { data, error } = await sb.from('users').select('id').limit(1);
    return res.status(200).json({
      status: 'ok',
      supabase: error ? `error: ${error.message}` : 'connected',
      userCount: data?.length ?? 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
