-- Remove o esquema antigo (tabela única "docs"). Rode UMA vez, depois de rodar o schema.sql novo.
-- ATENÇÃO: apaga os dados de teste que estavam em "docs" (contas, rolês e chat de antes).
drop table if exists public.docs cascade;
drop function if exists public.valid_doc(text, jsonb);
drop function if exists public.can_make_perfil(text);
drop function if exists public.role_exists(text);
drop function if exists public.is_me(text);
drop function if exists public.doc_merge(text, jsonb);
drop function if exists public.docs_before_write();
