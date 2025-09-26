// OCR Processor for Document Validation - FLUJO NUEVO (QR → SAT para CSF/Opinión)
class OCRProcessor {
  constructor() {
    // Toggle global debug logs
    this.DEBUG = true;

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

    // NUEVO: almacenar las URLs detectadas (para verificación en pareja) y flag de verificación
    this.lastSatUrls = { opinion: null, csf: null };
    this.satPairVerified = false;
  }

  // ==============
  // LOG helper
  // ==============
  log(scope, ...args) {
    if (!this.DEBUG) return;
    console.log(`[OCR]${scope}`, ...args);
  }
  warn(scope, ...args) {
    if (!this.DEBUG) return;
    console.warn(`[OCR]${scope}`, ...args);
  }
  error(scope, ...args) {
    console.error(`[OCR]${scope}`, ...args);
  }

  // =======================
  // ANCLAS FLEXIBLES (CSF)
  // =======================
  get ANCHORS() {
    return {
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
      // Domicilio fiscal: calle (vialidad)
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
      // Persona Física: para armar “razón social” Nombre + Apellido Paterno + Apellido Materno
      personaFisica: {
        nombre: {
          start: ["Nombre"],
          end: ["Apellido Paterno","Apellidos","Apellido"],
        },
        paterno: {
          start: ["Apellido Paterno","Ap. Paterno","Apellido paterno"],
          end: ["Apellido Materno","Ap. Materno","Fecha","Situación","Situacion"],
        },
        materno: {
          start: ["Apellido Materno","Ap. Materno","Apellido materno"],
          end: ["Fecha","Situación","Situacion","CURP","RFC"],
        },
      },
    };
  }

  // =======================
  // HELPERS DE EXTRACCIÓN
  // =======================
  sanitizeBlob(raw) {
    if (!raw) return "";
    return String(raw)
      .replace(/\u00A0/g, " ")                     // NBSP → espacio
      .replace(/<script[\s\S]*?<\/script>/gi, " ") // scripts
      .replace(/<\/?[^>]+>/g, " ")                 // tags HTML
      .replace(/\$\([\s\S]*?\);\s*/gi, " ")        // jQuery/PrimeFaces
      .replace(/PrimeFaces\.cw\([\s\S]*?\);\s*/gi, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  _escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  makeFlexibleAnchor(anchor) {
    let a = this._escapeRegExp(String(anchor).toLowerCase().trim());
    a = a.replace(/\s+/g, "\\s*");
    a = a
      .replace(/a/g, "[aá]")
      .replace(/e/g, "[eé]")
      .replace(/i/g, "[ií]")
      .replace(/o/g, "[oó]")
      .replace(/u/g, "[uúü]")
      .replace(/n/g, "[nñ]");
    return a;
  }

  cutAtStopwords(val) {
    if (!val) return val;
    const stops = [
      "RÉGIMEN","REGIMEN","SITUACIÓN","SITUACION",
      "DATOS DE UBICACIÓN","DATOS DE UBICACION",
      "RFC","FECHA","MUNICIPIO","DELEGACIÓN","DELEGACION","ALCALDÍA","ALCALDIA",
      "ENTIDAD","ESTADO","COLONIA","NÚMERO","NUMERO","CP","C.P.","CÓDIGO POSTAL","CODIGO POSTAL",
      "CORREO","ELECTRÓNICO","ELECTRONICO","TIPO DE VIALIDAD","NOMBRE DE LA VIALIDAD",
    ];
    const upper = val.toUpperCase();
    let cutIdx = -1;
    for (const s of stops) {
      const idx = upper.indexOf(s);
      if (idx > 0) cutIdx = cutIdx === -1 ? idx : Math.min(cutIdx, idx);
    }
    if (cutIdx > 0) return val.slice(0, cutIdx).trim();
    return val;
  }

  _postClean(val, maxLen = 120) {
    if (!val) return "";
    let out = String(val)
      .replace(/\s+/g, " ")
      .replace(/^[,:;\-–.]+|[,:;\-–.]+$/g, "")
      .trim();

    // corta en la siguiente “etiqueta:”
    const genericLabel = /[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\-/().,\s]{0,40}:/;
    const cut = out.search(genericLabel);
    if (cut > 0) out = out.slice(0, cut).trim();

    out = this.cutAtStopwords(out);
    if (maxLen && out.length > maxLen) out = out.slice(0, maxLen).trim();
    return out;
  }

  stripLeadingLabel(val, candidates = []) {
    if (!val) return "";
    const list = candidates.length ? candidates : ["Nombre de la vialidad","Vialidad nombre","Vialidad","Nombre de la vialidad:"];
    const re = new RegExp(
      `^(?:${list.map(this._escapeRegExp).join("|")})\\s*:?\\s*`,
      "i"
    );
    return val.replace(re, "").trim();
  }

  extractBetweenAnchors(rawText = "", startAnchors = [], endAnchors = [], { maxLen = 120 } = {}) {
    if (!rawText) return "";
    const text = this.sanitizeBlob(rawText);
    const startGroup = (startAnchors || []).map((a) => this.makeFlexibleAnchor(a)).join("|");
    const endGroup   = (endAnchors   || []).map((a) => this.makeFlexibleAnchor(a)).join("|");
    if (!startGroup) return "";

    // 1) normal: desde start hasta ANTES del siguiente end (permitiendo o no ':')
    if (endGroup) {
      const re = new RegExp(`(?:${startGroup})\\s*:?\\s*(.*?)\\s*(?=${endGroup}(?:\\s*:)?\\s*)`, "is");
      const m = text.match(re);
      if (m && m[1]) return this._postClean(m[1], maxLen);
    }

    // 2) fallback: hasta la próxima “Etiqueta:”
    const startRe = new RegExp(`(?:${startGroup})\\s*:?\\s*`, "is");
    const mStart = text.match(startRe);
    if (mStart) {
      const startIdx = mStart.index + mStart[0].length;
      const rest = text.slice(startIdx);
      const genericLabel = /[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9\-/().,\s]{0,40}:/;
      const stop = rest.search(genericLabel);
      let val = stop >= 0 ? rest.slice(0, stop) : rest.slice(0, maxLen);
      return this._postClean(val, maxLen);
    }

    return "";
  }

  // Helpers Persona Física
  _buildPFNameFromFields(fields) {
    const first = (fields.nombre || fields.nombres || fields.name || "").toString().trim();
    const pat   = (fields.apellido_paterno || fields.paterno || "").toString().trim();
    const mat   = (fields.apellido_materno || fields.materno || "").toString().trim();
    const joined = [first, pat, mat].filter(Boolean).join(" ");
    return this.cleanCompanyName(joined);
  }

  _buildPFNameFromBlob(blob) {
    if (!blob) return "";
    const nombre  = this.extractBetweenAnchors(blob, this.ANCHORS.personaFisica.nombre.start,  this.ANCHORS.personaFisica.nombre.end,  { maxLen: 80 });
    const paterno = this.extractBetweenAnchors(blob, this.ANCHORS.personaFisica.paterno.start, this.ANCHORS.personaFisica.paterno.end, { maxLen: 60 });
    const materno = this.extractBetweenAnchors(blob, this.ANCHORS.personaFisica.materno.start, this.ANCHORS.personaFisica.materno.end, { maxLen: 60 });
    const joined = [nombre, paterno, materno].filter(Boolean).join(" ");
    return this.cleanCompanyName(joined);
  }

  // ===========================
  // QR: LECTURA (primera/última)
  // ===========================
  async _scanQrOnPage(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    
    // Múltiples configuraciones para intentar
    const configs = [
      { scale: 2.0, invert: false },
      { scale: 2.5, invert: false },
      { scale: 3.0, invert: false },
      { scale: 1.5, invert: false },
      { scale: 2.0, invert: true },
      { scale: 2.5, invert: true },
      { scale: 4.0, invert: false },
      { scale: 1.0, invert: false },
    ];
    
    for (const config of configs) {
      try {
        console.log(`[OCR][QR] p${pageNum} probando escala=${config.scale}, invertir=${config.invert}`);
        
        const viewport = page.getViewport({ scale: config.scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Intentar con configuración específica
        const qrOptions = config.invert 
          ? { inversionAttempts: "attemptBoth" }
          : { inversionAttempts: "dontInvert" };
        
        const qr = jsQR(imageData.data, canvas.width, canvas.height, qrOptions);
        
        if (qr?.data) {
          console.log(`[OCR][QR] p${pageNum} ✅ ÉXITO con escala=${config.scale}, invertir=${config.invert}`);
          console.log(`[OCR][QR] p${pageNum} URL:`, qr.data.substring(0, 100) + "...");
          
          // Validar (laxo) que la URL sea del SAT antes de devolver
          if (/^https:\/\/siat\.sat\.gob\.mx\/app\/qr\//i.test(qr.data)) {
            return qr.data;
          } else {
            console.log(`[OCR][QR] p${pageNum} ❌ URL no es del SAT, continuando...`);
          }
        }
        
      } catch (error) {
        console.warn(`[OCR][QR] p${pageNum} Error con escala ${config.scale}:`, error.message);
      }
    }
    
    console.log(`[OCR][QR] p${pageNum} ❌ No se pudo leer QR con ninguna configuración`);
    return null;
  }

  async readSatQrUrls(file) {
    if (typeof jsQR === "undefined") {
      throw new Error("La librería jsQR no está cargada.");
    }
    
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const first = 1;
    const last = pdf.numPages;

    this.log("[QR]", `numPages=${pdf.numPages}, escaneo: primero=${first}, ultimo=${last}`);

    const results = [];
    const seen = new Set();

    for (const p of [first, last]) {
      if (p < 1 || p > pdf.numPages) continue;
      
      const url = await this._scanQrOnPage(pdf, p);
      if (url) {
        const isSat = /^https:\/\/siat\.sat\.gob\.mx\/app\/qr\//i.test(url);
        this.log("[QR]", `p${p} encontrado=${isSat ? "SAT" : "NO-SAT"} → ${url}`);
        
        if (isSat && !seen.has(url)) {
          seen.add(url);
          results.push({ page: p, url });
        } else if (isSat) {
          this.log("[QR]", `p${p} duplicado (mismo URL)`);
        }
      }
    }

    // Logging de resultados
    if (results.length === 0) {
      this.warn("[QR]", "No se detectó ningún QR SAT en primera/última página.");
    } else if (results.length === 1) {
      this.log("[QR]", "Solo 1 QR detectado:", results[0]);
    } else if (results.length === 2) {
      this.log("[QR]", "2 QRs detectados:", results[0], results[1]);
    }

    return {
      primaryUrl: results[0]?.url || null,
      auxUrl: results[1]?.url || null,
    };
  }

  // ===============================
  // FECHA desde Cadena Original
  // ===============================
  extractCadenaOriginalDate(raw) {
    if (!raw) return null;
    const text = this.sanitizeBlob(raw);

    // ||YYYY/MM/DD HH:mm:ss|
    let m = text.match(/\|\|(\d{4}[/-]\d{2}[/-]\d{2}\s+\d{2}:\d{2}:\d{2})\|/);
    if (m) {
      const dt = m[1].replace(/-/g, "/");
      const parts = dt.split(/\s+/);
      const d = parts[0].split("/");
      const t = parts[1].split(":");
      const date = new Date(
        parseInt(d[0], 10),
        parseInt(d[1], 10) - 1,
        parseInt(d[2], 10),
        parseInt(t[0], 10),
        parseInt(t[1], 10),
        parseInt(t[2], 10)
      );
      this.log("[CSF][Fecha]", "Cadena Original encontrada:", m[0], "→", date.toISOString());
      return isNaN(date) ? null : date;
    }

    // Fallback: “LUGAR Y FECHA DE EMISIÓN ... A 09 DE SEPTIEMBRE DE 2025”
    const m2 = text.match(/LUGAR\s+y\s+FECHA\s+DE\s+EMISI[ÓO]N.*?A\s+([0-9]{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+20\d{2})/i);
    if (m2) {
      const parsed = this.parseAnyDate(m2[1]);
      this.log("[CSF][Fecha]", "Fallback LUGAR/FECHA:", m2[1], "→", parsed?.toISOString());
      return parsed;
    }

    this.warn("[CSF][Fecha]", "No se encontró 'Cadena Original' ni fallback de fecha.");
    return null;
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
  // =====================================================================================
  async uploadOnly(docType, file) {
    try {
      const ts = Date.now();

      // Reutiliza un ID por sesión
      let submissionId = sessionStorage.getItem("submissionId");
      if (!submissionId) {
        submissionId = `sub-${ts}`;
        sessionStorage.setItem("submissionId", submissionId);
      }

      const mapName = { opinion: "32D", constancia: "CSF", bancario: "EDO.CTA" };
      const base = mapName[docType] || docType.toUpperCase();

      const safeOrig = file.name.replace(/[^\w.\- ()]/g, "_");
      const fileName = `${base}_${ts}_${safeOrig}`;

      const path = `suppliers/${submissionId}/${fileName}`;

      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(path);

      const metadata = { contentType: file.type || "application/pdf" };
      await fileRef.put(file, metadata);

      const url = await fileRef.getDownloadURL();

      window.dispatchEvent(
        new CustomEvent("fileUploaded", {
          detail: { docType, url, name: file.name },
        })
      );

      return url;
    } catch (e) {
      this.error("[UP]", "uploadOnly error:", e);
      throw e;
    }
  }

  // =====================================================================================
  // Llamar la Function del SAT (single)
  // =====================================================================================
  async callSat(urlDelQr) {
    const endpoint = this.getSatURL();
    this.log("[SAT][Call]", "POST", endpoint, "←", urlDelQr);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlDelQr }),
    });

    const contentType = resp.headers.get("content-type") || "";
    const raw = await resp.text();

    this.log("[SAT][Call]", "status=", resp.status, "ctype=", contentType);

    if (!resp.ok) {
      this.error("[SAT][Call]", `HTTP ${resp.status}`, raw?.slice(0, 300));
      throw new Error(`SAT error ${resp.status}: ${raw || resp.statusText}`);
    }
    if (!contentType.includes("application/json")) {
      this.error("[SAT][Call]", "Respuesta NO-JSON:", raw?.slice(0, 200));
      throw new Error("SAT devolvió una respuesta no-JSON.");
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      this.error("[SAT][Call]", "JSON parse fail:", raw?.slice(0, 200));
      throw new Error("No se pudo parsear la respuesta de SAT como JSON.");
    }

    if (!data.ok) {
      this.error("[SAT][Call]", "ok=false", data.error);
      throw new Error(data.error || "Error al extraer datos del SAT.");
    }

    this.log("[SAT][Call]", "OK, keys:", Object.keys(data.fields || {}));
    return data.fields || {};
  }

  // =====================================================================================
  // NUEVO: Llamar la Function del SAT en MODO PAREJA (comparar RFC)
  // =====================================================================================
  async callSatPair(urlOpinion, urlCSF) {
    const endpoint = this.getSatURL();
    this.log("[SAT][Pair]", "POST", endpoint, { urlOpinion, urlCSF });

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urlOpinion, urlCSF }),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      let msg = `SAT pair error ${resp.status}`;
      try {
        const err = JSON.parse(raw);
        msg = err.error || msg;
        if (resp.status === 422 && err.details) {
          msg += ` (RFC Opinión: ${err.details.rfcOpinion || "?"} vs RFC CSF: ${err.details.rfcCSF || "?"})`;
        }
      } catch {}
      throw new Error(msg);
    }

    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Respuesta no-JSON del SAT (pair)."); }

    if (!data.ok || !data.rfcMatch) {
      throw new Error(data.error || "Los RFC no coinciden entre Opinión y CSF.");
    }
    return data; // { ok:true, mode:'pair', rfcMatch:true, rfc, opinion, csf }
  }

  // =====================================================================================
  // NUEVO: Validación estricta de URL SAT oficial
  // =====================================================================================
  isOfficialSatUrl(u) {
    try {
      const { protocol, hostname, pathname } = new URL(u);
      return (
        protocol === "https:" &&
        hostname.toLowerCase() === "siat.sat.gob.mx" &&
        /^\/app\/qr\/faces\/pages\/mobile\/validadorqr\.jsf$/i.test(pathname)
      );
    } catch {
      return false;
    }
  }

  // =====================================================================================
  // NUEVO: Verifica en pareja si ya hay ambas URLs (lanza Error si no coincide el RFC)
  // =====================================================================================
  async verifySatPairIfReady() {
    const { opinion, csf } = this.lastSatUrls;
    if (!opinion || !csf || this.satPairVerified) return false;

    // Validación estricta en front
    if (!this.isOfficialSatUrl(opinion) || !this.isOfficialSatUrl(csf)) {
      throw new Error("Alguna URL no es la oficial del SAT.");
    }

    const pair = await this.callSatPair(opinion, csf);

    // Sincroniza RFC en la data ya mapeada
    const rfc = (pair.rfc || "").toUpperCase();
    if (this.documentData.opinion)   this.documentData.opinion.rfc   = rfc;
    if (this.documentData.constancia) this.documentData.constancia.rfc = rfc;

    this.satPairVerified = true;

    window.dispatchEvent(new CustomEvent("satPairVerified", {
      detail: { ok: true, rfc, opinionUrl: opinion, csfUrl: csf }
    }));

    return true;
  }

  // =====================================================================================
  // Mapeos SAT → documentData (con anclas sobre blob para campos “sucios” + fallback PF)
  // =====================================================================================
  mapSatCSFToDoc(fields) {
    // Texto bruto si la Function lo incluye
    const rawBlob =
      (fields.blob ||
        fields.html ||
        fields.raw ||
        fields.fullText ||
        fields.all_text ||
        "") + "";
    const blob = this.sanitizeBlob(rawBlob);

    // RFC (Function o extraído del HTML / Cadena Original)
    let rfc = (fields.rfc || "").toUpperCase().trim();
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
    this.log("[CSF][RFC]", "fields.rfc:", rfc);

    if (!rfcRegex.test(rfc) && blob) {
      let m =
        blob.match(/\bRFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i) ||
        blob.match(/\bEL\s*RFC\s*:\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i) ||
        blob.match(/\|\|[\d/ :]{19}\|([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\|CONSTANCIA/i);
      if (m) {
        rfc = m[1].toUpperCase();
        this.log("[CSF][RFC]", "extraído de HTML/Cadena:", rfc);
      } else {
        this.warn("[CSF][RFC]", "No pasó regex y no se pudo corregir desde HTML.");
      }
    }

    const isFisica = this.guessTipoPersona(rfc) === "FISICA";
    this.log("[CSF]", "tipoPersona=", isFisica ? "FISICA" : (rfc ? "MORAL" : "DESCONOCIDO"));

    // Razón social / nombre
    const razonRaw = (fields.razon_social || "").toString().trim();
    let razon = this.cleanCompanyName(razonRaw);
    const looksContaminated =
      !razon ||
      /R[ée]gimen|Fecha|Situaci[óo]n|Datos de ubicaci[óo]n/i.test(razonRaw);

    if (isFisica && (!razon || looksContaminated)) {
      let pfName = this._buildPFNameFromFields(fields);
      if (!pfName && blob) pfName = this._buildPFNameFromBlob(blob);
      razon = pfName || (rfc ? `PF ${rfc}` : "");
      this.log("[CSF][Nombre]", "PF armado:", razon);
    }

    if (!razon && blob) {
      const extracted = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.companyName.start,
        this.ANCHORS.companyName.end,
        { maxLen: 120 }
      );
      if (extracted) {
        razon = this.cleanCompanyName(extracted);
        this.log("[CSF][Nombre]", "PM por anclas:", razon);
      }
    }

    // Calle
    let calle = [fields.tipo_vialidad, fields.vialidad_nombre].filter(Boolean).join(" ").trim();
    const calleFromBlob =
      blob &&
      this.extractBetweenAnchors(
        blob,
        this.ANCHORS.calle.start,
        this.ANCHORS.calle.end,
        { maxLen: 80 }
      );
    if (calleFromBlob) calle = this.stripLeadingLabel(calleFromBlob);
    calle = this._postClean(calle, 80);

    // Número exterior
    let numero = "";
    if (fields.numero_exterior) {
      numero = String(fields.numero_exterior);
      if (fields.numero_interior) numero += ` Int ${fields.numero_interior}`;
    } else if (blob) {
      const noExt = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.numeroExterior.start,
        this.ANCHORS.numeroExterior.end,
        { maxLen: 15 }
      );
      if (noExt) numero = noExt;
    }
    numero = this._postClean(numero, 20);

    // Colonia / municipio / entidad / cp
    let colonia = fields.colonia || "";
    if (!colonia && blob) {
      colonia = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.colonia.start,
        this.ANCHORS.colonia.end,
        { maxLen: 80 }
      );
    }
    colonia = this._postClean(colonia, 80);

    let municipio = fields.municipio || "";
    if (!municipio && blob) {
      municipio = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.municipio.start,
        this.ANCHORS.municipio.end,
        { maxLen: 80 }
      );
    }
    municipio = this._postClean(municipio, 80);

    let entidad = fields.entidad || "";
    if (!entidad && blob) {
      entidad = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.entidad.start,
        this.ANCHORS.entidad.end,
        { maxLen: 80 }
      );
    }
    entidad = this._postClean(entidad, 80);

    let cp = fields.cp || "";
    if (!cp && blob) {
      cp = this.extractBetweenAnchors(
        blob,
        this.ANCHORS.cp.start,
        this.ANCHORS.cp.end,
        { maxLen: 10 }
      );
    }
    cp = this._postClean(cp, 10);

    // Fecha preliminar (por campos tradicionales si existen)
    const emissionDate =
      this.parseAnyDate(fields.fecha_ultimo_cambio) ||
      this.parseAnyDate(fields.fecha_alta) ||
      null;
    this.log("[CSF][Fecha]", "Inicial (fields):", emissionDate?.toISOString?.());

    this.documentData.constancia = {
      companyName: razon || "",
      rfc: rfc || "",
      street: calle || "",
      number: numero || "",
      colony: colonia || "",
      city: municipio || "",
      state: entidad || "",
      postalCode: cp || "",
      emissionDate,
      source: "sat-qr",
    };

    this.log("[CSF][Resumen]", this.documentData.constancia);
    return this.documentData.constancia;
  }

  mapSatOpinionToDoc(fields) {
    const sentimiento = (fields.sentido || "").toString().toUpperCase();
    this.documentData.opinion = {
      companyName: null,
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
  // API PRINCIPAL: Procesar PDF según tipo
  // =====================================================================================
  async processPDF(file, documentType) {
    if (documentType === "constancia" || documentType === "opinion") {
      // --- CSF/OPINIÓN: QR + SAT ---
      const { primaryUrl, auxUrl } = await this.readSatQrUrls(file);
      this.log("[QR]", "primaryUrl:", primaryUrl);
      this.log("[QR]", "auxUrl    :", auxUrl);

      if (!primaryUrl) throw new Error("No se detectó QR del SAT en el PDF.");
      if (!this.isOfficialSatUrl(primaryUrl)) {
        throw new Error("El QR no corresponde a la URL oficial del SAT.");
      }

      // SINGLE call
      const fieldsMain = await this.callSat(primaryUrl);

      if (documentType === "constancia") {
        const csf = this.mapSatCSFToDoc(fieldsMain);
        csf.tipoPersona = this.guessTipoPersona(csf.rfc);

        // Guardamos URL para verificación par
        this.lastSatUrls.csf = primaryUrl;

        // Intentar segunda llamada (última página) para fecha de la Cadena Original
        if (auxUrl && auxUrl !== primaryUrl) {
          this.log("[QR]", "Intentando AUX url para fecha Cadena Original");
          try {
            const fieldsAux = await this.callSat(auxUrl);
            const auxBlob =
              fieldsAux.blob || fieldsAux.html || fieldsAux.raw || fieldsAux.fullText || fieldsAux.all_text || "";
            const fechaCadena = this.extractCadenaOriginalDate(auxBlob);
            if (fechaCadena) {
              csf.emissionDate = fechaCadena;
              this.log("[CSF][Fecha]", "FINAL (aux Cadena):", csf.emissionDate.toISOString());
            } else {
              this.warn("[CSF][Fecha]", "AUX sin 'Cadena Original' reconocible.");
            }
          } catch (e) {
            this.warn("[CSF][Fecha]", "Aux QR call failed:", e?.message || e);
          }
        } else {
          // Fallback: por si la cadena original venía en el mismo HTML
          this.log("[QR]", "Sin AUX distinto; buscando Cadena en blob principal");
          const mainBlob =
            fieldsMain.blob || fieldsMain.html || fieldsMain.raw || fieldsMain.fullText || fieldsMain.all_text || "";
          const fechaCadena = this.extractCadenaOriginalDate(mainBlob);
          if (fechaCadena) {
            csf.emissionDate = fechaCadena;
            this.log("[CSF][Fecha]", "FINAL (main Cadena):", csf.emissionDate.toISOString());
          }
        }

        // NUEVO: si ya hay opinión, verificar par ANTES de subir
        if (this.lastSatUrls.opinion) {
          await this.verifySatPairIfReady(); // lanza Error si no coinciden
        }

        await this.uploadOnly("constancia", file);

        // Evento por si quieres enganchar UI externa (muestra los fields RAW del SAT)
        window.dispatchEvent(
          new CustomEvent("satExtracted", {
            detail: {
              tipo: "csf",
              fields: fieldsMain,
              url: primaryUrl,
              file,
            },
          })
        );

        return this.documentData.constancia;
      } else {
        // Opinión
        const op = this.mapSatOpinionToDoc(fieldsMain);
        if (this.documentData.constancia?.companyName && !op.companyName) {
          op.companyName = this.documentData.constancia.companyName;
        }
        if (!op.rfc && this.documentData.constancia?.rfc) {
          op.rfc = this.documentData.constancia.rfc;
        }

        // Guarda URL y, si ya hay CSF, verifica par ANTES de subir
        this.lastSatUrls.opinion = primaryUrl;
        if (this.lastSatUrls.csf) {
          await this.verifySatPairIfReady(); // lanza Error si RFC no coincide
        }

        await this.uploadOnly("opinion", file);

        window.dispatchEvent(
          new CustomEvent("satExtracted", {
            detail: {
              tipo: "opinion",
              fields: fieldsMain,
              url: primaryUrl,
              file,
            },
          })
        );

        return this.documentData.opinion;
      }
    }

    if (documentType === "bancario") {
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
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const imageData = canvas.toDataURL();
        const result = await Tesseract.recognize(imageData, "spa", {
          logger: (m) => this.log("[OCR][Tesseract]", m),
        });

        fullText += `\n--- PÁGINA ${pageNum} ---\n` + result.data.text + "\n";
      }

      return fullText.replace(/\s+/g, " ").trim();
    } catch (error) {
      this.error("[OCR][PDF->Text]", error);
      throw new Error("Error al procesar el documento PDF");
    }
  }

  // =====================================================================================
  // LÓGICA BANCARIO
  // =====================================================================================
  processBancarioDocument(text) {
    const data = { fullText: text };
    if (this.documentData.constancia?.companyName) {
      data.companyName = this.documentData.constancia.companyName;
      this.log("[BANCO]", `Usando nombre de constancia: "${data.companyName}"`);
    } else {
      data.companyName = "PENDIENTE_CONSTANCIA";
      this.log("[BANCO]", `Nombre temporal asignado: "${data.companyName}"`);
    }

    const extractedName = this.extractCompanyNameFallback(text);
    if (extractedName) {
      this.log("[BANCO]", `Nombre detectado (informativo): "${extractedName}"`);
    }

    this.documentData.bancario = data;
    return data;
  }

  // =====================================================================================
  // VALIDACIONES
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
        ...(!results.numeroCuenta.valid ? [`Número de cuenta: ${results.numeroCuenta.error}`] : []),
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
      "BBVA","BANAMEX","SANTANDER","BANORTE","HSBC","SCOTIABANK","INBURSA","BAJIO","MIFEL","ACTINVER",
      "BANCOPPEL","AZTECA","COMPARTAMOS","BANCO WALMART","BANCOMER","CITIBANAMEX","CITIBANK","INVEX",
      "MONEX","MULTIVA","BANSI","AFIRME","BANREGIO",
    ];
    for (const bank of banks) {
      const regex = new RegExp(`\\b${bank}\\b`, "i");
      if (regex.test(documentText)) return bank;
    }
    const patterns = [
      /BANCO\s+([A-ZÁÉÍÓÚÑ]+)/i,
      /(\w+)\s+BANCO/i,
      /GRUPO\s+FINANCIERO\s+([A-ZÁÉÍÓÚÑ]+)/i,
    ];
    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match) return match[1].toUpperCase();
    }
    return "No identificado";
  }

  // =====================================================================================
  // VALIDACIÓN GLOBAL
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

  validateCompanyNames() {
    const { opinion, constancia, bancario } = this.documentData;

    if (
      constancia?.companyName &&
      bancario &&
      (!bancario.companyName || bancario.companyName === "PENDIENTE_CONSTANCIA")
    ) {
      bancario.companyName = constancia.companyName;
      this.log("[VAL]", `Sincronizando nombre bancario con constancia → "${bancario.companyName}"`);
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
            !["THE","AND","DEL","DE","LA","LAS","LOS","EL","SA","CV","SRL","SC"].includes(w)
        );

    const opinionName = opinion.companyName || constancia.companyName || "";
    const opinionKeywords = extractKeywords(opinionName);
    const constanciaKeywords = extractKeywords(constancia.companyName || "");

    const common = opinionKeywords.filter((w) => constanciaKeywords.includes(w));
    const total = new Set([...opinionKeywords, ...constanciaKeywords]).size;
    const similarity = total ? Math.round((common.length / total) * 100) : 100;
    this.log("[VAL]", `Similitud Opinión-Constancia: ${similarity}%`);

    return similarity >= 60;
  }

  validatePositiveOpinion() {
    return (this.documentData.opinion?.sentiment || "").toUpperCase() === "POSITIVO";
  }

  validateEmissionDate() {
    const d = this.documentData.constancia?.emissionDate;
    if (!d) {
      this.log("[VAL][Fecha]", "No hay emissionDate → no bloquea.");
      return true;
    }
    const today = new Date();
    const days = (today - d) / (1000 * 60 * 60 * 24);
    this.log("[VAL][Fecha]", "emissionDate=", d.toISOString(), "diffDays=", days.toFixed(1));
    return days >= 0 && days <= 30;
  }

  // =====================================================================================
  // UTILIDADES
  // =====================================================================================
  parseAnyDate(s) {
    if (!s || typeof s !== "string") return null;
    const t = s.trim();

    // YYYY/MM/DD o YYYY-MM-DD
    let m = t.match(/(20\d{2})[\/\-](\d{2})[\/\-](\d{2})/);
    if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));

    // DD/MM/YYYY o DD-MM-YYYY
    m = t.match(/(\d{2})[\/\-](\d{2})[\/\-](20\d{2})/);
    if (m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));

    // “12 de agosto de 2025”
    const months = {enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
    m = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

  extractCompanyNameFallback(text) {
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
    this.lastSatUrls = { opinion: null, csf: null };
    this.satPairVerified = false;
  }
}

// Instancia global + helpers globales para el index.html
window.ocrProcessor = new OCRProcessor();
// Para compatibilidad con el index.html que llama window.uploadOnly(...)
window.uploadOnly = (docType, file) => window.ocrProcessor.uploadOnly(docType, file);
