// netlify/functions/bcra.js

const BASE = "https://api.bcra.gob.ar/centraldedeudores/v1.0";

exports.handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const cuit = (params.cuit || "").replace(/\D/g, "");
    const tipo = params.tipo || "actual";

    if (!/^\d{11}$/.test(cuit)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "CUIT inválido (11 dígitos)" })
      };
    }

    let endpoint;
    switch (tipo) {
      case "actual":
        endpoint = `${BASE}/Deudas/${cuit}`;
        break;
      case "historica":
        endpoint = `${BASE}/Deudas/Historicas/${cuit}`;
        break;
      case "cheques":
        endpoint = `${BASE}/Deudas/ChequesRechazados/${cuit}`;
        break;
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Tipo inválido" })
        };
    }

    const resp = await fetch(endpoint);
    const data = await resp.json();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.errorMessages?.[0] || `Error BCRA (${resp.status})`
        })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Error interno en proxy BCRA" })
    };
  }
};
