
// validators.js
// Validación global y resumen
import { log, cleanCompanyName } from "./anchors-and-utils.js";
import { validateAccountNumber, validateClabe, extractBankName } from "./bank-parser.js";

export function validateBankingInfo(documentData, numeroCuenta, clabe){
  const bankData = documentData.bancario;
  
  if(!bankData){
    return { 
      valid: false, 
      errors: ["No se encontró el documento de estado de cuenta bancario"], 
      bankName: null 
    };
  }

  // 🔹 Si viene de Document AI, usar el campo 'raw' en lugar de 'fullText'
  const textToSearch = bankData.raw || bankData.fullText || "";
  
  if(!textToSearch){
    return { 
      valid: false, 
      errors: ["No se pudo extraer texto del documento bancario"], 
      bankName: null 
    };
  }

  const results = {
    numeroCuenta: validateAccountNumber(numeroCuenta, textToSearch),
    clabe: validateClabe(clabe, textToSearch),
    bankName: extractBankName(textToSearch),
  };
  
  const allValid = results.numeroCuenta.valid && results.clabe.valid;
  
  return {
    valid: allValid,
    errors: [
      ...(!results.numeroCuenta.valid ? [`Número de cuenta: ${results.numeroCuenta.error}`] : []),
      ...(!results.clabe.valid ? [`CLABE: ${results.clabe.error}`] : []),
    ],
    bankName: results.bankName,
    details: results,
  };
}

export function validateCompanyNames(documentData){
  const { opinion, constancia, bancario } = documentData;
  
  // 🔹 Para Document AI, el nombre de la empresa viene de la constancia
  if(constancia?.companyName && bancario && !bancario.companyName){
    bancario.companyName = constancia.companyName;
    log("[VAL]", `Sincronizando nombre bancario con constancia → "${bancario.companyName}"`);
  }
  
  if(!opinion || !constancia) return false;

  const extractKeywords = (name) => (name||"").replace(/[^\w\s]/g," ").split(/\s+/).filter(w=>w.length>=3).map(w=>w.toUpperCase()).filter(w=>!["THE","AND","DEL","DE","LA","LAS","LOS","EL","SA","CV","SRL","SC"].includes(w));

  const opinionName = opinion.companyName || constancia.companyName || "";
  const opinionKeywords = extractKeywords(opinionName);
  const constanciaKeywords = extractKeywords(constancia.companyName || "");
  const common = opinionKeywords.filter(w => constanciaKeywords.includes(w));
  const total = new Set([...opinionKeywords, ...constanciaKeywords]).size;
  const similarity = total ? Math.round((common.length/total)*100) : 100;
  log("[VAL]", `Similitud Opinión-Constancia: ${similarity}%`);
  return similarity>=60;
}

export function validatePositiveOpinion(documentData){
  return (documentData.opinion?.sentiment||"").toUpperCase()==="POSITIVO";
}

export function validateEmissionDate(documentData){
  const d = documentData.constancia?.emissionDate;
  if(!d) return true;
  const today=new Date(); const days=(today - d)/(1000*60*60*24);
  return days>=0 && days<=30;
}

export function validateDocuments(documentData){
  const results={
    companyNameMatch: validateCompanyNames(documentData),
    positiveOpinion: validatePositiveOpinion(documentData),
    dateValid: validateEmissionDate(documentData),
    errors:[],
  };
  if(!documentData.opinion) results.errors.push("Falta procesar la Opinión de Cumplimiento");
  if(!documentData.constancia) results.errors.push("Falta procesar la Constancia de Situación Fiscal");
  if(!documentData.bancario) results.errors.push("Falta procesar el Estado de Cuenta Bancario");
  return results;
}

export function getValidationSummary(documentData, validationResults){
  return {
    overall: validationResults.companyNameMatch && validationResults.positiveOpinion && validationResults.dateValid,
    details: {
      companyNameMatch: { valid: validationResults.companyNameMatch, description:"Los nombres de empresa coinciden entre documentos" },
      positiveOpinion:  { valid: validationResults.positiveOpinion,  description:"La opinión de cumplimiento es POSITIVA" },
      dateValid:        { valid: validationResults.dateValid,        description:"La constancia fiscal tiene menos de 30 días de emisión" },
    },
    errors: validationResults.errors,
    extractedData: {
      opinion: documentData.opinion,
      constancia: documentData.constancia,
      bancario: { 
        companyName: documentData.bancario?.companyName, 
        hasText: !!(documentData.bancario?.raw || documentData.bancario?.fullText),
        ocrMethod: documentData.bancario?.ocrOk ? "Document AI" : "Local OCR"
      },
    },
  };
}
