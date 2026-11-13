// api/matter-events.ts
// Vercel Serverless Function for managing matter events in core.matter_events
// Uses service-role privileges so staff / associates can delete matter events / milestones
// without being blocked by table-level grant restrictions on the shared core schema.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-lextria-app');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key is not configured.' });
  }

  const { id } = req.body || req.query || {};
  const eventId = id || req.query.id;

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid event id.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { error } = await supabase
      .schema('core')
      .from('matter_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Matter event deleted successfully.' });
  } catch (err: any) {
    console.error('API matter-events error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete matter event.' });
  }
}
