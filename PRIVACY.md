# Política de Privacidade — WA Tools · Privacidade

**Vigência:** 30 de julho de 2026

## Resumo

**Esta extensão não coleta, transmite, armazena remotamente nem compartilha nenhum dado pessoal.** Todo o processamento acontece **localmente** no seu navegador. Não há servidores, contas, login, analytics, rastreamento ou anúncios.

## Dados que a extensão trata (e onde ficam)

A extensão guarda **apenas as suas configurações** em `chrome.storage.local` (armazenamento local do navegador):

- Preferências de desfoque (nomes, fotos, mensagens, etc.) e o modo de blindagem;
- Regras por-conversa (quais sinais suprimir em quais conversas);
- Um **hash** da senha do bloqueio (derivado com PBKDF2 — a senha em si **nunca** é armazenada).

Esses dados **nunca saem do seu dispositivo**. A extensão **não** usa `storage.sync` e **não** faz nenhuma requisição de rede a servidores próprios ou de terceiros.

## Conteúdo das suas conversas

A extensão **não lê, não armazena e não transmite** o conteúdo das suas mensagens, contatos ou mídias. Ela apenas:

- suprime **metadados de saída** que você emite (confirmação de leitura, presença online, "digitando", etc.); e
- aplica uma **camada visual local** (desfoque/blur) sobre a interface, mais um bloqueio por senha local.

## Permissões e por quê

- **`storage`** — salvar suas configurações localmente.
- **`activeTab`** — interagir com a aba do WhatsApp Web que você está usando.
- **host `web.whatsapp.com`** — a extensão só é executada no WhatsApp Web; não tem acesso a nenhum outro site.

A extensão **não** solicita `webRequest`, `<all_urls>`, `unlimitedStorage`, `identity` nem qualquer permissão de rede ampla.

## Compartilhamento e venda de dados

Nenhum. Como nada é coletado, nada é compartilhado ou vendido. A extensão está em conformidade com a política de **Uso Limitado** da Chrome Web Store por não manusear dados do usuário.

## Não afiliação

Projeto independente. **Não** é afiliado, associado, endossado ou patrocinado pelo WhatsApp ou pela Meta. "WhatsApp" é marca da Meta Platforms, Inc.

## Alterações

Mudanças nesta política serão publicadas neste arquivo, com atualização da data de vigência.

## Contato

Dúvidas ou relatos: abra uma _issue_ em https://github.com/ialbas/wa-tools/issues
