// api/matter-events.ts
// Vercel Serverless Function for managing matter events in core.matter_events
// Uses service-role privileges so staff / associates can record, edit, and delete matter events / milestones
// without being blocked by table-level RLS policy restrictions on the shared core schema.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-lextria-app');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key is not configured.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. POST: Insert new matter event
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const {
        project_code_id,
        event_code,
        title,
        detail,
        occurred_at,
        actor_user_id,
        source_app = 'LITIGATOR',
        client_visible = false,
        client_label,
        metadata = {},
      } = body;

      if (!project_code_id || !title) {
        return res.status(400).json({ error: 'Missing required fields: project_code_id and title.' });
      }

      const insertPayload: Record<string, any> = {
        project_code_id,
        event_code: event_code || null,
        title,
        detail: detail || null,
        occurred_at: occurred_at || new Date().toISOString(),
        actor_user_id: actor_user_id || null,
        source_app,
        client_visible: Boolean(client_visible),
        client_label: client_label || null,
        metadata: metadata || {},
      };

      let { data, error } = await supabase
        .schema('core')
        .from('matter_events')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error && error.message && error.message.includes('matter_events_event_code_fkey')) {
        insertPayload.event_code = null;
        const retry = await supabase
          .schema('core')
          .from('matter_events')
          .insert(insertPayload)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      return res.status(201).json({ success: true, event: data });
    } catch (err: any) {
      console.error('API matter-events POST error:', err);
      return res.status(500).json({ error: err.message || 'Failed to record matter event.' });
    }
  }

  // 2. PUT / PATCH: Update existing matter event
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const { id, title, detail, occurred_at, event_code, client_label, metadata } = body;
      const eventId = id || req.query.id;

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid event id.' });
      }

      const payload: Record<string, any> = {};
      if (title !== undefined) payload.title = title;
      if (detail !== undefined) payload.detail = detail;
      if (occurred_at !== undefined) payload.occurred_at = occurred_at;
      if (event_code !== undefined) payload.event_code = event_code || null;
      if (client_label !== undefined) payload.client_label = client_label;
      if (metadata !== undefined) payload.metadata = metadata;

      let { data, error } = await supabase
        .schema('core')
        .from('matter_events')
        .update(payload)
        .eq('id', eventId)
        .select('*')
        .single();

      if (error && error.message && error.message.includes('matter_events_event_code_fkey')) {
        payload.event_code = null;
        const retry = await supabase
          .schema('core')
          .from('matter_events')
          .update(payload)
          .eq('id', eventId)
          .select('*')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      return res.status(200).json({ success: true, event: data });
    } catch (err: any) {
      console.error('API matter-events PUT error:', err);
      return res.status(500).json({ error: err.message || 'Failed to update matter event.' });
    }
  }

  // 3. DELETE: Remove matter event
  if (req.method === 'DELETE') {
    const { id } = req.body || req.query || {};
    const eventId = id || req.query.id;

    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid event id.' });
    }

    try {
      const { error } = await supabase
        .schema('core')
        .from('matter_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      return res.status(200).json({ success: true, message: 'Matter event deleted successfully.' });
    } catch (err: any) {
      console.error('API matter-events DELETE error:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete matter event.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
