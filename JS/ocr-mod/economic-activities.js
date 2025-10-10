
// economic-activities.js
// Extracción y parseo de Actividades Económicas desde el blob de la CSF
import { sanitizeBlob, _postClean, parseAnyDateToISO } from "./anchors-and-utils.js";

export function extractEconomicActivitiesSection(blob){
  if(!blob) return "";
  const txt = sanitizeBlob(blob);
  const re = /Actividades?\s+Econ[oó]micas?:?([\s\S]*?)(?:Reg[ií]menes?:|R[eé]gimenes?:|Obligaciones?:|$)/i;
  const m = txt.match(re);
  return m ? m[1] : "";
}

export function parseEconomicActivities(blockText){
  if(!blockText) return [];
  const text = blockText.replace(/\u00A0/g," ").replace(/[ \t]+/g," ").replace(/\s{2,}/g," ").trim();
  const rowRe = /(?:^|\s)(\d{1,2})\s+(.+?)\s+(\d{1,3})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}\/\d{1,2}\/\d{2,4}))?(?=\s|$)/gi;
  const rows=[]; let m;
  while((m=rowRe.exec(text))!==null){
    rows.push({
      orden: Number(m[1]),
      descripcion: _postClean(m[2], 180),
      porcentaje: Number(m[3]),
      fechaInicio: parseAnyDateToISO(m[4]),
      fechaFin: m[5]? parseAnyDateToISO(m[5]) : null,
    });
  }
  return rows;
}
