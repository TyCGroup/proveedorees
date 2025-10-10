
// ocr-processor.js
// Clase principal que orquesta los submódulos
import { ANCHORS, log, warn, error, cleanCompanyName, guessTipoPersona } from "./anchors-and-utils.js";
import { readSatQrUrls } from "./qr-reader.js";
import { isOfficialSatUrl, callSat, callSatPair } from "./sat-service.js";
import { mapSatCSFToDoc, mapSatOpinionToDoc, extractCadenaOriginalDate } from "./csf-opinion-mapper.js";
import { ocrPdfToText, processBancarioDocument } from "./bank-parser.js";
import { validateDocuments, getValidationSummary, validateBankingInfo as validateBankingInfoFn } from "./validators.js";
import { uploadOnly } from "./uploader.js";

export class OCRProcessor {
  constructor(){
    this.DEBUG = true;
    this.documentData = { opinion:null, constancia:null, bancario:null };
    this.validationResults = { companyNameMatch:false, positiveOpinion:false, dateValid:false };
    this.lastSatUrls = { opinion:null, csf:null };
    this.satPairVerified = false;
  }

  // EXPOSE: uploadOnly (para compat con index.html)
  async uploadOnly(docType, file){ return uploadOnly(docType, file); }

  isOfficialSatUrl(u){ return isOfficialSatUrl(u); }

  async verifySatPairIfReady(){
    const { opinion, csf } = this.lastSatUrls;
    if(!opinion || !csf || this.satPairVerified) return false;
    if(!isOfficialSatUrl(opinion) || !isOfficialSatUrl(csf)) throw new Error("Alguna URL no es la oficial del SAT.");
    const pair = await callSatPair(opinion, csf);
    const rfc = (pair.rfc||"").toUpperCase();
    if(this.documentData.opinion) this.documentData.opinion.rfc = rfc;
    if(this.documentData.constancia) this.documentData.constancia.rfc = rfc;
    this.satPairVerified = true;
    window.dispatchEvent(new CustomEvent("satPairVerified",{ detail:{ ok:true, rfc, opinionUrl:opinion, csfUrl:csf } }));
    return true;
  }

  async processPDF(file, documentType){
    if(documentType==="constancia" || documentType==="opinion"){
      const { primaryUrl, auxUrl } = await readSatQrUrls(file);
      if(!primaryUrl) throw new Error("No se detectó QR del SAT en el PDF.");
      if(!isOfficialSatUrl(primaryUrl)) throw new Error("El QR no corresponde a la URL oficial del SAT.");
      const fieldsMain = await callSat(primaryUrl);
      if(documentType==="constancia"){
        const csf = mapSatCSFToDoc(fieldsMain);
        csf.blob = (
        fieldsMain.blob ||
        fieldsMain.html ||
        fieldsMain.raw ||
        fieldsMain.fullText ||
        fieldsMain.all_text ||
        ""
      );
        csf.tipoPersona = guessTipoPersona(csf.rfc);
        this.lastSatUrls.csf = primaryUrl;

        if(auxUrl && auxUrl!==primaryUrl){
          try{
            const fieldsAux = await callSat(auxUrl);
            const auxBlob = fieldsAux.blob || fieldsAux.html || fieldsAux.raw || fieldsAux.fullText || fieldsAux.all_text || "";
            const fechaCadena = extractCadenaOriginalDate(auxBlob);
            if(fechaCadena) csf.emissionDate = fechaCadena;
          }catch(e){ warn("[CSF][Fecha]", e?.message || e); }
        }else{
          const mainBlob = fieldsMain.blob || fieldsMain.html || fieldsMain.raw || fieldsMain.fullText || fieldsMain.all_text || "";
          const fechaCadena = extractCadenaOriginalDate(mainBlob);
          if(fechaCadena) csf.emissionDate = fechaCadena;
        }

        if(this.lastSatUrls.opinion){ await this.verifySatPairIfReady(); }
        await uploadOnly("constancia", file);
        this.documentData.constancia = csf;

        window.dispatchEvent(new CustomEvent("satExtracted",{ detail:{ tipo:"csf", fields:fieldsMain, url:primaryUrl, file } }));
        return this.documentData.constancia;
      }else{
        const op = mapSatOpinionToDoc(fieldsMain, this.documentData.constancia);
        // 🔗 Preserva el blob/HTML del SAT para el frontend
        op.blob = (
          fieldsMain.blob ||
          fieldsMain.html ||
          fieldsMain.raw ||
          fieldsMain.fullText ||
          fieldsMain.all_text ||
          ""
        );
        op._satUrl = primaryUrl;
        this.lastSatUrls.opinion = primaryUrl;
        if(this.lastSatUrls.csf){ await this.verifySatPairIfReady(); }
        await uploadOnly("opinion", file);
        this.documentData.opinion = op;
        window.dispatchEvent(new CustomEvent("satExtracted",{ detail:{ tipo:"opinion", fields:fieldsMain, url:primaryUrl, file } }));
        return this.documentData.opinion;
      }
    }

if (documentType === "bancario") {
  // 🔹 Subir archivo sin validación (por compatibilidad)
  await uploadOnly("bancario", file);

  try {
    // --------------------------------------------------
    // 🚀 Enviar PDF a la función OCR en la nube (Document AI)
    // --------------------------------------------------
    const base64 = await this.fileToBase64(file);
    const resp = await fetch(window.bankOcrURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataBase64: base64.split(",")[1],
        contentType: file.type || "application/pdf"
      }),
    });

    const result = await resp.json();
    console.log("[OCR][BANK] Resultado:", result);

    if (!result.ok) throw new Error(result.error || "No se pudo procesar OCR bancario");

    // Datos detectados por el OCR
    const cuenta = result.quick?.cuenta || "";
    const clabe = result.quick?.clabe || "";
    const banco = result.quick?.banco || "";

    // Guardar en memoria interna (pero NO rellenar los inputs)
    this.documentData.bancario = { 
      cuenta, 
      clabe, 
      banco, 
      ocrOk: true, 
      raw: result.text,
      fullText: result.text  // Para compatibilidad con validators
    };

    console.log("[OCR][BANK] Datos extraídos y guardados:", {
      cuenta, clabe, banco
    });

    // Emitir evento global
    window.dispatchEvent(new CustomEvent("bankOcrCompleted", { 
      detail: this.documentData.bancario 
    }));

    return this.documentData.bancario;

  } catch (err) {
    console.error("[OCR][BANK] Error en OCR Document AI:", err);

    // ⚙️ Fallback local con tu OCR actual (bank-parser)
    const text = await ocrPdfToText(file, [1]);
    const data = processBancarioDocument(
      text,
      this.documentData.constancia?.companyName,
      cleanCompanyName
    );
    this.documentData.bancario = { 
      ...data, 
      ocrOk: false, 
      raw: text,
      fullText: text
    };
    return this.documentData.bancario;
  }
}

    throw new Error("Tipo de documento no reconocido");
  }

  validateDocuments(){
    this.validationResults = validateDocuments(this.documentData);
    return this.validationResults;
  }

  getValidationSummary(){
    return getValidationSummary(this.documentData, this.validationResults);
  }
  validateBankingInfo(numeroCuenta, clabe) {
    // Reutiliza la función del módulo validators con el estado interno
    return validateBankingInfoFn(this.documentData, numeroCuenta, clabe);
  }


    getCompanyInfo() {
    const c = this.documentData.constancia;
    if (!c) return {};
    const tipo = guessTipoPersona(c.rfc);
    return {
      nombreComercial: c.companyName || "",
      razonSocial: c.companyName || "",
      rfc: c.rfc || "",
      tipoPersona:
        tipo === "MORAL" ? "PERSONA MORAL" :
        tipo === "FISICA" ? "PERSONA FÍSICA" : "",
      calle: c.street || "",
      numero: c.number || "",
      colonia: c.colony || "",
      ciudad: c.city || "",
      estado: c.state || "",
      cp: c.postalCode || "",
      pais: "México",
    };
  }

  // ======================================================
// 🔧 Utilidad: convierte archivo a Base64
// ======================================================
async fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

  reset(){
    this.documentData = { opinion:null, constancia:null, bancario:null };
    this.validationResults = { companyNameMatch:false, positiveOpinion:false, dateValid:false };
    this.lastSatUrls = { opinion:null, csf:null };
    this.satPairVerified = false;
  }
}

// Crear instancia global para compatibilidad si se usa como script en el navegador
if(typeof window!=="undefined"){
  window.ocrProcessor = new OCRProcessor();
  window.uploadOnly = (docType, file) => window.ocrProcessor.uploadOnly(docType, file);
}
