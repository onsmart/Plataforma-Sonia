# Passo a passo no servidor (o que deu certo)

Resumo do que funcionou ao subir/atualizar o **BackEnd** em `~/plataform-backend/BackEnd`, incluindo correção de permissões para `npm install`, `npm run build` e execução do deploy.

---

## 1. Onde trabalhar

```bash
cd ~/plataform-backend/BackEnd
```

Confirme que existe `package.json` e a pasta `src/`.

---

## 2. Erro `npm install` — `EACCES` / `permission denied` em `node_modules`

**Causa comum:** arquivos ou pastas criados como **root** (por exemplo `sudo npm install` ou zip extraído com sudo), ou dono errado.

**Correção:**

```bash
cd ~/plataform-backend/BackEnd
sudo chown -R servidoronsmart:servidoronsmart .
rm -rf node_modules
npm install
```

Se ainda falhar, limpe o cache e instale de novo:

```bash
npm cache clean --force
npm install
```

**Evitar:** não rodar `npm install` com `sudo` dentro do projeto.

---

## 3. Erro `npm run build` — `Cannot find module` / TypeScript não acha arquivos

**Causa que ocorreu aqui:** os arquivos existiam no servidor, mas **pastas sem bit de execução** (`drw-rw-r--` em vez de `drwx…`). Sem `x` no diretório, o usuário normal não “atravessa” a pasta — o `tsc` não lê os `.ts` e aparece como módulo inexistente.

**Sintoma:** com usuário normal, `find src` dá `Permission denied` em várias pastas; com `sudo find` a contagem de `.ts` está correta (ex.: 92 arquivos).

**Correção (ajustar dono e permissões):**

```bash
cd ~/plataform-backend/BackEnd

sudo chown -R servidoronsmart:servidoronsmart .

sudo find . -type d -exec chmod u+rwx,g+rx,o-rwx {} \;
sudo find . -type f -exec chmod u+rw,g+r,o-rwx {} \;
```

**Conferência (sem sudo):**

```bash
find src -type f -name '*.ts' | wc -l
```

Deve listar **sem** `Permission denied` e com a contagem esperada (ex.: 92).

**Build:**

```bash
npm run build
```

---

## 4. Executar o script de deploy

O script fica em `BackEnd/scripts/deploy.sh` e exige **Docker** em execução, **docker-compose**, **Node** e **npm**.

```bash
cd ~/plataform-backend/BackEnd
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Opções úteis:**

| Opção | Efeito |
|--------|--------|
| `./scripts/deploy.sh --help` | Ajuda |
| `./scripts/deploy.sh --dry-run` | Simula sem aplicar |
| `./scripts/deploy.sh --skip-build` | Pula a compilação TypeScript |
| `./scripts/deploy.sh --no-backup` | Não faz backup antes do deploy |

---

## 5. Checklist rápido

1. `cd ~/plataform-backend/BackEnd`
2. `sudo chown -R servidoronsmart:servidoronsmart .`
3. Ajustar `chmod` em diretórios/arquivos (passo 3) se `find src` falhar sem sudo
4. `npm install`
5. `find src -type f -name '*.ts' \| wc -l` (sem erros de permissão)
6. `npm run build`
7. `./scripts/deploy.sh`

---

*Documento gerado a partir do que funcionou na prática (permissões + build + deploy).*
