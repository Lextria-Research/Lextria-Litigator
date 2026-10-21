// api/users.ts
// Vercel Serverless Function for User Management & Team Access Control
// Strictly enforces role restrictions (e.g. maximum 2 Super Admins).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-lextria-app');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role key is not configured.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 1. GET: List users
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .schema('core')
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ profiles: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST: Create a new user
  if (req.method === 'POST') {
    const { email, password, displayName, role, department } = req.body || {};

    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ error: 'Missing required fields: email, password, displayName, and role.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let cleanRole = role.trim().toUpperCase();
    let cleanDept = department?.trim()?.toUpperCase();

    if (cleanRole === 'AGREEMENTS_ASSOCIATE' || cleanRole === 'AGREEMENT_ASSOCIATE') {
      cleanRole = 'ASSOCIATE';
      if (!cleanDept) cleanDept = 'AGREEMENT';
    } else if (cleanRole === 'LITIGATION_ASSOCIATE') {
      cleanRole = 'ASSOCIATE';
      if (!cleanDept) cleanDept = 'LITIGATION';
    }

    if (!cleanDept) {
      cleanDept = cleanRole === 'FINANCE' ? 'FINANCE' : cleanRole === 'SUPER_ADMIN' ? 'MANAGEMENT' : 'LITIGATION';
    }

    // Validate role
    if (!['SUPER_ADMIN', 'FINANCE', 'ASSOCIATE'].includes(cleanRole)) {
      return res.status(400).json({
        error: 'Invalid role. Permitted roles are: SUPER_ADMIN, FINANCE, ASSOCIATE.',
      });
    }

    try {
      // RULE: Maximum 2 Super Admins at a time
      if (cleanRole === 'SUPER_ADMIN') {
        const { count, error: countErr } = await supabase
          .schema('core')
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'SUPER_ADMIN')
          .eq('active', true);

        if (countErr) throw countErr;

        if (count && count >= 2) {
          return res.status(400).json({
            error: 'Maximum limit of 2 Super Admins reached. Only two Super Admins can exist at a time.',
          });
        }
      }

      // Check if user already exists in auth
      const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;

      const existingAuth = userList.users.find((u) => u.email?.toLowerCase() === cleanEmail);

      let userId = existingAuth?.id;

      if (!existingAuth) {
        const { data: created, error: createAuthErr } = await supabase.auth.admin.createUser({
          email: cleanEmail,
          password: password.trim(),
          email_confirm: true,
          user_metadata: {
            display_name: displayName.trim(),
            role: cleanRole,
            department: cleanDept,
          },
        });

        if (createAuthErr) throw createAuthErr;
        userId = created.user.id;
      } else {
        // Update existing auth user password & metadata
        const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(userId!, {
          password: password.trim(),
          user_metadata: {
            display_name: displayName.trim(),
            role: cleanRole,
            department: cleanDept,
          },
        });
        if (updateAuthErr) throw updateAuthErr;
      }

      // Upsert profile in core.profiles
      const { data: profile, error: profErr } = await supabase
        .schema('core')
        .from('profiles')
        .upsert({
          id: userId,
          email: cleanEmail,
          display_name: displayName.trim(),
          role: cleanRole,
          department: cleanDept,
          is_finance_lead: cleanRole === 'FINANCE',
          active: true,
        })
        .select()
        .single();

      if (profErr) throw profErr;

      return res.status(200).json({
        success: true,
        profile,
      });
    } catch (err: any) {
      console.error('Create user error:', err);
      return res.status(500).json({ error: err.message || 'Failed to create user.' });
    }
  }

  // 3. DELETE: Remove a user
  if (req.method === 'DELETE') {
    const { userId } = req.body || req.query || {};

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId.' });
    }

    try {
      // Fetch target profile
      const { data: targetProfile, error: getErr } = await supabase
        .schema('core')
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (getErr) throw getErr;

      // RULE: Cannot delete if it's the last Super Admin
      if (targetProfile?.role === 'SUPER_ADMIN') {
        const { count, error: countErr } = await supabase
          .schema('core')
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'SUPER_ADMIN')
          .eq('active', true);

        if (countErr) throw countErr;

        if (count && count <= 1) {
          return res.status(400).json({
            error: 'Cannot delete the only active Super Admin. At least one Super Admin must remain.',
          });
        }
      }

      // Find fallback active Super Admin for safe foreign key reassignment
      const { data: adminProf } = await supabase
        .schema('core')
        .from('profiles')
        .select('id')
        .eq('role', 'SUPER_ADMIN')
        .eq('active', true)
        .neq('id', userId)
        .limit(1)
        .maybeSingle();

      const fallbackAdminId = adminProf?.id || '5b488b59-915c-4f02-b973-748cf9a46902';

      // Safely reassign foreign key references to avoid Postgres constraint 23503
      try {
        await supabase.schema('litigator').from('cases').update({ lead_user_id: fallbackAdminId }).eq('lead_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('litigator').from('cases').update({ created_by: fallbackAdminId }).eq('created_by', userId);
      } catch (e) {}
      try {
        await supabase.schema('litigator').from('hearings').update({ counsel_user_id: fallbackAdminId }).eq('counsel_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('litigator').from('orders').update({ assigned_user_id: fallbackAdminId }).eq('assigned_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('litigator').from('deadlines').update({ assigned_user_id: fallbackAdminId }).eq('assigned_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('litigator').from('internal_notes').update({ author_user_id: fallbackAdminId }).eq('author_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('core').from('project_codes').update({ lead_assignee_id: fallbackAdminId }).eq('lead_assignee_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('core').from('project_codes').update({ spoc_user_id: fallbackAdminId }).eq('spoc_user_id', userId);
      } catch (e) {}
      try {
        await supabase.schema('core').from('documents').update({ uploaded_by: fallbackAdminId }).eq('uploaded_by', userId);
      } catch (e) {}
      try {
        await supabase.schema('core').from('profiles').update({ reports_to: null }).eq('reports_to', userId);
      } catch (e) {}
      try {
        await supabase.schema('office').from('dispatches').update({ created_by: fallbackAdminId }).eq('created_by', userId);
      } catch (e) {}
      try {
        await supabase.schema('office').from('cash_entries').update({ paid_by: fallbackAdminId }).eq('paid_by', userId);
      } catch (e) {}
      try {
        await supabase.schema('office').from('cash_entries').update({ received_by: fallbackAdminId }).eq('received_by', userId);
      } catch (e) {}
      try {
        await supabase.schema('office').from('cash_entries').update({ created_by: fallbackAdminId }).eq('created_by', userId);
      } catch (e) {}

      // Attempt hard delete from core.profiles, falling back to soft delete if any constraint lingers
      const { error: delProfErr } = await supabase.schema('core').from('profiles').delete().eq('id', userId);
      if (delProfErr) {
        console.warn('Hard delete from core.profiles failed, falling back to soft delete (active=false):', delProfErr.message);
        await supabase.schema('core').from('profiles').update({ active: false }).eq('id', userId);
      }

      // Delete from auth.users so account cannot log in
      try {
        const { error: delAuthErr } = await supabase.auth.admin.deleteUser(userId);
        if (delAuthErr) {
          console.warn('Auth user deletion warning:', delAuthErr.message);
        }
      } catch (authErr: any) {
        console.warn('Auth user deletion exception:', authErr?.message);
      }

      return res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } catch (err: any) {
      console.error('Delete user error:', err);
      // Even if error occurred, ensure profile is marked inactive
      try {
        await supabase.schema('core').from('profiles').update({ active: false }).eq('id', userId);
        return res.status(200).json({ success: true, message: 'User deactivated successfully.' });
      } catch (fallbackErr: any) {
        return res.status(500).json({ error: err.message || 'Failed to delete user.' });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
