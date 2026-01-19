/**
 * Constrói HTML do email baseado no corpo e estilo visual
 * @param body - Texto do corpo do email
 * @param style - Estilo visual (ex: "colorido_com_emojis" ou padrão)
 * @returns HTML formatado do email
 */
export function buildEmailHtml(body: string, style?: string): string {
  // Se não houver estilo definido, retorna HTML simples
  if (!style || style.trim() === '') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${escapeHtml(body)}</div>
</body>
</html>
    `.trim()
  }

  // Estilo "colorido_com_emojis"
  if (style.toLowerCase() === 'colorido_com_emojis') {
    // Adiciona emojis e cores ao texto
    const coloredBody = addEmojisAndColors(body)
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="font-size: 16px; line-height: 1.8;">
      ${coloredBody}
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  // Estilo padrão (HTML simples)
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="white-space: pre-wrap;">${escapeHtml(body)}</div>
</body>
</html>
  `.trim()
}

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(text: string): string {
  const div = { innerHTML: '' } as any
  div.textContent = text
  return div.innerHTML || text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Adiciona emojis e cores ao texto para estilo colorido
 */
function addEmojisAndColors(text: string): string {
  // Quebra o texto em parágrafos
  const paragraphs = text.split('\n\n').filter(p => p.trim())
  
  const emojiMap: Record<string, string> = {
    'email': '📧',
    'telefone': '📞',
    'contato': '📱',
    'obrigado': '🙏',
    'sucesso': '✅',
    'erro': '❌',
    'atenção': '⚠️',
    'info': 'ℹ️',
    'data': '📅',
    'hora': '⏰',
    'local': '📍',
    'link': '🔗',
    'documento': '📄',
    'imagem': '🖼️',
    'video': '🎥',
    'audio': '🎵',
  }

  // Cores para diferentes tipos de conteúdo
  const colors = [
    '#667eea', // Roxo
    '#764ba2', // Roxo escuro
    '#f093fb', // Rosa
    '#4facfe', // Azul
    '#43e97b', // Verde
    '#fa709a', // Rosa claro
  ]

  return paragraphs.map((paragraph, index) => {
    let processed = paragraph
    
    // Adiciona emojis baseado em palavras-chave
    Object.entries(emojiMap).forEach(([keyword, emoji]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      if (regex.test(processed)) {
        processed = processed.replace(regex, `${emoji} $&`)
      }
    })

    // Aplica cor ao parágrafo
    const color = colors[index % colors.length]
    
    return `<p style="color: ${color}; font-weight: 500; margin: 15px 0; padding: 10px; background: rgba(102, 126, 234, 0.1); border-left: 4px solid ${color}; border-radius: 4px;">
      ${escapeHtml(processed)}
    </p>`
  }).join('')
}
