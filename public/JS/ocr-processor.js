// OCR Processor for Document Validation - FLUJO NUEVO (QR → SAT para CSF/Opinión)
class OCRProcessor {
  constructor() {
    this.documentData = {
      opinion: null,
      constancia: null,
      bancario: null,
    };
    this.validationResults = {
      companyNameMatch: false,
      positiveOpinion: false,
      dateValid: false,
    };

    // URL de la Cloud Function (definida en firebase-config.js como window.satFunctionURL)
    this.satFunctionURL =
      typeof window !== "undefined" && window.satFunctionURL
        ? window.satFunctionURL
        : "";
  }

  // =====================================================================================
  // VALIDACIÓN DE URL DE LA FUNCTION
  // =====================================================================================
  getSatURL() {
    const url =
      this.satFunctionURL ||
      (typeof window !== "undefined" ? window.satFunctionURL : "");
    if (!url || url.includes("<REGION>") || url.includes("<TU_PROYECTO>")) {
      throw new Error("satFunctionURL no está configurado correctamente.");
    }
    try {
      new URL(url);
    } catch {
      throw new Error("satFunctionURL inválido.");
    }
    return url;
  }

  // =====================================================================================
  // Subir archivo a Firebase Storage SIN OCR (usado en constancia/opinión/bancario)
// ocr-processor.js
async uploadOnly(docType, file) {
  try {
    const ts = Date.now();

    // Reutiliza un ID por sesión
    let submissionId = sessionStorage.getItem('submissionId');
    if (!submissionId) {
      submissionId = `sub-${ts}`;
      sessionStorage.setItem('submissionId', submissionId);
    }

    // Nombres estándar por tipo
    const mapName = { opinion: '32D', constancia: 'CSF', bancario: 'EDO.CTA' };
    const base = mapName[docType] || docType.toUpperCase();

    // Nombre seguro
    const safeOrig = file.name.replace(/[^\w.\- ()]/g, '_');
    const fileName = `${base}_${ts}_${safeOrig}`;

    // RUTA QUE COINCIDE CON TUS REGLAS
    const path = `suppliers/${submissionId}/${fileName}`;

    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(path);

    // Importante: metadata para PDF
    const metadata = { contentType: file.type || 'application/pdf' };
    await fileRef.put(file, metadata);

    const url = await fileRef.getDownloadURL();

    window.dispatchEvent(new CustomEvent('fileUploaded', {
      detail: { docType, url, name: file.name }
    }));

    return url;
  } catch (e) {
    console.error('uploadOnly error:', e);
    throw e;
  }
}

  // =====================================================================================
  // Leer QR desde un PDF (PDF.js + jsQR)
  // =====================================================================================
  async readQrFromPdf(file, maxPages = 5) {
    if (typeof jsQR === "undefined") {
      throw new Error(
        "La librería jsQR no está cargada. Agrega el script de jsQR en index.html antes de ocr-processor.js."
      );
    }

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = Math.min(pdf.numPages, maxPages);

    for (let p = 1; p <= pages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(img.data, canvas.width, canvas.height);
      if (qr?.data) {
        return qr.data;
      }
    }
    throw new Error("No se detectó QR en el PDF.");
  }

  // =====================================================================================
  // Llamar la Function del SAT (robusto: valida endpoint y parsea respuesta)
  // =====================================================================================
  async callSat(urlDelQr) {
    const endpoint = this.getSatURL();

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlDelQr }),
    });

    const contentType = resp.headers.get("content-type") || "";
    const raw = await resp.text();

    if (!resp.ok) {
      // útil para depurar 405/500/CORS
      throw new Error(`SAT error ${resp.status}: ${raw || resp.statusText}`);
    }
    if (!contentType.includes("application/json")) {
      throw new Error("SAT devolvió una respuesta no-JSON.");
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("No se pudo parsear la respuesta de SAT como JSON.");
    }

    if (!data.ok) {
      throw new Error(data.error || "Error al extraer datos del SAT.");
    }

    return data.fields || {};
  }

  // =====================================================================================
  // Mapeos SAT → documentData
  // =====================================================================================
  mapSatCSFToDoc(fields) {
    // fields esperados: rfc, razon_social, entidad, municipio, colonia,
    // tipo_vialidad, vialidad_nombre, numero_exterior, numero_interior, cp, regimen, ...
    const rfc = (fields.rfc || "").toUpperCase().trim();
    const razon = (fields.razon_social || "").toUpperCase().trim();

    // Domicilio
    const calle = [fields.tipo_vialidad, fields.vialidad_nombre]
      .filter(Boolean)
      .join(" ")
      .trim();
    const numero = [
      fields.numero_exterior,
      fields.numero_interior ? "Int " + fields.numero_interior : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Intento de fecha de emisión (si no se puede inferir, quedará null y no bloqueará)
    const emissionDate =
      this.parseAnyDate(fields.fecha_ultimo_cambio) ||
      this.parseAnyDate(fields.fecha_alta) ||
      null;

    this.documentData.constancia = {
      companyName: razon || "",
      rfc: rfc,
      street: calle || "",
      number: numero || "",
      colony: fields.colonia || "",
      city: fields.municipio || "",
      state: fields.entidad || "",
      postalCode: fields.cp || "",
      emissionDate,
      source: "sat-qr",
    };
    return this.documentData.constancia;
  }

  mapSatOpinionToDoc(fields) {
    // fields esperados: folio, rfc, fecha, sentido ("Positivo"/"Negativo")
    const sentimiento = (fields.sentido || "").toString().toUpperCase();
    this.documentData.opinion = {
      companyName: null, // nombre lo sincronizamos con la CSF
      sentiment: sentimiento.includes("POSI")
        ? "POSITIVO"
        : sentimiento.includes("NEGA")
        ? "NEGATIVO"
        : "",
      emissionDate: this.parseAnyDate(fields.fecha) || null,
      rfc: (fields.rfc || "").toUpperCase().trim(),
      folio: fields.folio || "",
      source: "sat-qr",
    };
    return this.documentData.opinion;
  }

  // =====================================================================================
  // API PRINCIPAL: Procesar PDF según tipo (CSF/Opinión via SAT; Bancario via OCR)
  // =====================================================================================
  async processPDF(file, documentType) {
    if (documentType === "constancia" || documentType === "opinion") {
      // --- CSF/OPINIÓN: QR + SAT ---
      const urlQr = await this.readQrFromPdf(file);
      if (!/^https:\/\/siat\.sat\.gob\.mx\/app\/qr\//i.test(urlQr)) {
        throw new Error("El QR no pertenece al dominio del SAT.");
      }

      const fields = await this.callSat(urlQr);

      if (documentType === "constancia") {
        const csf = this.mapSatCSFToDoc(fields);
        // completar tipoPersona (interno; el form lo obtiene con getCompanyInfo)
        csf.tipoPersona = this.guessTipoPersona(csf.rfc);
        await this.uploadOnly("constancia", file);
      } else {
        const op = this.mapSatOpinionToDoc(fields);
        // sincroniza nombre/RFC con la CSF si ya existe
        if (this.documentData.constancia?.companyName && !op.companyName) {
          op.companyName = this.documentData.constancia.companyName;
        }
        if (!op.rfc && this.documentData.constancia?.rfc) {
          op.rfc = this.documentData.constancia.rfc;
        }
        await this.uploadOnly("opinion", file);
      }

      // Evento por si quieres enganchar UI externa
      window.dispatchEvent(
        new CustomEvent("satExtracted", {
          detail: { tipo: documentType, fields, url: urlQr, file },
        })
      );

      return documentType === "constancia"
        ? this.documentData.constancia
        : this.documentData.opinion;
    }

    if (documentType === "bancario") {
      // --- BANCO: OCR (primera página suficiente generalmente) ---
      const text = await this.ocrPdfToText(file, [1]);
      const data = this.processBancarioDocument(text);
      await this.uploadOnly("bancario", file);
      return data;
    }

    throw new Error("Tipo de documento no reconocido");
  }

  // =====================================================================================
  // OCR genérico (para bancario)
  // =====================================================================================
  async ocrPdfToText(file, pagesToProcess) {
    try {
      const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
      let fullText = "";
      if (!pagesToProcess || pagesToProcess.length === 0) pagesToProcess = [1];

      for (const pageNum of pagesToProcess) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const imageData = canvas.toDataURL();
        const result = await Tesseract.recognize(imageData, "spa", {
          logger: (m) => console.log(m),
        });

        fullText += `\n--- PÁGINA ${pageNum} ---\n` + result.data.text + "\n";
      }

      return fullText.replace(/\s+/g, " ").trim();
    } catch (error) {
      console.error("Error processing PDF (OCR):", error);
      throw new Error("Error al procesar el documento PDF");
    }
  }

  // =====================================================================================
  // LÓGICA BANCARIO (igual a tu flujo previo con mejoras)
  // =====================================================================================
  processBancarioDocument(text) {
    const data = { fullText: text };
    if (this.documentData.constancia?.companyName) {
      data.companyName = this.documentData.constancia.companyName;
      console.log(`Bancario - Usando nombre de constancia: "${data.companyName}"`);
    } else {
      data.companyName = "PENDIENTE_CONSTANCIA";
      console.log(`Bancario - Nombre temporal asignado: "${data.companyName}"`);
    }

    const extractedName = this.extractCompanyNameFallback(text, "bancario");
    if (extractedName) {
      console.log(
        `ℹ️ Bancario - Nombre encontrado (solo informativo): "${extractedName}"`
      );
    }

    this.documentData.bancario = data;
    return data;
  }

  // =====================================================================================
  // VALIDACIONES (ajustadas al flujo SAT)
  // =====================================================================================
  validateBankingInfo(numeroCuenta, clabe) {
    const bankData = this.documentData.bancario;

    if (!bankData || !bankData.fullText) {
      return {
        valid: false,
        errors: ["No se encontró el documento de estado de cuenta bancario"],
        bankName: null,
      };
    }

    const results = {
      numeroCuenta: this.validateAccountNumber(numeroCuenta, bankData.fullText),
      clabe: this.validateClabe(clabe, bankData.fullText),
      bankName: this.extractBankName(bankData.fullText),
    };

    const allValid = results.numeroCuenta.valid && results.clabe.valid;

    return {
      valid: allValid,
      errors: [
        ...(!results.numeroCuenta.valid
          ? [`Número de cuenta: ${results.numeroCuenta.error}`]
          : []),
        ...(!results.clabe.valid ? [`CLABE: ${results.clabe.error}`] : []),
      ],
      bankName: results.bankName,
      details: results,
    };
  }

  validateAccountNumber(numeroCuenta, documentText) {
    if (!numeroCuenta || numeroCuenta.length < 8) {
      return { valid: false, error: "El número de cuenta debe tener al menos 8 dígitos" };
    }
    const cleanCuenta = numeroCuenta.replace(/\D/g, "");
    const patterns = [
      new RegExp(`\\b${cleanCuenta}\\b`),
      new RegExp(`\\b${cleanCuenta.slice(-8)}\\b`),
      new RegExp(`\\b${cleanCuenta.slice(-10)}\\b`),
      new RegExp(cleanCuenta.split("").join("\\s*")),
    ];
    for (const pattern of patterns) {
      if (pattern.test(documentText)) return { valid: true, matchType: "found", error: null };
    }
    const lastSix = cleanCuenta.slice(-6);
    if (new RegExp(`\\b${lastSix}\\b`).test(documentText)) {
      return { valid: true, matchType: "partial", error: null, warning: "Solo últimos 6 dígitos" };
    }
    return { valid: false, error: "No se encontró el número de cuenta en el documento" };
  }

  validateClabe(clabe, documentText) {
    if (!clabe || clabe.length !== 18) {
      return { valid: false, error: "La CLABE debe tener exactamente 18 dígitos" };
    }
    if (!/^\d{18}$/.test(clabe)) {
      return { valid: false, error: "La CLABE solo debe contener números" };
    }
    if (!this.validateClabeCheckDigit(clabe)) {
      return { valid: false, error: "La CLABE no es válida (dígito verificador incorrecto)" };
    }
    const patterns = [
      new RegExp(`\\b${clabe}\\b`),
      new RegExp(clabe.split("").join("\\s*")),
      new RegExp(`${clabe.slice(0, 3)}\\s*${clabe.slice(3, 6)}\\s*${clabe.slice(6)}`),
    ];
    for (const pattern of patterns) {
      if (pattern.test(documentText)) return { valid: true, matchType: "found", error: null };
    }
    const clabeStart = clabe.slice(0, 10);
    if (new RegExp(`\\b${clabeStart}`).test(documentText)) {
      return { valid: true, matchType: "partial", error: null, warning: "Inicio de CLABE encontrado" };
    }
    return { valid: false, error: "No se encontró la CLABE en el documento" };
  }

  validateClabeCheckDigit(clabe) {
    const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += parseInt(clabe[i], 10) * weights[i];
    const remainder = sum % 10;
    const checkDigit = remainder === 0 ? 0 : 10 - remainder;
    return checkDigit === parseInt(clabe[17], 10);
  }

  extractBankName(documentText) {
    const banks = [
      "BBVA",
      "BANAMEX",
      "SANTANDER",
      "BANORTE",
      "HSBC",
      "SCOTIABANK",
      "INBURSA",
      "BAJIO",
      "MIFEL",
      "ACTINVER",
      "BANCOPPEL",
      "AZTECA",
      "COMPARTAMOS",
      "BANCO WALMART",
      "BANCOMER",
      "CITIBANAMEX",
      "CITIBANK",
      "INVEX",
      "MONEX",
      "MULTIVA",
      "BANSI",
      "AFIRME",
      "BANREGIO",
    ];
    for (const bank of banks) {
      const regex = new RegExp(`\\b${bank}\\b`, "i");
      if (regex.test(documentText)) return bank;
    }
    const patterns = [
      /BANCO\s+([A-Z]+)/i,
      /(\w+)\s+BANCO/i,
      /GRUPO\s+FINANCIERO\s+([A-Z]+)/i,
    ];
    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match) return match[1].toUpperCase();
    }
    return "No identificado";
  }

  // =====================================================================================
  // VALIDACIÓN GLOBAL (ajustada)
  // =====================================================================================
  validateDocuments() {
    const results = {
      companyNameMatch: this.validateCompanyNames(),
      positiveOpinion: this.validatePositiveOpinion(),
      dateValid: this.validateEmissionDate(),
      errors: [],
    };

    if (!this.documentData.opinion)
      results.errors.push("Falta procesar la Opinión de Cumplimiento");
    if (!this.documentData.constancia)
      results.errors.push("Falta procesar la Constancia de Situación Fiscal");
    if (!this.documentData.bancario)
      results.errors.push("Falta procesar el Estado de Cuenta Bancario");

    this.validationResults = results;
    return results;
  }

  // Opinión vs Constancia (el bancario se sincroniza con la constancia)
  validateCompanyNames() {
    const { opinion, constancia, bancario } = this.documentData;

    if (
      constancia?.companyName &&
      bancario &&
      (!bancario.companyName || bancario.companyName === "PENDIENTE_CONSTANCIA")
    ) {
      bancario.companyName = constancia.companyName;
      console.log(
        `🔄 Sincronizando nombre bancario con constancia: "${bancario.companyName}"`
      );
    }

    if (!opinion || !constancia) return false;

    const extractKeywords = (name) =>
      (name || "")
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .map((w) => w.toUpperCase())
        .filter(
          (w) =>
            ![
              "THE",
              "AND",
              "DEL",
              "DE",
              "LA",
              "LAS",
              "LOS",
              "EL",
              "SA",
              "CV",
              "SRL",
              "SC",
            ].includes(w)
        );

    const opinionName = opinion.companyName || constancia.companyName || "";
    const opinionKeywords = extractKeywords(opinionName);
    const constanciaKeywords = extractKeywords(constancia.companyName || "");

    const similarity = this.calculateKeywordSimilarity(
      opinionKeywords,
      constanciaKeywords
    );
    console.log(`Similitud Opinión-Constancia: ${similarity}%`);

    return similarity >= 60;
  }

  validatePositiveOpinion() {
    return (this.documentData.opinion?.sentiment || "").toUpperCase() === "POSITIVO";
  }

  // Con QR del SAT quizá no tengamos "emissionDate" exacta; si no hay, no bloqueamos
  validateEmissionDate() {
    const d = this.documentData.constancia?.emissionDate;
    if (!d) return true; // no bloquear por fecha si no se pudo inferir
    const today = new Date();
    const days = (today - d) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }

  // =====================================================================================
  // UTILIDADES
  // =====================================================================================
  calculateKeywordSimilarity(k1, k2) {
    if (k1.length === 0 && k2.length === 0) return 100;
    if (k1.length === 0 || k2.length === 0) return 0;
    const common = k1.filter((w) => k2.includes(w));
    const total = new Set([...k1, ...k2]).size;
    return Math.round((common.length / total) * 100);
  }

  parseAnyDate(s) {
    if (!s || typeof s !== "string") return null;
    const t = s.trim();

    // YYYY/MM/DD o YYYY-MM-DD
    let m = t.match(/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})/);
    if (m)
      return new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10)
      );

    // DD/MM/YYYY o DD-MM-YYYY
    m = t.match(/(\d{2})[\/\-](\d{2})[\/\-](20\d{2})/);
    if (m)
      return new Date(
        parseInt(m[3], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[1], 10)
      );

    // “12 de agosto de 2025”
    const months = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      setiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };
    m = t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/(\d{1,2})\s*de\s*([a-z]+)\s*de\s*(20\d{2})/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const mon = months[m[2]];
      const year = parseInt(m[3], 10);
      if (mon !== undefined) return new Date(year, mon, day);
    }
    return null;
  }

  guessTipoPersona(rfc) {
    const t = (rfc || "").trim();
    return t.length === 12 ? "MORAL" : t.length === 13 ? "FISICA" : "";
  }

  cleanCompanyName(name) {
    if (!name) return "";
    return name
      .replace(/^\s*[\.,;:]+\s*/, "")
      .replace(/\s*[\.,;:]+\s*$/, "")
      .replace(/\s+/g, " ")
      .replace(/^(Nombre|Denominación|Razón Social).*?[:]/i, "")
      .trim()
      .toUpperCase();
  }

  extractCompanyNameFallback(text, documentType) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const candidateLines = lines.filter((line) => {
      return (
        line.length >= 5 &&
        line.length <= 100 &&
        /[A-ZÀ-ÿ]/i.test(line) &&
        !/^\d+$/.test(line) &&
        !line.includes("@") &&
        !/^[0-9\/\-\s]+$/.test(line) &&
        !/(página|page|fecha|date)/i.test(line)
      );
    });
    for (const line of candidateLines) {
      const cleaned = this.cleanCompanyName(line);
      if (cleaned && cleaned.length >= 3) return cleaned;
    }
    return null;
  }

  getCompanyInfo() {
    const c = this.documentData.constancia;
    if (!c) return {};
    const tipo = this.guessTipoPersona(c.rfc);
    return {
      nombreComercial: c.companyName || "",
      razonSocial: c.companyName || "",
      rfc: c.rfc || "",
      tipoPersona:
        tipo === "MORAL" ? "PERSONA MORAL" : tipo === "FISICA" ? "PERSONA FÍSICA" : "",
      calle: c.street || "",
      numero: c.number || "",
      colonia: c.colony || "",
      ciudad: c.city || "",
      estado: c.state || "",
      cp: c.postalCode || "",
      pais: "México",
    };
  }

  getValidationSummary() {
    const results = this.validationResults;
    const summary = {
      overall: results.companyNameMatch && results.positiveOpinion && results.dateValid,
      details: {
        companyNameMatch: {
          valid: results.companyNameMatch,
          description: "Los nombres de empresa coinciden entre documentos",
        },
        positiveOpinion: {
          valid: results.positiveOpinion,
          description: "La opinión de cumplimiento es POSITIVA",
        },
        dateValid: {
          valid: results.dateValid,
          description: "La constancia fiscal tiene menos de 30 días de emisión",
        },
      },
      errors: results.errors,
      extractedData: {
        opinion: this.documentData.opinion,
        constancia: this.documentData.constancia,
        bancario: {
          companyName: this.documentData.bancario?.companyName,
          hasFullText: !!this.documentData.bancario?.fullText,
        },
      },
    };
    return summary;
  }

  reset() {
    this.documentData = { opinion: null, constancia: null, bancario: null };
    this.validationResults = {
      companyNameMatch: false,
      positiveOpinion: false,
      dateValid: false,
    };
  }
}

// Instancia global + helpers globales para el index.html
window.ocrProcessor = new OCRProcessor();
// Para compatibilidad con el index.html que llama window.uploadOnly(...)
window.uploadOnly = (docType, file) => window.ocrProcessor.uploadOnly(docType, file);
