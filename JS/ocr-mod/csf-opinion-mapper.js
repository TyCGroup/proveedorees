
// csf-opinion-mapper.js
// Mapear respuestas del SAT (CSF/Opinión) a estructura documentData
import {
  ANCHORS, sanitizeBlob, extractBetweenAnchors, stripLeadingLabel, _postClean,
  parseAnyDate, cleanCompanyName, guessTipoPersona, log, warn
} from "./anchors-and-utils.js";
import { extractEconomicActivitiesSection, parseEconomicActivities } from "./economic-activities.js";

export function extractCadenaOriginalDate(raw){
  if(!raw) return null;
  const text = sanitizeBlob(raw);
  let m = text.match(/\|\|(\d{4}[/-]\d{2}[/-]\d{2}\s+\d{2}:\d{2}:\d{2})\|/);
  if(m){
    const dt = m[1].replace(/-/g,"/");
    const parts = dt.split(/\s+/); const d=parts[0].split("/"); const t=parts[1].split(":");
    const date=new Date(parseInt(d[0],10), parseInt(d[1],10)-1, parseInt(d[2],10),
                        parseInt(t[0],10), parseInt(t[1],10), parseInt(t[2],10));
    return isNaN(date)? null : date;
  }
  const m2 = text.match(/LUGAR\s+y\s+FECHA\s+DE\s+EMISI[ÓO]N.*?A\s+([0-9]{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+20\d{2})/i);
  if(m2){ return parseAnyDate(m2[1]); }
  return null;
}

export function mapSatCSFToDoc(fields){
  const rawBlob = (fields.blob||fields.html||fields.raw||fields.fullText||fields.all_text||"")+"";
  const blob = sanitizeBlob(rawBlob);

  let rfc = (fields.rfc||"").toUpperCase().trim();
  const rfcRegex=/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
  if(!rfcRegex.test(rfc) && blob){
    let m = blob.match(/\bRFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i) ||
            blob.match(/\bEL\s*RFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i) ||
            blob.match(/\|\|[\d/ :]{19}\|([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\|CONSTANCIA/i);
    if(m) rfc = m[1].toUpperCase();
  }
  const isFisica = guessTipoPersona(rfc)==="FISICA";

  // ========================================
  // 🔹 EXTRACCIÓN MEJORADA DEL NOMBRE
  // ========================================
  let razon = "";
  
  // Intentar primero con el campo directo
  const razonRaw = (fields.razon_social||"").toString().trim();
  razon = cleanCompanyName(razonRaw);
  
  const looksContaminated = !razon || 
    razon.length < 3 || 
    /R[ée]gimen|Fecha|Situaci[óo]n|Datos de ubicaci[óo]n|Entidad|Municipio/i.test(razonRaw);
  
  // Si está contaminado o vacío, buscar en el blob
  if (!razon || looksContaminated) {
    log("[CSF]", "Nombre incompleto o contaminado, buscando en blob...");
    
    // 🔹 Patrones múltiples para capturar el nombre completo
    const patterns = [
      // Patrón 1: Denominación o Razón Social con múltiples líneas
      /Denominaci[óo]n\s+(?:o|\/)\s+Raz[óo]n\s+Social\s*:?\s*([^\n]+(?:\n[^\n:]+)*?)(?=\s*(?:R[ée]gimen|Fecha|Situaci[óo]n|Entidad|Municipio|Datos de ubicaci[óo]n|$))/i,
      
      // Patrón 2: Solo "Razón Social"
      /Raz[óo]n\s+Social\s*:?\s*([^\n]+(?:\n[^\n:]+)*?)(?=\s*(?:R[ée]gimen|Fecha|Situaci[óo]n|Entidad|Municipio|$))/i,
      
      // Patrón 3: Solo "Denominación"
      /Denominaci[óo]n\s*:?\s*([^\n]+(?:\n[^\n:]+)*?)(?=\s*(?:R[ée]gimen|Fecha|Situaci[óo]n|Entidad|Municipio|$))/i,
      
      // Patrón 4: Nombre, Denominación o Razón Social
      /Nombre\s*,?\s*Denominaci[óo]n\s+o\s+Raz[óo]n\s+Social\s*:?\s*([^\n]+(?:\n[^\n:]+)*?)(?=\s*(?:R[ée]gimen|Fecha|Situaci[óo]n|$))/i,
    ];
    
    for (const pattern of patterns) {
      const match = blob.match(pattern);
      if (match && match[1]) {
        let extracted = match[1]
          .replace(/\s{2,}/g, ' ')           // Múltiples espacios
          .replace(/[\r\n\t]+/g, ' ')        // Saltos de línea y tabs
          .replace(/\u00A0/g, ' ')           // Espacios no-breaking
          .trim();
        
        // 🔹 Limpiar palabras clave que no son parte del nombre
        extracted = extracted
          .replace(/^(?:Denominación|Razón\s+Social|Nombre)\s*:?\s*/i, '')
          .replace(/\s*(?:Régimen|Regimen|Fecha|Situación|Situacion|Datos).*$/i, '');
        
        const cleaned = cleanCompanyName(extracted);
        
        if (cleaned && cleaned.length >= 5 && !looksContaminated) {
          log("[CSF]", `Nombre extraído del blob: "${cleaned}"`);
          razon = cleaned;
          break;
        }
      }
    }
  }
  
  // Si es persona física y sigue sin nombre válido
  if (isFisica && (!razon || razon.length < 5)) {
    log("[CSF]", "Persona física, intentando construir nombre completo...");
    const first = (fields.nombre||fields.nombres||fields.name||"").toString().trim();
    const pat = (fields.apellido_paterno||fields.paterno||"").toString().trim();
    const mat = (fields.apellido_materno||fields.materno||"").toString().trim();
    const joined = [first,pat,mat].filter(Boolean).join(" ");
    razon = cleanCompanyName(joined) || (rfc? `PF ${rfc}`:"");
  }
  
  // Si después de todo no hay nombre, usar extractBetweenAnchors como último recurso
  if (!razon || razon.length < 3) {
    log("[CSF]", "Último intento con extractBetweenAnchors...");
    const extracted = extractBetweenAnchors(blob, ANCHORS.companyName.start, ANCHORS.companyName.end, {maxLen:150});
    if (extracted) {
      razon = cleanCompanyName(extracted);
      log("[CSF]", `Nombre extraído con anchors: "${razon}"`);
    }
  }

// ========================================
// 🔹 EXTRACCIÓN DE CALLE (solo nombre, sin tipo)
// ========================================
let calle = "";

// Primero intentar con los campos separados del backend
if (fields.vialidad_nombre) {
  calle = String(fields.vialidad_nombre).trim();
} else if (fields.tipo_vialidad && fields.vialidad_nombre) {
  // Si vienen ambos, usar solo el nombre
  calle = String(fields.vialidad_nombre).trim();
}

// Si no viene o viene vacío, buscar en el blob
if (!calle && blob) {
  const calleFromBlob = extractBetweenAnchors(blob, ANCHORS.calle.start, ANCHORS.calle.end, {maxLen:80});
  if (calleFromBlob) {
    calle = stripLeadingLabel(calleFromBlob);
    // 🔹 Quitar el tipo de vialidad si viene pegado
    calle = calle
      .replace(/^(?:CALLE|AVENIDA|BOULEVARD|BLVD\.?|PRIVADA|CALZADA|CIRCUITO|ANDADOR|CERRADA)\s+/i, '')
      .trim();
  }
}

calle = _postClean(calle, 80);

  let numero="";
  if(fields.numero_exterior){
    numero = String(fields.numero_exterior);
    if(fields.numero_interior) numero += ` Int ${fields.numero_interior}`;
  }else if(blob){
    const noExt = extractBetweenAnchors(blob, ANCHORS.numeroExterior.start, ANCHORS.numeroExterior.end, {maxLen:15});
    if(noExt) numero = noExt;
  }
  numero = _postClean(numero,20);

  let colonia = fields.colonia || "";
  if(!colonia && blob) colonia = extractBetweenAnchors(blob, ANCHORS.colonia.start, ANCHORS.colonia.end, {maxLen:80});
  colonia = _postClean(colonia,80);

  let municipio = fields.municipio || "";
  if(!municipio && blob) municipio = extractBetweenAnchors(blob, ANCHORS.municipio.start, ANCHORS.municipio.end, {maxLen:80});
  municipio = _postClean(municipio,80);

  let entidad = fields.entidad || "";
  if(!entidad && blob) entidad = extractBetweenAnchors(blob, ANCHORS.entidad.start, ANCHORS.entidad.end, {maxLen:80});
  entidad = _postClean(entidad,80);

  let cp = fields.cp || "";
  if(!cp && blob) cp = extractBetweenAnchors(blob, ANCHORS.cp.start, ANCHORS.cp.end, {maxLen:10});
  cp = _postClean(cp,10);

  const emissionDate = parseAnyDate(fields.fecha_ultimo_cambio) || parseAnyDate(fields.fecha_alta) || null;

  let actividadesEconomicas = [];
  if(blob){
    const actividadesBlock = extractEconomicActivitiesSection(blob);
    actividadesEconomicas = parseEconomicActivities(actividadesBlock);
  }

  log("[CSF]", `Nombre final extraído: "${razon || 'NO ENCONTRADO'}"`);

  return {
    companyName: razon || "No especificado",
    rfc: rfc || "",
    street: calle || "",
    number: numero || "",
    colony: colonia || "",
    city: municipio || "",
    state: entidad || "",
    postalCode: cp || "",
    emissionDate,
    source: "sat-qr",
    actividadesEconomicas,
  };
}

export function mapSatOpinionToDoc(fields, constanciaData){
  const sentimiento=(fields.sentido||"").toString().toUpperCase();
  const base = {
    companyName: null,
    sentiment: sentimiento.includes("POSI")? "POSITIVO" : (sentimiento.includes("NEGA")? "NEGATIVO" : ""),
    emissionDate: parseAnyDate(fields.fecha) || null,
    rfc: (fields.rfc||"").toUpperCase().trim(),
    folio: fields.folio || "",
    source: "sat-qr",
  };
  if(constanciaData?.companyName && !base.companyName) base.companyName = constanciaData.companyName;
  if(!base.rfc && constanciaData?.rfc) base.rfc = constanciaData.rfc;
  return base;
}
