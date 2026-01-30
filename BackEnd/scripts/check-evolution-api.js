/**
 * Script para descobrir onde a Evolution API está rodando
 * 
 * Uso: node scripts/check-evolution-api.js
 */

const axios = require('axios');
const net = require('net');

// URLs comuns onde a Evolution API pode estar rodando
const commonUrls = [
  'http://192.168.15.31:8081',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'http://0.0.0.0:8081',
  'http://0.0.0.0:3000',
];

// API Keys para testar
const apiKeys = [
  'dRppeelqikQ1nUXTtaNtRRcQsQO15HPEvDRgqjnfkzi5E72t/U9Em5Ico9RDW34qaislql2yEM1edJ/6cSW/uA==',
  process.env.EVOLUTION_API_KEY,
].filter(Boolean);

/**
 * Verifica se uma porta está aberta
 */
function checkPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Testa uma URL da Evolution API
 */
async function testEvolutionAPI(url, apiKey) {
  try {
    const response = await axios.get(`${url}/instance/fetchInstances`, {
      headers: {
        'apikey': apiKey
      },
      timeout: 3000
    });

    // Verifica se a resposta é realmente da Evolution API
    // Evolution API retorna JSON (array ou objeto), não HTML
    const isHTML = typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>');
    const isJSON = typeof response.data === 'object' || (typeof response.data === 'string' && response.data.trim().startsWith('[') || response.data.trim().startsWith('{'));

    if (isHTML) {
      return {
        success: false,
        url,
        error: 'Resposta é HTML (não é Evolution API)',
        code: 'NOT_EVOLUTION_API'
      };
    }

    if (!isJSON) {
      return {
        success: false,
        url,
        error: 'Resposta não é JSON válido',
        code: 'INVALID_RESPONSE'
      };
    }

    return {
      success: true,
      url,
      apiKey: apiKey.substring(0, 10) + '...',
      data: response.data
    };
  } catch (error) {
    // Se for 401/403, pode ser Evolution API mas com API key errada
    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        url,
        error: `Possível Evolution API, mas API key incorreta (${error.response.status})`,
        code: 'AUTH_ERROR',
        isPossibleEvolutionAPI: true
      };
    }

    return {
      success: false,
      url,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Descobre portas abertas
 */
async function discoverOpenPorts() {
  console.log('🔍 Verificando portas comuns...\n');
  
  const ports = [8081, 3000, 5000, 4000, 9000];
  const hosts = ['localhost', '127.0.0.1'];
  const openPorts = [];

  for (const host of hosts) {
    for (const port of ports) {
      const isOpen = await checkPort(host, port);
      if (isOpen) {
        openPorts.push({ host, port, url: `http://${host}:${port}` });
        console.log(`✅ Porta ${port} está aberta em ${host}`);
      }
    }
  }

  return openPorts;
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Descobrindo onde a Evolution API está rodando...\n');
  console.log('='.repeat(60));

  // 1. Verifica portas abertas
  const openPorts = await discoverOpenPorts();
  
  if (openPorts.length === 0) {
    console.log('\n❌ Nenhuma porta comum está aberta.');
    console.log('💡 A Evolution API pode não estar rodando ou está em outra porta.\n');
  } else {
    console.log(`\n📋 Encontradas ${openPorts.length} porta(s) aberta(s).\n`);
  }

  // 2. Testa URLs comuns
  console.log('🔍 Testando URLs comuns da Evolution API...\n');
  
  const results = [];
  
  for (const url of commonUrls) {
    for (const apiKey of apiKeys) {
      const result = await testEvolutionAPI(url, apiKey);
      results.push(result);
      
      if (result.success) {
        console.log(`\n✅ ✅ ✅ EVOLUTION API ENCONTRADA! ✅ ✅ ✅\n`);
        console.log(`📍 URL: ${result.url}`);
        console.log(`🔑 API Key: ${result.apiKey}`);
        console.log(`📊 Resposta:`, JSON.stringify(result.data, null, 2));
        console.log(`\n💡 Adicione esta URL no arquivo BackEnd/.env:`);
        console.log(`EVOLUTION_API_URL=${result.url}\n`);
        return;
      } else {
        if (result.code === 'AUTH_ERROR' || result.isPossibleEvolutionAPI) {
          console.log(`⚠️  ${url} - ${result.error} (mas pode ser Evolution API com API key errada)`);
        } else if (result.code !== 'ECONNREFUSED' && result.code !== 'NOT_EVOLUTION_API') {
          console.log(`⚠️  ${url} - ${result.error}`);
        }
      }
    }
  }

  // 3. Testa portas abertas descobertas
  if (openPorts.length > 0) {
    console.log('\n🔍 Testando portas abertas descobertas...\n');
    
    for (const { url } of openPorts) {
      if (!commonUrls.includes(url)) {
        for (const apiKey of apiKeys) {
          const result = await testEvolutionAPI(url, apiKey);
          if (result.success) {
            console.log(`\n✅ ✅ ✅ EVOLUTION API ENCONTRADA! ✅ ✅ ✅\n`);
            console.log(`📍 URL: ${result.url}`);
            console.log(`🔑 API Key: ${result.apiKey}`);
            console.log(`📊 Resposta:`, JSON.stringify(result.data, null, 2));
            console.log(`\n💡 Adicione esta URL no arquivo BackEnd/.env:`);
            console.log(`EVOLUTION_API_URL=${result.url}\n`);
            return;
          }
        }
      }
    }
  }

  // 4. Resultado final
  console.log('\n❌ Evolution API não foi encontrada nas URLs testadas.\n');
  console.log('📋 URLs testadas:');
  commonUrls.forEach(url => console.log(`   - ${url}`));
  
  if (openPorts.length > 0) {
    console.log('\n📋 Portas abertas encontradas (mas não são Evolution API):');
    openPorts.forEach(({ url }) => console.log(`   - ${url}`));
  }
  
  console.log('\n💡 Próximos passos:');
  console.log('   1. Verifique se a Evolution API está rodando');
  console.log('   2. Verifique a documentação da Evolution API para descobrir a URL padrão');
  console.log('   3. Se estiver usando Docker, verifique: docker ps');
  console.log('   4. Se estiver usando outro servidor, verifique o IP/porta');
  console.log('   5. Verifique arquivos de configuração da Evolution API (.env, config.json, etc.)\n');
}

main().catch(console.error);
