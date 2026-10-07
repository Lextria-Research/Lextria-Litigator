// api/cron.ts
// Vercel Cron Endpoint for Daily Litigator Reminders (18:00 IST / 12:30 UTC)
// Sends notifications to core.notifications and queues cards in litigator.cliq_outbox

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase configuration missing in environment' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: { headers: { 'x-lextria-app': 'LITIGATOR' } },
  });

  const now = new Date();
  // Format dates in YYYY-MM-DD
  const formatYMD = (d: Date) => d.toISOString().slice(0, 10);

  const todayStr = formatYMD(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatYMD(tomorrow);

  const d1 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const d3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const d1Str = formatYMD(d1);
  const d3Str = formatYMD(d3);
  const d7Str = formatYMD(d7);

  const results = {
    tomorrowHearings: 0,
    updateAfterHearing: 0,
    deadlinesNotified: 0,
  };

  try {
    // 1. Tomorrow's Hearings -> notify attending counsel & lead
    const { data: tmrHearings } = await supabase
      .schema('litigator')
      .from('hearings')
      .select('id, hearing_date, purpose, attended_by, case_id, cases!inner(id, cause_title, case_number, court, lead_user_id)')
      .eq('hearing_date', tomorrowStr);

    if (tmrHearings && tmrHearings.length > 0) {
      for (const h of tmrHearings) {
        const c = Array.isArray(h.cases) ? h.cases[0] : h.cases;
        const recipients = new Set<string>();
        if (h.attended_by) recipients.add(h.attended_by);
        if (c?.lead_user_id) recipients.add(c.lead_user_id);

        for (const uid of recipients) {
          await supabase.schema('core').from('notifications').insert({
            user_id: uid,
            title: `Court Hearing Tomorrow: ${c?.case_number || 'Case'} (${h.purpose})`,
            body: `${c?.cause_title} before ${c?.court}. Scheduled for tomorrow, ${tomorrowStr}.`,
            link: `/cases/${h.case_id}`,
            source_app: 'LITIGATOR',
          });
        }

        // Cliq Outbox card
        await supabase.schema('litigator').from('cliq_outbox').insert({
          channel: '#litigation-hearings',
          title: `🏛️ Hearing Tomorrow: ${c?.cause_title} [${c?.court}]`,
          link: `/cases/${h.case_id}`,
          card: {
            title: `Hearing Tomorrow: ${c?.case_number || 'Court Matter'}`,
            theme: 'indigo',
            purpose: h.purpose,
            court: c?.court,
            cause_title: c?.cause_title,
          },
          status: 'QUEUED',
        });
        results.tomorrowHearings++;
      }
    }

    // 2. "Update after hearing" -> lead user the evening of the hearing if outcome is empty
    const { data: pastUnupdated } = await supabase
      .schema('litigator')
      .from('hearings')
      .select('id, hearing_date, purpose, case_id, cases!inner(id, cause_title, case_number, lead_user_id)')
      .lte('hearing_date', todayStr)
      .is('outcome', null);

    if (pastUnupdated && pastUnupdated.length > 0) {
      for (const h of pastUnupdated) {
        const c = Array.isArray(h.cases) ? h.cases[0] : h.cases;
        if (c?.lead_user_id) {
          await supabase.schema('core').from('notifications').insert({
            user_id: c.lead_user_id,
            title: `Action Required: Update Hearing Outcome for ${c?.case_number || 'Case'}`,
            body: `Hearing on ${h.hearing_date} (${h.purpose}) requires outcome and next hearing date log.`,
            link: `/cases/${h.case_id}?action=update_hearing`,
            source_app: 'LITIGATOR',
          });
          results.updateAfterHearing++;
        }
      }
    }

    // 3. Deadlines at 7, 3, and 1 days
    const { data: pendingDeadlines } = await supabase
      .schema('litigator')
      .from('deadlines')
      .select('id, title, due_date, deadline_type, owner_user_id, backup_user_id, case_id, agreement_id')
      .eq('status', 'OPEN')
      .in('due_date', [d7Str, d3Str, d1Str, todayStr]);

    if (pendingDeadlines && pendingDeadlines.length > 0) {
      for (const dl of pendingDeadlines) {
        const daysLeft = Math.round((new Date(dl.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const daysLabel = daysLeft <= 0 ? 'DUE TODAY' : `due in ${daysLeft} day(s)`;

        const targets = [dl.owner_user_id, dl.backup_user_id].filter(Boolean);
        for (const uid of targets) {
          await supabase.schema('core').from('notifications').insert({
            user_id: uid,
            title: `Deadline Alert (${daysLabel}): ${dl.title}`,
            body: `${dl.deadline_type} deadline on ${dl.due_date}. Please verify progress.`,
            link: dl.case_id ? `/cases/${dl.case_id}` : dl.agreement_id ? `/agreements/${dl.agreement_id}` : '/deadlines',
            source_app: 'LITIGATOR',
          });
        }

        // Cliq card
        await supabase.schema('litigator').from('cliq_outbox').insert({
          channel: '#litigation-deadlines',
          title: `⚠️ Deadline ${daysLabel}: ${dl.title}`,
          link: dl.case_id ? `/cases/${dl.case_id}` : dl.agreement_id ? `/agreements/${dl.agreement_id}` : '/deadlines',
          card: {
            title: `Deadline Notice: ${dl.title}`,
            due_date: dl.due_date,
            type: dl.deadline_type,
          },
          status: 'QUEUED',
        });
        results.deadlinesNotified++;
      }
    }

    return res.status(200).json({ success: true, timestamp: now.toISOString(), results });
  } catch (err: any) {
    console.error('Cron job error:', err);
    return res.status(500).json({ error: err.message });
  }
}
