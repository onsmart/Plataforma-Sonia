# Handoff: certificado para integracao Gmail

## Objetivo

Deixar registrado o que foi feito para viabilizar a integracao de email com Gmail no projeto e o que ainda falta concluir quando essa frente for retomada.

## Contexto do problema

A integracao atual de Gmail no sistema nao usa OAuth do Google. Hoje o projeto trata Gmail como um provedor `generic_imap_smtp`, com leitura via IMAP e envio via SMTP, usando `app_password`.

Em ambientes corporativos com inspecao TLS ativa (proxy, firewall, antivirus, Fortinet etc.), o certificado apresentado para `imap.gmail.com` e `smtp.gmail.com` pode ser reemitido por uma CA interna. Nesses casos, o Node.js pode rejeitar a conexao com erros de confianca de certificado.

Resumo pratico: a integracao de Gmail pode falhar nao por usuario/senha, mas porque o backend nao confia na CA corporativa que esta interceptando o TLS.

## O que ja foi implementado

Foi adicionada uma forma opcional de carregar uma CA customizada para as conexoes IMAP/SMTP do backend.

Arquivos envolvidos:

- `BackEnd/src/lib/tls-ca.ts`
- `BackEnd/src/services/integrations/mail/providers/imap-smtp.provider.ts`
- `BackEnd/certs/README.md`
- `BackEnd/.gitignore`

### Comportamento implementado

O backend agora procura um certificado CA nestes caminhos:

1. Variavel de ambiente `MAIL_TLS_CA_CERT_PATH`
2. `BackEnd/certs/corporate-ca.pem`
3. `BackEnd/certs/fortinet-ca.pem`

Se encontrar um arquivo valido, esse bundle e injetado em:

- conexao IMAP (`ImapFlow`)
- transporte SMTP (`nodemailer`)

Assim, quando o ambiente corporativo interceptar o TLS, o backend consegue confiar na cadeia apresentada, desde que a CA correta esteja disponivel em `.pem`.

### Observacao importante

Os arquivos de certificado foram colocados no `.gitignore`:

- `certs/*.pem`
- `certs/*.cer`
- `certs/*.crt`

Ou seja: o certificado nao deve ser versionado no repositorio.

## Como o Gmail esta configurado hoje

No front e no backend, o preset de Gmail esta configurado assim:

- `providerFamily`: `generic_imap_smtp`
- `authType`: `app_password`
- `readMethod`: `imap`
- `sendMethod`: `smtp`
- `smtpHost`: `smtp.gmail.com`
- `smtpPort`: `587`
- `imapHost`: `imap.gmail.com`
- `imapPort`: `993`

Isso significa que, para o Gmail funcionar, continuam sendo necessarios:

- IMAP habilitado na conta, se aplicavel ao ambiente usado
- conta com 2FA
- `app password` gerada no Google

## O que falta fazer

### 1. Obter a CA correta do ambiente

Pegar o certificado raiz/intermediario usado pela inspecao TLS do ambiente onde o backend roda.

Exemplos comuns:

- Fortinet
- proxy corporativo
- antivirus com HTTPS inspection
- certificado interno da empresa

O objetivo aqui e exportar a CA em formato `PEM`.

### 2. Colocar o arquivo no backend

Opcoes:

- salvar em `BackEnd/certs/corporate-ca.pem`
- salvar em `BackEnd/certs/fortinet-ca.pem`
- ou apontar um caminho externo com `MAIL_TLS_CA_CERT_PATH`

Exemplo:

```env
MAIL_TLS_CA_CERT_PATH=C:/caminho/para/corporate-ca.pem
```

### 3. Reiniciar o backend

Depois de adicionar o certificado, reiniciar a aplicacao para o Node recarregar o bundle.

### 4. Validar a integracao Gmail

Fazer um teste completo com uma conta Gmail real:

1. preencher email/usuario
2. usar `app password`
3. salvar a integracao
4. testar conexao
5. validar leitura IMAP
6. validar envio SMTP

## Sinais esperados de que era mesmo problema de certificado

Se o problema for a cadeia TLS, os erros tendem a parecer com algo nessa linha:

- `self signed certificate in certificate chain`
- `unable to verify the first certificate`
- `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`
- falha de handshake TLS no IMAP/SMTP

Se, apos informar a CA correta, a conexao passar, entao a causa raiz estava no certificado do ambiente.

## Onde retomar depois

Quando voltarmos para essa tarefa, a sequencia recomendada e:

1. confirmar em qual maquina/servidor o backend esta rodando
2. exportar a CA dessa maquina/ambiente
3. colocar o `.pem` em `BackEnd/certs/`
4. reiniciar o backend
5. testar a integracao Gmail com `app password`
6. registrar o resultado final

## Status atual

- suporte no codigo para CA customizada: concluido
- documentacao basica em `BackEnd/certs/README.md`: concluido
- versionamento protegido via `.gitignore`: concluido
- certificado real do ambiente: pendente
- teste final da integracao Gmail: pendente

## Nota final

Se futuramente quisermos integracao nativa com Google OAuth para Gmail, isso sera uma frente separada. O que foi preparado agora resolve o cenario atual de Gmail via IMAP/SMTP em ambiente com inspecao TLS.
