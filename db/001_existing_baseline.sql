-- Definition supplied by administrator, already applied in Neon. DO NOT reapply in production.
BEGIN;
CREATE TABLE IF NOT EXISTS lg_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference_date date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','rejected')),
 source_filename text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,
 CHECK(status<>'published' OR published_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS lg_financial_records (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 publication_id uuid NOT NULL REFERENCES lg_publications(id) ON DELETE RESTRICT,
 source_sheet text NOT NULL CHECK(source_sheet IN ('a_vencer','vencido','recebido')),
 source_row integer NOT NULL CHECK(source_row>=2),client_name text NOT NULL,
 title_number text,installment text,full_title_number text,issued_at date,due_at date,received_at date,credit_at date,
 surgery_at date,hospital_name text,health_plan text,representative_name text,collection_description text,
 patient_name text,physician_name text,invoice_amount numeric(18,2),discount_amount numeric(18,2),
 open_amount numeric(18,2),received_amount numeric(18,2),raw_record jsonb NOT NULL DEFAULT '{}',
 CHECK((source_sheet='recebido' AND received_amount IS NOT NULL) OR (source_sheet IN ('a_vencer','vencido') AND open_amount IS NOT NULL)),
 UNIQUE(publication_id,source_sheet,source_row)
);
CREATE INDEX IF NOT EXISTS lg_records_publication_client_idx ON lg_financial_records(publication_id,client_name);
CREATE INDEX IF NOT EXISTS lg_records_publication_sheet_idx ON lg_financial_records(publication_id,source_sheet);
CREATE INDEX IF NOT EXISTS lg_records_received_at_idx ON lg_financial_records(received_at);
CREATE INDEX IF NOT EXISTS lg_records_full_title_idx ON lg_financial_records(publication_id,full_title_number);
CREATE TABLE IF NOT EXISTS lg_audit_issues (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,publication_id uuid NOT NULL REFERENCES lg_publications(id) ON DELETE RESTRICT,
 source_sheet text,source_row integer,issue_code text NOT NULL,severity text NOT NULL CHECK(severity IN ('info','warning','error')),
 details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS lg_audit_publication_idx ON lg_audit_issues(publication_id);
REVOKE ALL ON lg_publications,lg_financial_records,lg_audit_issues FROM PUBLIC;
COMMIT;
