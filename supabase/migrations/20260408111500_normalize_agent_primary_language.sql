-- Normaliza os idiomas antigos dos agentes para locales canonicos
-- e adiciona suporte consistente ao idioma russo.

begin;

alter table public.tb_agents
  alter column primary_language set default 'pt-BR';

update public.tb_agents
set primary_language = case
  when primary_language is null or btrim(primary_language) = '' then 'pt-BR'
  when lower(btrim(primary_language)) in ('en', 'en-us', 'english', 'english-us') then 'en-US'
  when lower(btrim(primary_language)) in ('pt', 'pt-br', 'ptbr', 'portuguese', 'portugues', 'portuguese-br', 'portuguese-brazil') then 'pt-BR'
  when lower(btrim(primary_language)) in ('es', 'es-es', 'spanish', 'espanol', 'español') then 'es-ES'
  when lower(btrim(primary_language)) in ('fr', 'fr-fr', 'french', 'francais', 'français') then 'fr-FR'
  when lower(btrim(primary_language)) in ('de', 'de-de', 'german', 'deutsch') then 'de-DE'
  when lower(btrim(primary_language)) in ('zh', 'zh-cn', 'chinese', 'mandarin') then 'zh-CN'
  when lower(btrim(primary_language)) in ('ja', 'ja-jp', 'japanese', 'jp') then 'ja-JP'
  when lower(btrim(primary_language)) in ('ru', 'ru-ru', 'russian', 'russkiy') then 'ru-RU'
  else primary_language
end;

commit;

-- Verificacao rapida apos o update:
-- select primary_language, count(*) from public.tb_agents group by primary_language order by primary_language;
