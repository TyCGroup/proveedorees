
// qr-reader.js
// Lectura de QR en primera y última página con jsQR y pdfjsLib
import { log, warn } from "./anchors-and-utils.js";

export async function scanQrOnPage(pdf, pageNum){
  const page = await pdf.getPage(pageNum);
  const configs = [
    { scale:2.0, invert:false }, { scale:2.5, invert:false }, { scale:3.0, invert:false },
    { scale:1.5, invert:false }, { scale:2.0, invert:true  }, { scale:2.5, invert:true  },
    { scale:4.0, invert:false }, { scale:1.0, invert:false },
  ];
  for(const config of configs){
    try{
      console.log(`[OCR][QR] p${pageNum} probando escala=${config.scale}, invertir=${config.invert}`);
      const viewport = page.getViewport({ scale: config.scale });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently:true });
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext:ctx, viewport }).promise;
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const qrOptions = config.invert? { inversionAttempts:"attemptBoth" } : { inversionAttempts:"dontInvert" };
      const qr = jsQR(imageData.data, canvas.width, canvas.height, qrOptions);
      if(qr?.data){
        console.log(`[OCR][QR] p${pageNum} ✅ ÉXITO con escala=${config.scale}, invertir=${config.invert}`);
        console.log(`[OCR][QR] p${pageNum} URL:`, qr.data.substring(0,100)+"...");
        if(/^https:\/\/siat\.sat\.gob\.mx\/app\/qr\//i.test(qr.data)) return qr.data;
        else log("[QR]", "URL no SAT; continuando...");
      }
    }catch(e){ warn(`[QR] p${pageNum}`, e.message); }
  }
  log("[QR]", `p${pageNum} sin QR SAT`);
  return null;
}

export async function readSatQrUrls(file){
  if(typeof jsQR === "undefined") throw new Error("La librería jsQR no está cargada.");
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const first = 1, last = pdf.numPages;
  log("[QR]", `numPages=${pdf.numPages}, escaneo 1 y última`);
  const results = []; const seen=new Set();
  for(const p of [first,last]){
    if(p<1 || p>pdf.numPages) continue;
    const url = await scanQrOnPage(pdf, p);
    if(url && /^https:\/\/siat\.sat\.gob\.mx\/app\/qr\//i.test(url) && !seen.has(url)){
      seen.add(url); results.push({ page:p, url });
    }
  }
  return { primaryUrl: results[0]?.url || null, auxUrl: results[1]?.url || null };
}
