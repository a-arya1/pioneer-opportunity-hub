import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const sql=readFileSync(new URL('../supabase/migrations/202609030001_auth_privacy_hardening.sql',import.meta.url),'utf8');
const impactSql=readFileSync(new URL('../supabase/migrations/202609070001_privacy_safe_impact.sql',import.meta.url),'utf8');

describe('account privacy migration',()=>{
  it('enables row-level security on every account and operational table',()=>{
    for(const table of ['profiles','saved_opportunities','reminders','submissions','change_requests','organization_claims','source_channels','import_batches','moderation_events','analytics_events']){
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('ties private data policies to the authenticated user',()=>{
    expect(sql).toContain('auth.uid() = user_id');
    expect(sql).toContain('auth.uid() = submitter_user_id');
    expect(sql).toContain('auth.uid() = requester_user_id');
    expect(sql).toContain('auth.uid() = claimant_user_id');
  });

  it('prevents profile role escalation and supports self-deletion only',()=>{
    expect(sql).toContain("role = 'student'");
    expect(sql).toContain('delete from auth.users where id = auth.uid()');
    expect(sql).not.toMatch(/delete from auth\.users where id\s*=\s*\$\d/i);
  });

  it('does not grant anonymous access to private tables',()=>{
    expect(sql).toContain('revoke all on all tables in schema public from anon, authenticated');
    expect(sql).not.toMatch(/grant .*saved_opportunities to anon/i);
  });
});

describe('privacy-safe impact measurement',()=>{
  it('accepts only an explicit event and page allowlist',()=>{
    expect(impactSql).toContain("'site_visit','page_view','opportunity_view','opportunity_saved'");
    expect(impactSql).toContain("'home','opportunity-directory','opportunity-detail','saved'");
  });

  it('never grants browsers direct access to analytics records',()=>{
    expect(impactSql).not.toMatch(/grant\s+(select|all).*analytics_events.*to\s+(anon|authenticated)/i);
    expect(impactSql).toContain('Returns aggregate project-impact counts only');
  });

  it('automatically removes anonymous events after twelve months',()=>{
    expect(impactSql).toContain("created_at < now()-interval '12 months'");
  });

  it('does not collect emails, searches, or filter values',()=>{
    expect(impactSql).not.toMatch(/p_(email|query|search|filter)/i);
  });

  it('keeps raw feedback private and exposes only validated submission functions',()=>{
    expect(impactSql).toContain('alter table public.feedback_submissions enable row level security');
    expect(impactSql).toContain('revoke all on public.feedback_submissions from anon, authenticated');
    expect(impactSql).toContain("p_audience not in ('student','counselor','educator','parent','community')");
    expect(impactSql).toContain('p_helpfulness not between 1 and 5');
  });

  it('validates correction reports and prevents direct browser inserts',()=>{
    expect(impactSql).toContain('revoke insert on public.submissions, public.change_requests from authenticated');
    expect(impactSql).toContain("p_kind not in ('new','correction','expired','claim','missing-club')");
    expect(impactSql).toContain("trim(p_evidence_url) !~* '^https://");
  });

  it('removes private written feedback and reports after twelve months',()=>{
    expect(impactSql).toContain("delete from public.feedback_submissions where created_at<now()-interval '12 months'");
    expect(impactSql).toContain("delete from public.change_requests where created_at<now()-interval '12 months'");
  });
});
