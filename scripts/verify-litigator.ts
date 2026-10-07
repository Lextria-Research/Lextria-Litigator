import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 1. Read .env.local
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
const anonKey = env['VITE_SUPABASE_ANON_KEY'] || env['SUPABASE_ANON_KEY'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Missing Supabase configuration in .env.local');
  process.exit(1);
}

// 2. Read test logins
const loginsPath = path.resolve('test-logins.txt');
const loginsContent = fs.existsSync(loginsPath) ? fs.readFileSync(loginsPath, 'utf8') : '';
const credentials: Record<string, string> = {};
for (const line of loginsContent.split('\n')) {
  const emailMatch = line.match(/([\w.-]+@[\w.-]+\.\w+)/);
  if (emailMatch) {
    const email = emailMatch[1].toLowerCase();
    const parts = line.split('|').map((s) => s.trim());
    for (const part of parts) {
      if (part.toLowerCase().startsWith('password:')) {
        credentials[email] = part.replace(/password:/i, '').trim();
      }
    }
  }
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('--- Starting Lextria Litigator Database Check ---');
  let test1Passed = false;
  let test2Passed = false;
  let test3Passed = false;

  const associate1Email = 'associate@lextria-demo.test';
  const associate2Email = 'associate2@lextria-demo.test';
  const pwd1 = credentials[associate1Email];
  const pwd2 = credentials[associate2Email];

  if (!pwd1 || !pwd2) {
    console.error('Could not find passwords for associate or associate2 in test-logins.txt');
    process.exit(1);
  }

  // Client 1 (Associate 1)
  const client1 = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-lextria-app': 'LITIGATOR' } },
  });
  const { data: authData1, error: authErr1 } = await client1.auth.signInWithPassword({
    email: associate1Email,
    password: pwd1,
  });
  if (authErr1 || !authData1.user) {
    console.error('Associate 1 login failed:', authErr1?.message);
    process.exit(1);
  }
  const user1Id = authData1.user.id;

  // Client 2 (Associate 2)
  const client2 = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-lextria-app': 'LITIGATOR' } },
  });
  const { data: authData2, error: authErr2 } = await client2.auth.signInWithPassword({
    email: associate2Email,
    password: pwd2,
  });
  if (authErr2 || !authData2.user) {
    console.error('Associate 2 login failed:', authErr2?.message);
    process.exit(1);
  }
  const user2Id = authData2.user.id;

  // Set schema for authenticated queries
  const lit1 = client1.schema('litigator' as any);
  const lit2 = client2.schema('litigator' as any);
  const adminLit = adminClient.schema('litigator' as any);
  const adminCore = adminClient.schema('core' as any);

  let tempClientId: string | null = null;
  let tempProjectCodeId: string | null = null;
  let tempCaseId: string | null = null;
  let tempHearingId: string | null = null;
  let tempNextHearingId: string | null = null;
  let tempAgrProjectCodeId: string | null = null;
  let tempAgrId: string | null = null;

  try {
    // Setup temporary client & project code using adminClient
    const uniqueSuffix = Date.now().toString().slice(-6);
    const { data: newClient, error: clientErr } = await adminCore
      .from('clients')
      .insert({
        client_code: `TEST${uniqueSuffix}`,
        client_name: `Verification Client ${uniqueSuffix}`,
        entity_type: 'STARTUP',
      })
      .select('id')
      .single();
    if (clientErr) throw clientErr;
    tempClientId = newClient.id;

    const { data: newProj, error: projErr } = await adminCore
      .from('project_codes')
      .insert({
        code: `LIT-VERIFY-${uniqueSuffix}`,
        client_id: tempClientId,
        department: 'LITIGATION',
        title: 'Ethical Wall Verification Matter',
        lead_assignee_id: user1Id,
        owning_app: 'LITIGATOR',
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    if (projErr) throw projErr;
    tempProjectCodeId = newProj.id;

    // -------------------------------------------------------------
    // TEST 1: Associate creates walled case; Associate 2 cannot see it
    // -------------------------------------------------------------
    console.log('\n[Test 1] Testing Ethical Wall...');

    // Associate 1 creates case with ethical_wall = true
    tempCaseId = crypto.randomUUID();
    const { error: caseErr } = await lit1
      .from('cases')
      .insert({
        id: tempCaseId,
        project_code_id: tempProjectCodeId,
        case_type: 'COMMERCIAL_SUIT',
        court: 'High Court of Delhi',
        cause_title: `Confidential Test Suit ${uniqueSuffix}`,
        client_role: 'PLAINTIFF',
        current_stage: 'Suit filed',
        lead_user_id: user1Id,
        ethical_wall: true,
        status: 'ACTIVE',
      });
    if (caseErr) throw new Error(`Associate 1 failed to create case: ${caseErr.message}`);

    // Associate 1 adds self to case_team
    await lit1.from('case_team').insert({
      case_id: tempCaseId,
      user_id: user1Id,
      role_in_team: 'LEAD',
    });

    // Check: Associate 1 queries cases
    const { data: assoc1Cases, error: q1Err } = await lit1
      .from('cases')
      .select('id, cause_title')
      .eq('id', tempCaseId);
    if (q1Err) throw q1Err;
    const canAssoc1See = (assoc1Cases || []).length === 1;

    // Check: Associate 2 queries cases
    const { data: assoc2Cases, error: q2Err } = await lit2
      .from('cases')
      .select('id, cause_title')
      .eq('id', tempCaseId);
    if (q2Err) throw q2Err;
    const canAssoc2See = (assoc2Cases || []).length > 0;

    console.log(`  - Associate 1 can see walled case: ${canAssoc1See}`);
    console.log(`  - Associate 2 can see walled case: ${canAssoc2See}`);

    if (canAssoc1See && !canAssoc2See) {
      test1Passed = true;
      console.log('✓ PASS: Ethical wall enforced. Associate 2 cannot see the case.');
    } else {
      console.error('✗ FAIL: Ethical wall policy did not isolate case from Associate 2.');
    }

    // -------------------------------------------------------------
    // TEST 2: Add hearing + "update after hearing" works
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing "Update After Hearing" workflow...');

    // Add hearing
    const hearingDate = '2026-10-06';
    const nextDate = '2026-11-15';
    const { data: newHearing, error: hErr } = await lit1
      .from('hearings')
      .insert({
        case_id: tempCaseId,
        hearing_date: hearingDate,
        purpose: 'Admissions and Denials',
        attended_by: user1Id,
      })
      .select('id')
      .single();
    if (hErr) throw hErr;
    tempHearingId = newHearing.id;

    // Execute "Update After Hearing"
    const outcomeText = 'Notice issued to opposite parties. Arguments scheduled.';
    const nextPurposeText = 'Arguments on Interim Relief';

    // 1. Update hearing with outcome
    const { error: updErr } = await lit1
      .from('hearings')
      .update({
        outcome: outcomeText,
        next_date: nextDate,
        next_purpose: nextPurposeText,
      })
      .eq('id', tempHearingId);
    if (updErr) throw updErr;

    // 2. Insert next hearing
    const { data: nextH, error: nextHErr } = await lit1
      .from('hearings')
      .insert({
        case_id: tempCaseId,
        hearing_date: nextDate,
        purpose: nextPurposeText,
        attended_by: user1Id,
      })
      .select('id')
      .single();
    if (nextHErr) throw nextHErr;
    tempNextHearingId = nextH.id;

    // 3. Update case's next_hearing_date
    const { error: cUpdErr } = await lit1
      .from('cases')
      .update({
        next_hearing_date: nextDate,
        next_purpose: nextPurposeText,
      })
      .eq('id', tempCaseId);
    if (cUpdErr) throw cUpdErr;

    // 4. Record core.matter_events with HEARING_ATTENDED
    const { error: evErr } = await adminCore.from('matter_events').insert({
      project_code_id: tempProjectCodeId,
      event_code: 'HEARING_ATTENDED',
      title: `Hearing Attended: ${outcomeText}`,
      detail: `Purpose: Admissions. Outcome: ${outcomeText}. Next: ${nextDate}`,
      occurred_at: hearingDate,
      actor_user_id: user1Id,
      source_app: 'LITIGATOR',
      client_visible: true,
    });
    if (evErr) throw evErr;

    // Verification queries
    const { data: verifiedCase } = await lit1
      .from('cases')
      .select('next_hearing_date, next_purpose')
      .eq('id', tempCaseId)
      .single();

    const { data: verifiedHearing } = await lit1
      .from('hearings')
      .select('outcome, next_date')
      .eq('id', tempHearingId)
      .single();

    const { data: verifiedEvents } = await adminCore
      .from('matter_events')
      .select('event_code, title')
      .eq('project_code_id', tempProjectCodeId)
      .eq('event_code', 'HEARING_ATTENDED');

    const caseUpdated = verifiedCase?.next_hearing_date === nextDate;
    const hearingOutcomeSet = verifiedHearing?.outcome === outcomeText;
    const eventLogged = (verifiedEvents || []).length > 0;

    console.log(`  - Case next_hearing_date updated: ${caseUpdated} (${verifiedCase?.next_hearing_date})`);
    console.log(`  - Hearing outcome saved: ${hearingOutcomeSet}`);
    console.log(`  - HEARING_ATTENDED event logged: ${eventLogged}`);

    if (caseUpdated && hearingOutcomeSet && eventLogged) {
      test2Passed = true;
      console.log('✓ PASS: Hearing attended workflow successfully executed.');
    } else {
      console.error('✗ FAIL: Hearing update did not satisfy all criteria.');
    }

    // -------------------------------------------------------------
    // TEST 3: Agreement cannot move to CLIENT_REVIEW without a version
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Agreement Stage Validation...');

    // Setup project code for agreement
    const { data: agrProj, error: agrProjErr } = await adminCore
      .from('project_codes')
      .insert({
        code: `AGR-VERIFY-${uniqueSuffix}`,
        client_id: tempClientId,
        department: 'AGREEMENT',
        title: 'Contract Review Verification Matter',
        lead_assignee_id: user1Id,
        owning_app: 'LITIGATOR',
        status: 'ACTIVE',
      })
      .select('id')
      .single();
    if (agrProjErr) throw agrProjErr;
    tempAgrProjectCodeId = agrProj.id;

    // Create agreement in DRAFTING stage
    tempAgrId = crypto.randomUUID();
    const { error: agrErr } = await lit1
      .from('agreements')
      .insert({
        id: tempAgrId,
        project_code_id: tempAgrProjectCodeId,
        agreement_type: 'NDA',
        title: `Bilateral NDA ${uniqueSuffix}`,
        stage: 'DRAFTING',
        lead_user_id: user1Id,
      });
    if (agrErr) throw agrErr;

    // Check DB trigger / rule: Try to update stage to CLIENT_REVIEW without any versions
    const { error: invalidStageErr } = await lit1
      .from('agreements')
      .update({ stage: 'CLIENT_REVIEW' })
      .eq('id', tempAgrId);

    const blockedWithoutVersion = Boolean(invalidStageErr);
    console.log(`  - Stage change blocked without version: ${blockedWithoutVersion}`);
    if (invalidStageErr) {
      console.log(`    Trigger Error: "${invalidStageErr.message}"`);
    }

    // Now insert a version sent to CLIENT
    const { error: vErr } = await lit1.from('agreement_versions').insert({
      agreement_id: tempAgrId,
      version_no: 1,
      sent_to: 'CLIENT',
      sent_at: new Date().toISOString(),
      change_summary: 'Delivered for client review',
    });
    if (vErr) throw vErr;

    // Now attempt to update to CLIENT_REVIEW again: should succeed
    const { error: validStageErr } = await lit1
      .from('agreements')
      .update({ stage: 'CLIENT_REVIEW' })
      .eq('id', tempAgrId);

    const allowedWithVersion = !validStageErr;
    console.log(`  - Stage change permitted after version sent to CLIENT: ${allowedWithVersion}`);

    if (blockedWithoutVersion && allowedWithVersion) {
      test3Passed = true;
      console.log('✓ PASS: Agreement stage gate enforced correctly.');
    } else {
      console.error('✗ FAIL: Agreement stage gate test failed.');
    }

  } catch (err: any) {
    console.error('Verification script runtime error:', err);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Ensure no temporary test data remains in the database
    // -------------------------------------------------------------
    console.log('\nCleaning up verification records...');
    try {
      if (tempNextHearingId) await adminLit.from('hearings').delete().eq('id', tempNextHearingId);
      if (tempHearingId) await adminLit.from('hearings').delete().eq('id', tempHearingId);
      if (tempCaseId) {
        await adminLit.from('case_team').delete().eq('case_id', tempCaseId);
        await adminLit.from('cases').delete().eq('id', tempCaseId);
      }
      if (tempAgrId) {
        await adminLit.from('agreement_versions').delete().eq('agreement_id', tempAgrId);
        await adminLit.from('agreements').delete().eq('id', tempAgrId);
      }
      if (tempProjectCodeId) {
        await adminCore.from('matter_events').delete().eq('project_code_id', tempProjectCodeId);
        await adminCore.from('project_codes').delete().eq('id', tempProjectCodeId);
      }
      if (tempAgrProjectCodeId) {
        await adminCore.from('project_codes').delete().eq('id', tempAgrProjectCodeId);
      }
      if (tempClientId) {
        await adminCore.from('clients').delete().eq('id', tempClientId);
      }
      console.log('Cleanup complete. Database remains pristine.');
    } catch (cleanErr: any) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
  }

  console.log('\n=== Summary of Database Verification ===');
  console.log(`Test 1 (Ethical Wall): ${test1Passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 2 (Hearing Update & Events): ${test2Passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 3 (Agreement Stage Validation): ${test3Passed ? 'PASSED' : 'FAILED'}`);

  if (test1Passed && test2Passed && test3Passed) {
    console.log('\nALL 3 CHECKS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error('\nONE OR MORE CHECKS FAILED.');
    process.exit(1);
  }
}

main();
