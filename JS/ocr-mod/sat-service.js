// sat-service.js
// Llamadas a Cloud Function y verificación de URLs SAT
import { log, warn } from "./anchors-and-utils.js";

function getSatURL(){
  const url = (typeof window!=="undefined" && window.satFunctionURL) ? window.satFunctionURL : "";
  if(!url || url.includes("<REGION>") || url.includes("<TU_PROYECTO>")) throw new Error("satFunctionURL no está configurado.");
  try{ new URL(url); } catch{ throw new Error("satFunctionURL inválido."); }
  return url;
}

export function isOfficialSatUrl(u){
  try{
    const { protocol, hostname, pathname } = new URL(u);
    return protocol==="https:" && hostname.toLowerCase()==="siat.sat.gob.mx" &&
      /^\/app\/qr\/faces\/pages\/mobile\/validadorqr\.jsf$/i.test(pathname);
  }catch{ return false; }
}

export async function callSat(urlDelQr){
  const endpoint = getSatURL();
  log("[SAT][Call]", "POST", endpoint, "←", urlDelQr);
  const resp = await fetch(endpoint, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ url: urlDelQr })
  });
  const ctype = resp.headers.get("content-type") || ""; 
  const raw = await resp.text();
  
  log("[SAT][Call]", "status=", resp.status, "ctype=", ctype);
  
  if(!resp.ok) throw new Error(`SAT error ${resp.status}: ${raw || resp.statusText}`);
  if(!ctype.includes("application/json")) throw new Error("SAT devolvió respuesta no-JSON.");
  
  let data; 
  try{ 
    data = JSON.parse(raw);
  } catch { 
    throw new Error("No se pudo parsear JSON del SAT."); 
  }
  
  if(!data.ok) throw new Error(data.error || "Error al extraer datos del SAT.");
  
  // 🔍 DEBUG: Ver qué llega del backend
  console.log("[SAT][Response] Full data:", data);
  console.log("[SAT][Response] fields keys:", Object.keys(data.fields || {}));
  console.log("[SAT][Response] blob exists:", !!(data.fields && data.fields.blob));
  console.log("[SAT][Response] blob length:", (data.fields && data.fields.blob) ? data.fields.blob.length : 0);
  console.log("[SAT][Response] html length:", (data.fields && data.fields.html) ? data.fields.html.length : 0);
  
  // ✅ Devolver TODO, incluyendo blob y html
  return data.fields || {};
}

export async function callSatPair(urlOpinion, urlCSF){
  const endpoint = getSatURL();
  log("[SAT][Pair]", "POST", endpoint, { urlOpinion, urlCSF });
  const resp = await fetch(endpoint, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ urlOpinion, urlCSF })
  });
  const text = await resp.text(); 
  let data = null; 
  try{ 
    data = JSON.parse(text);
  } catch {}
  
  if(!resp.ok || (data && !data.ok) || (data && !data.rfcMatch)){
    const reason = (data && data.reason) || "SAT_PAIR_FAIL";
    const message = (data && data.error) || `SAT pair failed ${resp.status}`;
    const details = (data && data.details) || {};
    window.dispatchEvent(new CustomEvent("satPairFailed",{ detail:{ reason, message, details, raw:data } }));
    const err = new Error(message); 
    err.reason = reason; 
    err.details = details; 
    throw err;
  }
  window.dispatchEvent(new CustomEvent("satPairVerified",{ detail:data }));
  return data;
}