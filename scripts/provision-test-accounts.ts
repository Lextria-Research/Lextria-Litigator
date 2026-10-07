// scripts/provision-test-accounts.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Read .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
}

const supabaseUrl = env['VITE_SUPABASE_URL'] || env['SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_LOGINS_FILE = path.resolve('test-logins.txt');

function generateSecurePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!#%*+';
  let pwd = 'Lx!';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

export const LITIGATOR_ROLES = [
  {
    roleName: 'Litigation Head',
    email: 'lithead@lextria-demo.test',
    role: 'DEPT_ADMIN',
    department: 'LITIGATION',
    displayName: 'Sanjay Deshmukh (Litigation Head)',
  },
  {
    roleName: 'Associate',
    email: 'associate@lextria-demo.test',
    role: 'ASSOCIATE',
    department: 'LITIGATION',
    displayName: 'Priyanka Sen (Associate)',
  },
  {
    roleName: 'Associate 2',
    email: 'associate2@lextria-demo.test',
    role: 'ASSOCIATE',
    department: 'LITIGATION',
    displayName: 'Aditya Verma (Associate 2)',
  },
  {
    roleName: 'Intern',
    email: 'intern@lextria-demo.test',
    role: 'INTERN',
    department: 'LITIGATION',
    displayName: 'Rohan Joshi (Intern)',
  },
];

async function main() {
  console.log('Connecting to Supabase to verify/provision test accounts...');
  
  // Existing logins from test-logins.txt if any
  const existingLogins: Record<string, string> = {};
  if (fs.existsSync(TEST_LOGINS_FILE)) {
    const lines = fs.readFileSync(TEST_LOGINS_FILE, 'utf8').split('\n');
    for (const l of lines) {
      const match = l.match(/Email:\s*(\S+)\s*\|\s*Password:\s*(\S+)/);
      if (match) existingLogins[match[1].toLowerCase()] = match[2];
    }
  }

  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing auth users:', listErr.message);
    process.exit(1);
  }

  const userMap = new Map<string, string>();
  for (const u of userList.users) {
    if (u.email) userMap.set(u.email.toLowerCase(), u.id);
  }

  const outputLines: string[] = [
    '# Lextria Litigator — Test Logins',
    '# DO NOT COMMIT TO GIT (git-ignored)',
    '# Generated: ' + new Date().toISOString(),
    '',
  ];

  for (const item of LITIGATOR_ROLES) {
    const email = item.email.toLowerCase();
    const password = existingLogins[email] || generateSecurePassword();
    existingLogins[email] = password;

    let userId = userMap.get(email);

    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: item.displayName,
          role: item.role,
          department: item.department,
        },
      });

      if (createErr || !created.user) {
        console.error(`Failed to create user ${email}:`, createErr?.message);
        continue;
      }
      userId = created.user.id;
      console.log(`Created auth user: ${email} (${userId})`);
    } else {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          display_name: item.displayName,
          role: item.role,
          department: item.department,
        },
      });
      if (updateErr) {
        console.error(`Failed to update user ${email}:`, updateErr.message);
      } else {
        console.log(`Updated auth user: ${email} (${userId})`);
      }
    }

    // Now upsert into core.profiles
    const { error: profileErr } = await supabase
      .schema('core')
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          display_name: item.displayName,
          role: item.role,
          department: item.department,
          active: true,
        },
        { onConflict: 'id' }
      );

    if (profileErr) {
      console.error(`Error upserting profile for ${email}:`, profileErr.message);
    } else {
      console.log(`Profile synced in core.profiles for ${email}`);
    }

    outputLines.push(
      `Role: ${item.roleName.padEnd(20)} | Email: ${email.padEnd(30)} | Password: ${password}`
    );
  }

  // Also retain existing office users in the file if present
  outputLines.push('', '# Sister App Users (if tested across apps):');
  for (const [em, pw] of Object.entries(existingLogins)) {
    if (!LITIGATOR_ROLES.some((r) => r.email.toLowerCase() === em)) {
      outputLines.push(`Email: ${em.padEnd(35)} | Password: ${pw}`);
    }
  }

  fs.writeFileSync(TEST_LOGINS_FILE, outputLines.join('\n') + '\n', 'utf8');
  console.log(`SUCCESS: Test logins safely written to ${TEST_LOGINS_FILE} (passwords never printed).`);
}

main().catch(console.error);
