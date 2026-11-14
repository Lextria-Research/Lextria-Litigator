import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createClient } from '@supabase/supabase-js';

function apiUsersDevPlugin(): Plugin {
  return {
    name: 'api-users-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/users')) {
          return next();
        }

        const env = loadEnv('development', process.cwd(), ['SUPABASE_', 'VITE_']);
        const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
        const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!serviceRoleKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }));
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        res.setHeader('Content-Type', 'application/json');

        const getBody = () =>
          new Promise<any>((resolve) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch {
                resolve({});
              }
            });
          });

        try {
          if (req.method === 'GET') {
            const { data, error } = await supabase
              .schema('core')
              .from('profiles')
              .select('*')
              .order('created_at', { ascending: false });
            if (error) throw error;
            res.statusCode = 200;
            return res.end(JSON.stringify({ profiles: data || [] }));
          }

          if (req.method === 'POST') {
            const body = await getBody();
            const { email, password, displayName, role, department } = body;
            if (!email || !password || !displayName || !role) {
              res.statusCode = 400;
              return res.end(
                JSON.stringify({ error: 'Missing required fields: email, password, displayName, and role.' })
              );
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
              cleanDept =
                cleanRole === 'FINANCE' ? 'FINANCE' : cleanRole === 'SUPER_ADMIN' ? 'MANAGEMENT' : 'LITIGATION';
            }

            if (cleanRole === 'SUPER_ADMIN') {
              const { count, error: countErr } = await supabase
                .schema('core')
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'SUPER_ADMIN')
                .eq('active', true);

              if (countErr) throw countErr;
              if (count && count >= 2) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    error: 'Maximum limit of 2 Super Admins reached. Only two Super Admins can exist at a time.',
                  })
                );
              }
            }

            const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
            if (listErr) throw listErr;
            const existingAuth = userList.users.find((u) => u.email?.toLowerCase() === cleanEmail);
            let userId = existingAuth?.id;

            if (!existingAuth) {
              const { data: created, error: createAuthErr } = await supabase.auth.admin.createUser({
                email: cleanEmail,
                password: password.trim(),
                email_confirm: true,
                user_metadata: { display_name: displayName.trim(), role: cleanRole, department: cleanDept },
              });
              if (createAuthErr) throw createAuthErr;
              userId = created.user.id;
            } else {
              const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(userId!, {
                password: password.trim(),
                user_metadata: { display_name: displayName.trim(), role: cleanRole, department: cleanDept },
              });
              if (updateAuthErr) throw updateAuthErr;
            }

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
            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, profile }));
          }

          if (req.method === 'DELETE') {
            const body = await getBody();
            const urlObj = new URL(req.url, 'http://localhost');
            const userId = body.userId || urlObj.searchParams.get('userId');

            if (!userId) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing userId.' }));
            }

            const { data: targetProfile, error: getErr } = await supabase
              .schema('core')
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (getErr) throw getErr;

            if (targetProfile?.role === 'SUPER_ADMIN') {
              const { count, error: countErr } = await supabase
                .schema('core')
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'SUPER_ADMIN')
                .eq('active', true);
              if (countErr) throw countErr;
              if (count && count <= 1) {
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    error:
                      'Cannot delete the only active Super Admin. At least one Super Admin must remain.',
                  })
                );
              }
            }

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

            try { await supabase.schema('litigator').from('cases').update({ lead_user_id: fallbackAdminId }).eq('lead_user_id', userId); } catch (e) {}
            try { await supabase.schema('litigator').from('cases').update({ created_by: fallbackAdminId }).eq('created_by', userId); } catch (e) {}
            try { await supabase.schema('litigator').from('hearings').update({ counsel_user_id: fallbackAdminId }).eq('counsel_user_id', userId); } catch (e) {}
            try { await supabase.schema('litigator').from('orders').update({ assigned_user_id: fallbackAdminId }).eq('assigned_user_id', userId); } catch (e) {}
            try { await supabase.schema('litigator').from('deadlines').update({ assigned_user_id: fallbackAdminId }).eq('assigned_user_id', userId); } catch (e) {}
            try { await supabase.schema('litigator').from('internal_notes').update({ author_user_id: fallbackAdminId }).eq('author_user_id', userId); } catch (e) {}
            try { await supabase.schema('core').from('project_codes').update({ lead_assignee_id: fallbackAdminId }).eq('lead_assignee_id', userId); } catch (e) {}
            try { await supabase.schema('core').from('project_codes').update({ spoc_user_id: fallbackAdminId }).eq('spoc_user_id', userId); } catch (e) {}
            try { await supabase.schema('core').from('documents').update({ uploaded_by: fallbackAdminId }).eq('uploaded_by', userId); } catch (e) {}
            try { await supabase.schema('core').from('profiles').update({ reports_to: null }).eq('reports_to', userId); } catch (e) {}
            try { await supabase.schema('office').from('dispatches').update({ created_by: fallbackAdminId }).eq('created_by', userId); } catch (e) {}
            try { await supabase.schema('office').from('cash_entries').update({ paid_by: fallbackAdminId }).eq('paid_by', userId); } catch (e) {}
            try { await supabase.schema('office').from('cash_entries').update({ received_by: fallbackAdminId }).eq('received_by', userId); } catch (e) {}
            try { await supabase.schema('office').from('cash_entries').update({ created_by: fallbackAdminId }).eq('created_by', userId); } catch (e) {}

            const { error: delProfErr } = await supabase.schema('core').from('profiles').delete().eq('id', userId);
            if (delProfErr) {
              await supabase.schema('core').from('profiles').update({ active: false }).eq('id', userId);
            }

            try {
              await supabase.auth.admin.deleteUser(userId);
            } catch (e) {}

            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, message: 'User deleted successfully.' }));
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method not allowed' }));
        } catch (err: any) {
          console.error('Dev API users error:', err);
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });
    },
  };
}

function apiProjectCodesDevPlugin(): Plugin {
  return {
    name: 'api-project-codes-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/project-codes')) {
          return next();
        }

        const env = loadEnv('development', process.cwd(), ['SUPABASE_', 'VITE_']);
        const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
        const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!serviceRoleKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }));
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        res.setHeader('Content-Type', 'application/json');

        const getBody = () =>
          new Promise<any>((resolve) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch {
                resolve({});
              }
            });
          });

        if (req.method === 'POST' || req.method === 'PATCH') {
          try {
            const body = await getBody();
            const { projectCodeId, newCode, title } = body;

            if (!projectCodeId || typeof projectCodeId !== 'string') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing or invalid projectCodeId.' }));
            }

            const cleanCode = (newCode || '').trim().toUpperCase();
            if (!cleanCode) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Matter code cannot be empty.' }));
            }

            const normClean = cleanCode.replace(/\s+/g, '');

            const { data: currentPc, error: currentErr } = await supabase
              .schema('core')
              .from('project_codes')
              .select('id, code, title')
              .eq('id', projectCodeId)
              .maybeSingle();

            if (currentErr) throw currentErr;
            if (!currentPc) {
              res.statusCode = 404;
              return res.end(JSON.stringify({ error: 'Project code record not found.' }));
            }

            const currentCode = currentPc.code?.trim().toUpperCase();

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
                res.statusCode = 400;
                return res.end(
                  JSON.stringify({
                    error: `Matter code "${cleanCode}" is already in use by another matter.`,
                  })
                );
              }

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

              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, projectCode: updatedPc }));
            } else {
              if (title !== undefined && title !== currentPc.title) {
                const { data: updatedPc, error: updateErr } = await supabase
                  .schema('core')
                  .from('project_codes')
                  .update({ title })
                  .eq('id', projectCodeId)
                  .select('*')
                  .single();

                if (updateErr) throw updateErr;
                res.statusCode = 200;
                return res.end(JSON.stringify({ success: true, projectCode: updatedPc }));
              }

              res.statusCode = 200;
              return res.end(JSON.stringify({ success: true, projectCode: currentPc }));
            }
          } catch (err: any) {
            console.error('Dev API project-codes error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message || 'Server error' }));
          }
        }

        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    },
  };
}

function apiMatterEventsDevPlugin(): Plugin {
  return {
    name: 'api-matter-events-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/matter-events')) {
          return next();
        }

        const env = loadEnv('development', process.cwd(), ['SUPABASE_', 'VITE_']);
        const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://eafciegebhuhoneypsqy.supabase.co';
        const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!serviceRoleKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }));
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        res.setHeader('Content-Type', 'application/json');

        const getBody = () =>
          new Promise<any>((resolve) => {
            let data = '';
            req.on('data', (chunk) => {
              data += chunk;
            });
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch {
                resolve({});
              }
            });
          });

        if (req.method === 'POST') {
          try {
            const body = await getBody();
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
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing required fields: project_code_id and title.' }));
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

            res.statusCode = 201;
            return res.end(JSON.stringify({ success: true, event: data }));
          } catch (err: any) {
            console.error('Dev API matter-events POST error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message || 'Server error' }));
          }
        }

        if (req.method === 'PUT' || req.method === 'PATCH') {
          try {
            const body = await getBody();
            const urlObj = new URL(req.url, 'http://localhost');
            const eventId = body.id || urlObj.searchParams.get('id');

            if (!eventId || typeof eventId !== 'string') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing or invalid event id.' }));
            }

            const payload: Record<string, any> = {};
            if (body.title !== undefined) payload.title = body.title;
            if (body.detail !== undefined) payload.detail = body.detail;
            if (body.occurred_at !== undefined) payload.occurred_at = body.occurred_at;
            if (body.event_code !== undefined) payload.event_code = body.event_code || null;
            if (body.client_label !== undefined) payload.client_label = body.client_label;
            if (body.metadata !== undefined) payload.metadata = body.metadata;

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

            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, event: data }));
          } catch (err: any) {
            console.error('Dev API matter-events PUT error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message || 'Server error' }));
          }
        }

        if (req.method === 'DELETE') {
          try {
            const body = await getBody();
            const urlObj = new URL(req.url, 'http://localhost');
            const eventId = body.id || urlObj.searchParams.get('id');

            if (!eventId || typeof eventId !== 'string') {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing or invalid event id.' }));
            }

            const { error } = await supabase
              .schema('core')
              .from('matter_events')
              .delete()
              .eq('id', eventId);

            if (error) throw error;

            res.statusCode = 200;
            return res.end(JSON.stringify({ success: true, message: 'Matter event deleted successfully.' }));
          } catch (err: any) {
            console.error('Dev API matter-events error:', err);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message || 'Server error' }));
          }
        }

        res.statusCode = 405;
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiUsersDevPlugin(), apiProjectCodesDevPlugin(), apiMatterEventsDevPlugin()],
  envPrefix: ['VITE_', 'SUPABASE_', 'DATA_MODE', 'AUTH_MODE'],
});
