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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiUsersDevPlugin()],
  envPrefix: ['VITE_', 'SUPABASE_', 'DATA_MODE', 'AUTH_MODE'],
});
