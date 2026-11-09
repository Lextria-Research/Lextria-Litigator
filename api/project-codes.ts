// api/project-codes.ts
// Vercel Serverless Function for updating project codes across core.project_codes
// Uses service-role privileges so staff / associates can update matter codes
// without being blocked by RLS policies on the shared core schema.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-lextria-app');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key is not configured.' });
  }

  const { projectCodeId, newCode, title } = req.body || {};

  if (!projectCodeId || typeof projectCodeId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid projectCodeId.' });
  }

  const cleanCode = (newCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return res.status(400).json({ error: 'Matter code cannot be empty.' });
  }

  const normClean = cleanCode.replace(/\s+/g, '');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch current project code
    const { data: currentPc, error: currentErr } = await supabase
      .schema('core')
      .from('project_codes')
      .select('id, code, title')
      .eq('id', projectCodeId)
      .maybeSingle();

    if (currentErr) throw currentErr;
    if (!currentPc) {
      return res.status(404).json({ error: 'Project code record not found.' });
    }

    const currentCode = currentPc.code?.trim().toUpperCase();

    // 2. Check collision if code actually changed
    if (cleanCode !== currentCode) {
      const { data: existing, error: checkErr } = await supabase
        .schema('core')
        .from('project_codes')
        .select('id, code')
        .eq('code_normalized', normClean)
        .neq('id', projectCodeId)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existing) {
        return res.status(400).json({
          error: `Matter code "${cleanCode}" is already in use by another matter.`,
        });
      }

      // 3. Update project_codes (omit code_normalized - PostgreSQL generates it)
      const updatePayload: Record<string, any> = { code: cleanCode };
      if (title !== undefined) updatePayload.title = title;

      const { data: updatedPc, error: updateErr } = await supabase
        .schema('core')
        .from('project_codes')
        .update(updatePayload)
        .eq('id', projectCodeId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      // 4. Sync quotation quote_number if default format Q-<oldCode> was used
      if (currentCode) {
        try {
          await supabase
            .schema('finance')
            .from('quotations')
            .update({ quote_number: `Q-${cleanCode}` })
            .eq('project_code_id', projectCodeId)
            .eq('quote_number', `Q-${currentCode}`);
        } catch (qErr) {
          console.warn('Could not sync quotation number on code update:', qErr);
        }
      }

      return res.status(200).json({ success: true, projectCode: updatedPc });
    } else {
      // Code is identical, update title if provided and different
      if (title !== undefined && title !== currentPc.title) {
        const { data: updatedPc, error: updateErr } = await supabase
          .schema('core')
          .from('project_codes')
          .update({ title })
          .eq('id', projectCodeId)
          .select('*')
          .single();

        if (updateErr) throw updateErr;
        return res.status(200).json({ success: true, projectCode: updatedPc });
      }

      return res.status(200).json({ success: true, projectCode: currentPc });
    }
  } catch (err: any) {
    console.error('API project-codes error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update matter code.' });
  }
}
