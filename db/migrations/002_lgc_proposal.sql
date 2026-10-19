-- Incremental extension of the administrator-supplied 001 schema.
-- Reviewed against supplied SQL; live schema inspection still required before applying.
-- Never run automatically. Isolated namespace avoids changing existing application tables.
BEGIN;
CREATE SCHEMA IF NOT EXISTS lgc;
CREATE TABLE lgc.schema_version(version integer PRIMARY KEY);
INSERT INTO lgc.schema_version VALUES (2);
CREATE TABLE lgc.admin_users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','analyst','viewer')), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lgc.sessions (
 token_hash text PRIMARY KEY, csrf_hash text NOT NULL, user_id uuid NOT NULL REFERENCES lgc.admin_users,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry ON lgc.sessions(expires_at);
CREATE TABLE lgc.login_attempts (key text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL);
CREATE TABLE lgc.imports (
 id uuid PRIMARY KEY, file_sha256 text NOT NULL, reference_date date NOT NULL,
 snapshot jsonb NOT NULL, created_by uuid NOT NULL REFERENCES lgc.admin_users,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE lgc.clients(id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE lgc.titles (
 id text PRIMARY KEY, client_id text NOT NULL REFERENCES lgc.clients,
 document text NOT NULL, installment text NOT NULL, UNIQUE(client_id,document,installment)
);
CREATE TABLE lgc.audit_issues (
 id uuid PRIMARY KEY, import_id uuid NOT NULL REFERENCES lgc.imports,
 code text NOT NULL,severity text NOT NULL,sheet text NOT NULL,source_row integer NOT NULL,
 detail jsonb NOT NULL
);
CREATE TABLE lgc.publications (
 id uuid PRIMARY KEY REFERENCES public.lg_publications(id), import_id uuid NOT NULL UNIQUE REFERENCES lgc.imports,
 reference_date date NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
 published_by uuid NOT NULL REFERENCES lgc.admin_users,
 totals jsonb NOT NULL, counts jsonb NOT NULL, validation jsonb NOT NULL,
 UNIQUE(reference_date,import_id)
);
CREATE INDEX publications_reference ON lgc.publications(reference_date,published_at DESC);
CREATE TABLE lgc.current_publication (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), publication_id uuid REFERENCES lgc.publications
);
INSERT INTO lgc.current_publication(singleton) VALUES(true);
CREATE TABLE lgc.operations (
 id uuid PRIMARY KEY, actor uuid REFERENCES lgc.admin_users, action text NOT NULL,
 resource_id uuid,created_at timestamptz NOT NULL DEFAULT now(), detail jsonb NOT NULL DEFAULT '{}'
);
REVOKE ALL ON SCHEMA lgc FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA lgc FROM PUBLIC;
-- Public clinical columns remain NULL. No old data is changed.
ALTER TABLE public.lg_financial_records ADD COLUMN accounting_band text
 CHECK(accounting_band IN ('upcoming','overdue','received'));
ALTER TABLE public.lg_financial_records ADD COLUMN client_key text REFERENCES lgc.clients(id);
ALTER TABLE public.lg_financial_records ADD COLUMN title_key text REFERENCES lgc.titles(id);
CREATE INDEX lg_records_title_key_idx ON public.lg_financial_records(publication_id,title_key);
COMMIT;
