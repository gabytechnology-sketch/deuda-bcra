const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join('/tmp', 'bcra-cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

// Cargamos el caché (si existe)
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (e) {}
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const cuit = event.queryStringParameters?.cuit || event.path.split('/').pop();

    if (!cuit || cuit.length !== 11 || isNaN(cuit)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "CUIT inválido. Debe tener 11 dígitos." }) };
    }

    const now = Date.now();
    const cacheKey = cuit;

    // ¿Está en caché y es fresco?
    if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_DURATION) {
      console.log(`✅ Caché hit para ${cuit}`);
      return { statusCode: 200, headers, body: JSON.stringify(cache[cacheKey].data) };
    }

    // === AQUÍ EXPLOTAMOS LA API DEL BCRA ===
    console.log(`🔄 Consultando BCRA para ${cuit}`);

    const base = 'https://api.bcra.gob.ar/centraldedeudores/v1.0';

    const [deudasRes, historicasRes, chequesRes] = await Promise.all([
      fetch(`${base}/Deudas/${cuit}`),
      fetch(`${base}/Deudas/Historicas/${cuit}`),
      fetch(`${base}/Deudas/ChequesRechazados/${cuit}`)
    ]);

    const deudas = await deudasRes.json();
    const historicas = await historicasRes.json();
    const cheques = await chequesRes.json();

    const resultado = {
      status: 200,
      denominacion: deudas.results?.denominacion || "No encontrado",
      deudas: deudas,
      historicas: historicas,
      cheques: cheques
    };

    // Guardamos en caché
    cache[cacheKey] = {
      timestamp: now,
      data: resultado
    };

    // Guardamos el archivo caché
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));

    return { statusCode: 200, headers, body: JSON.stringify(resultado) };

  } catch (error) {
    console.error(error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: "Error temporal del BCRA. Intenta de nuevo en unos segundos." }) 
    };
  }
};
