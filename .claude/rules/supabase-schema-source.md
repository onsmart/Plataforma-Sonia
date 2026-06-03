# Schema Supabase (projeto Sonia)

Antes de **propor, escrever, revisar ou colar migrations SQL** para o Supabase neste repositório:

1. Abra e use como referência obrigatória: `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md`
2. Alinhe colunas, nomes de RPCs, tipos de retorno e escopo (quais tabelas tocar) com esse documento.
3. Depois que uma migration for aplicada no banco e mudar o modelo, **atualize** o mesmo `.md` (seções de tabelas, RPCs, histórico de verificação) no mesmo esforço do PR ou num commit seguinte imediato.

Se o documento estiver desatualizado em relação ao código, prefira corrigir o documento ou pedir ao usuário um novo inventário (SQL read-only) antes de assumir colunas ou assinaturas.
