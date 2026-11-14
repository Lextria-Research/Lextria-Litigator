-- =====================================================================
-- Migration: 0103_add_execution_petition_case_type.sql
-- Description: Expand cases_case_type_check to include EXECUTION_PETITION
-- =====================================================================

ALTER TABLE litigator.cases DROP CONSTRAINT IF EXISTS cases_case_type_check;

ALTER TABLE litigator.cases ADD CONSTRAINT cases_case_type_check CHECK (case_type IN (
  'CIVIL_SUIT',
  'COMMERCIAL_SUIT',
  'IP_INFRINGEMENT',
  'WRIT',
  'APPEAL',
  'ARBITRATION',
  'CONSUMER',
  'CRIMINAL_COMPLAINT',
  'PRE_LITIGATION',
  'EXECUTION_PETITION',
  'OTHER'
));
