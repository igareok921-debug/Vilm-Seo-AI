alter table public.audit_fixes
  drop constraint if exists audit_fixes_issue_type_check;

alter table public.audit_fixes
  add constraint audit_fixes_issue_type_check
  check (
    issue_type in (
      'missing_meta_description',
      'short_meta_description',
      'missing_title',
      'short_title',
      'images_without_alt',
      'duplicate_titles',
      'missing_h1',
      'thin_content',
      'slow_pages'
    )
  );

comment on constraint audit_fixes_issue_type_check on public.audit_fixes is
  'Tipuri de probleme SEO care pot fi remediate sau marcate demonstrativ din UI.';
