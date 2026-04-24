Coloque aqui a CA corporativa usada para inspecao TLS do ambiente.

Sugestao de nome:
- `corporate-ca.pem`
ou
- `fortinet-ca.pem`

Formato esperado:
- PEM / Base-64 encoded X.509

Opcionalmente, voce pode apontar outro caminho usando a variavel:
- `MAIL_TLS_CA_CERT_PATH=C:/caminho/para/corporate-ca.pem`

Essa CA sera usada pelo backend nas conexoes IMAP/SMTP para validar
certificados interceptados por proxy, firewall ou antivirus corporativo.
