-- =============================================================================
-- Shanthi Ladies Hostel · password_resets — replaces Supabase Auth's built-in
-- reset-password-by-email flow (resetPasswordForEmail / /auth/callback).
-- Same token_hash pattern as sessions: the raw token only ever exists in the
-- emailed link; only its SHA-256 hash is stored, so a DB read alone can't
-- produce a usable reset link. Single-use (used_at) and short-lived.
-- =============================================================================
create table if not exists password_resets (
  id         char(36)  not null primary key default (uuid()),
  user_id    char(36)  not null,
  token_hash char(64)  not null,
  expires_at datetime  not null,
  used_at    datetime  null,
  created_at datetime  not null default current_timestamp,
  constraint fk_password_resets_user foreign key (user_id) references users (id) on delete cascade,
  constraint uq_password_resets_token unique (token_hash)
) engine=InnoDB;

create index idx_password_resets_user on password_resets (user_id);
