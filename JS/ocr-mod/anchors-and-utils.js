
// anchors-and-utils.js
// Utilidades, constantes (anclas) y helpers de texto/fechas
export const DEBUG_FLAG = true;

export const ANCHORS = {
  companyName: {
    start: [
      "Denominación / Razón Social",
      "Denominación o razón social",
      "Denominación o Razón Social",
      "Razón social",
      "Denominación",
      "Nombre, Denominación o Razón Social",
    ],
    end: [
      "Régimen de capital",
      "Regimen de capital",
      "Régimen general",
      "Régimen:",
      "Regimen:",
      "Régimen",
      "Regimen",
      "Fecha de constitución",
      "Fecha de inicio de operaciones",
      "Fecha de alta",
      "RFC",
      "Situación del contribuyente",
      "Datos de ubicación",
      "Datos de ubicacion",
    ],
  },
  calle: {
    start: [
      "Nombre de la vialidad",
      "Nombre de la vialidad:",
      "Vialidad nombre",
      "Vialidad",
    ],
    end: [
      "Número exterior","Numero exterior",
      "No. exterior","No exterior",
      "Núm. exterior","Núm exterior",
      "N° exterior","Nº exterior",
      "Num. exterior","Num exterior",
    ],
  },
  numeroExterior: {
    start: [
      "Número exterior","Numero exterior",
      "No. exterior","No exterior",
      "Núm. exterior","Núm exterior",
      "N° exterior","Nº exterior",
      "Num. exterior","Num exterior",
    ],
    end: [
      "Número interior","Numero interior","No. interior","Núm. interior","N° interior","Nº interior","Num. interior","Num interior",
      "CP","C.P.","Código Postal","Codigo Postal",
      "Colonia","Municipio","Delegación","Alcaldía","Alcaldia","Entidad","Estado","Correo","Correo electrónico","Correo electronico"
    ],
  },
  colonia: {
    start: ["Colonia"],
    end: [
      "Municipio","Delegación","Alcaldía","Alcaldia",
      "CP","C.P.","Código Postal","Codigo Postal",
      "Entidad","Estado","Correo","Correo electrónico","Correo electronico","Datos de ubicación","Datos de ubicacion"
    ],
  },
  municipio: {
    start: ["Municipio o Delegación","Municipio","Delegación","Alcaldía","Alcaldia","Ciudad"],
    end: ["Entidad","Estado","CP","C.P.","Código Postal","Codigo Postal","Colonia","Correo","Correo electrónico","Correo electronico"],
  },
  entidad: {
    start: ["Entidad Federativa","Entidad","Estado"],
    end: ["Municipio","Delegación","Alcaldía","Alcaldia","CP","C.P.","Código Postal","Codigo Postal","Colonia","Correo","Correo electrónico","Correo electronico"],
  },
  cp: {
    start: ["CP","C.P.","Código Postal","Codigo Postal"],
    end: ["Correo","Correo electrónico","Correo electronico","Entidad","Estado","Municipio","Delegación","Alcaldía","Colonia","Datos de ubicación","Datos de ubicacion"],
  },
  personaFisica: {
    nombre: { start: ["Nombre"], end: ["Apellido Paterno","Apellidos","Apellido"] },
    paterno: { start: ["Apellido Paterno","Ap. Paterno","Apellido paterno"], end: ["Apellido Materno","Ap. Materno","Fecha","Situación","Situacion"] },
    materno: { start: ["Apellido Materno","Ap. Materno","Apellido materno"], end: ["Fecha","Situación","Situacion","CURP","RFC"] },
  },
};

export function log(scope, ...args){ if(DEBUG_FLAG) console.log(`[OCR]${scope}`, ...args); }
export function warn(scope, ...args){ if(DEBUG_FLAG) console.warn(`[OCR]${scope}`, ...args); }
export function error(scope, ...args){ console.error(`[OCR]${scope}`, ...args); }

export function sanitizeBlob(raw){
  if(!raw) return "";
  return String(raw)
    .replace(/\u00A0/g," ")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<\/?[^>]+>/g," ")
    .replace(/\$\([\s\S]*?\);\s*/gi," ")
    .replace(/PrimeFaces\.cw\([\s\S]*?\);\s*/gi," ")
    .replace(/[ \t]+/g," ")
    .replace(/\s{2,}/g," ")
    .trim();
}

export function _escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

export function makeFlexibleAnchor(anchor){
  let a = _escapeRegExp(String(anchor).toLowerCase().trim());
  a = a.replace(/\s+/g,"\\s*");
  a = a
    .replace(/a/g,"[aá]")
    .replace(/e/g,"[eé]")
    .replace(/i/g,"[ií]")
    .replace(/o/g,"[oó]")
    .replace(/u/g,"[uúü]")
    .replace(/n/g,"[nñ]");
  return a;
}

export function cutAtStopwords(val){
  if(!val) return val;
  const stops=[
    "RÉGIMEN","REGIMEN","SITUACIÓN","SITUACION","DATOS DE UBICACIÓN","DATOS DE UBICACION","RFC","FECHA",
    "MUNICIPIO","DELEGACIÓN","DELEGACION","ALCALDÍA","ALCALDIA","ENTIDAD","ESTADO","COLONIA","NÚMERO","NUMERO",
    "CP","C.P.","CÓDIGO POSTAL","CODIGO POSTAL","CORREO","ELECTRÓNICO","ELECTRONICO","TIPO DE VIALIDAD","NOMBRE DE LA VIALIDAD",
  ];
  const upper = val.toUpperCase();
  let cutIdx=-1;
  for(const s of stops){
    const idx = upper.indexOf(s);
    if(idx>0) cutIdx = cutIdx===-1? idx : Math.min(cutIdx, idx);
  }
  if(cutIdx>0) return val.slice(0,cutIdx).trim();
  return val;
}

export function _postClean(val, maxLen=120){
  if(!val) return "";
  let out = String(val)
    .replace(/\s+/g," ")
    .replace(/^[,:;\-–.]+|[,:;\-–.]+$/g,"")
    .trim();
  const genericLabel = /[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\-/().,\s]{0,40}:/;
  const cut = out.search(genericLabel);
  if(cut>0) out = out.slice(0,cut).trim();
  out = cutAtStopwords(out);
  if(maxLen && out.length>maxLen) out = out.slice(0,maxLen).trim();
  return out;
}

export function stripLeadingLabel(val, candidates=[]){
  if(!val) return "";
  const list = candidates.length? candidates : ["Nombre de la vialidad","Vialidad nombre","Vialidad","Nombre de la vialidad:"];
  const re = new RegExp(`^(?:${list.map(_escapeRegExp).join("|")})\\s*:?\\s*`,"i");
  return val.replace(re,"").trim();
}

export function extractBetweenAnchors(rawText="", startAnchors=[], endAnchors=[], {maxLen=120}={}){
  if(!rawText) return "";
  const text = sanitizeBlob(rawText);
  const startGroup = (startAnchors||[]).map(a=>makeFlexibleAnchor(a)).join("|");
  const endGroup   = (endAnchors  ||[]).map(a=>makeFlexibleAnchor(a)).join("|");
  if(!startGroup) return "";

  if(endGroup){
    const re = new RegExp(`(?:${startGroup})\\s*:?\\s*(.*?)\\s*(?=${endGroup}(?:\\s*:)?\\s*)`,"is");
    const m = text.match(re);
    if(m && m[1]) return _postClean(m[1], maxLen);
  }
  const startRe = new RegExp(`(?:${startGroup})\\s*:?\\s*`,"is");
  const mStart = text.match(startRe);
  if(mStart){
    const startIdx = mStart.index + mStart[0].length;
    const rest = text.slice(startIdx);
    const genericLabel = /[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\-/().,\s]{0,40}:/;
    const stop = rest.search(genericLabel);
    let val = stop>=0 ? rest.slice(0,stop) : rest.slice(0,maxLen);
    return _postClean(val, maxLen);
  }
  return "";
}

export function parseAnyDate(s){
  if(!s || typeof s!=="string") return null;
  const t = s.trim();
  let m = t.match(/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})/);
  if(m) return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
  m = t.match(/(\d{2})[\/\-](\d{2})[\/\-](20\d{2})/);
  if(m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
  const months={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
  m = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(20\d{2})/i);
  if(m){
    const day=parseInt(m[1],10), mon=months[m[2]], year=parseInt(m[3],10);
    if(mon!==undefined) return new Date(year,mon,day);
  }
  return null;
}

export function parseAnyDateToISO(dmy){
  const d = parseAnyDate(dmy);
  return d ? d.toISOString() : null;
}

export function guessTipoPersona(rfc){
  const t=(rfc||"").trim();
  return t.length===12? "MORAL" : t.length===13? "FISICA" : "";
}

export function cleanCompanyName(name){
  if(!name) return "";
  
  let cleaned = name
    // Quitar etiquetas comunes
    .replace(/^(?:Nombre|Denominaci[óo]n|Raz[óo]n\s+Social)\s*[,:;]?\s*/i, '')
    .replace(/^\s*[\.,;:]+\s*/, '')         // Puntuación al inicio
    .replace(/\s*[\.,;:]+\s*$/, '')         // Puntuación al final
    .replace(/\s{2,}/g, ' ')                // Múltiples espacios
    .replace(/[\r\n\t\u00A0]+/g, ' ')       // Saltos de línea y tabs
    .replace(/[^\w\sÁÉÍÓÚÑáéíóúñ&.,()-]/g, '') // Caracteres raros
    .trim();
  
  // Normalizar formas legales comunes
  cleaned = cleaned
    .replace(/\bS\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/gi, 'SA DE CV')
    .replace(/\bS\.?\s*C\.?/gi, 'SC')
    .replace(/\bS\.?\s*R\.?\s*L\.?/gi, 'SRL')
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?/gi, 'S DE RL');
  
  return cleaned.toUpperCase();
}