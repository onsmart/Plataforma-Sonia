/**
 * Texto base para RAG / prompt da demo Onsmart (www.onsmart.ai).
 * Faça upload deste conteúdo como arquivo .txt na base de conhecimento do agente provisionado.
 */
export const ONSMART_FAQ_SEED_TEXT = `
Onsmart.AI — soluções de tecnologia e inteligência artificial para empresas.

Principais frentes:
- Agentes de IA para atendimento receptivo (WhatsApp, webchat, voz) com triagem e FAQ.
- Automação de fluxos conversacionais integrados a CRM, e-mail e calendários.
- Plataforma Sonia: criação e operação de agentes, governança, métricas e integrações.
- Consultoria e implementação de IA generativa em processos de vendas, suporte e operações.

Diferenciais:
- Integração multicanal (Meta WhatsApp, HubSpot, Calendly, e-mail).
- Base de conhecimento (RAG) para respostas alinhadas ao negócio do cliente.
- Operação híbrida: agente único ou fluxos visuais conforme a maturidade do cliente.

Para conhecer cases, preços sob medida ou agendar uma conversa com o time comercial, o visitante pode usar este chat ou o site https://www.onsmart.ai .

Escopo desta assistente (Sonia demo):
- Responder dúvidas sobre tecnologia, IA e serviços Onsmart conforme este material e a base de conhecimento anexada.
- Agendar reunião/diagnóstico via Calendly quando o usuário demonstrar interesse.
- Não prestar suporte técnico de produtos de terceiros nem temas fora de tecnologia/IA/Onsmart.
`.trim()

export const ONSMART_WELCOME_MESSAGE =
  'Olá! Tudo bem? Eu sou a Sonia, assistente virtual da Onsmart.AI. Posso esclarecer dúvidas sobre nossas soluções de tecnologia e inteligência artificial, ou agendar uma conversa com nosso time pelo Calendly — tudo aqui no WhatsApp. Como posso ajudar você hoje?'
