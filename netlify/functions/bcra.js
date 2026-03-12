const fs = require('fs');
const path = require('path');

const CACHE_DIR = '/tmp/bcra-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

// Crear carpeta si no existe (Netlify lo permite en /tmp)
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const params = event.queryStringParameters || {};
    const tipo = params.tipo;
    const cuit = params.cuit || event.path.split('/').pop();

    if (!cuit || cuit.length !== 11 || isNaN(Number(cuit))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "CUIT inválido (debe ser exactamente 11 dígitos numéricos)" })
      };
    }

    if (!['actual', 'historica', 'cheques'].includes(tipo)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Tipo inválido. Usa: actual, historica o cheques" })
      };
    }

    // Clave única por cuit + tipo
    const cacheKey = `${cuit}_${tipo}`;
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);

    const now = Date.now();

    // ¿Existe caché fresco?
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (now - cached.timestamp < CACHE_DURATION_MS) {
        console.log(`Cache hit: ${cacheKey}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(cached.data)
        };
      }
    }

    // No hay caché o está viejo → consultar BCRA
    console.log(`Consultando BCRA: ${tipo} para ${cuit}`);

    const baseUrl = 'https://api.bcra.gob.ar/centraldedeudores/v1.0';
    let endpoint;

    if (tipo === 'actual') endpoint = `/Deudas/${cuit}`;
    else if (tipo === 'historica') endpoint = `/Deudas/Historicas/${cuit}`;
    else if (tipo === 'cheques') endpoint = `/Deudas/ChequesRechazados/${cuit}`;

    const response = await fetch(`${baseUrl}${endpoint}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify(errorData || { error: `Error BCRA: ${response.status}` })
      };
    }

    const data = await response.json();

    // Guardar en caché
    const cacheData = {
      timestamp: now,
      data: data
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error interno. Intenta nuevamente en unos segundos." })
    };
  }
};
