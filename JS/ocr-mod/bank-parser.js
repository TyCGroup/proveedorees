
// bank-parser.js
// OCR y validaciones para documento bancario
import { log } from "./anchors-and-utils.js";

export async function ocrPdfToText(file, pagesToProcess){
  try{
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    let fullText=""; if(!pagesToProcess || pagesToProcess.length===0) pagesToProcess=[1];
    for(const pageNum of pagesToProcess){
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d",{ willReadFrequently:true });
      canvas.height = viewport.height; canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      const imageData = canvas.toDataURL();
      const result = await Tesseract.recognize(imageData, "spa", { logger:(m)=>log("[OCR][Tesseract]",m) });
      fullText += `\n--- PÁGINA ${pageNum} ---\n` + result.data.text + "\n";
    }
    return fullText.replace(/\s+/g," ").trim();
  }catch(e){
    throw new Error("Error al procesar el documento PDF");
  }
}

export function extractCompanyNameFallback(text, cleanFn){
  const lines = text.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
  const candidateLines = lines.filter(line=>{
    return line.length>=5 && line.length<=100 && /[A-ZÀ-ÿ]/i.test(line) && !/^\d+$/.test(line) &&
      !line.includes("@") && !/^[0-9\/\-\s]+$/.test(line) && !/(página|page|fecha|date)/i.test(line);
  });
  for(const line of candidateLines){
    const cleaned = cleanFn(line);
    if(cleaned && cleaned.length>=3) return cleaned;
  }
  return null;
}

export function processBancarioDocument(text, constanciaCompanyName, cleanFn){
  const data={ fullText:text };
  if(constanciaCompanyName) data.companyName = constanciaCompanyName;
  else data.companyName = "PENDIENTE_CONSTANCIA";
  const extractedName = extractCompanyNameFallback(text, cleanFn);
  if(extractedName) log("[BANCO]", `Nombre detectado (informativo): "${extractedName}"`);
  return data;
}

export function validateAccountNumber(numeroCuenta, documentText){
  if(!numeroCuenta || numeroCuenta.length<8) return { valid:false, error:"El número de cuenta debe tener al menos 8 dígitos" };
  const cleanCuenta = numeroCuenta.replace(/\D/g,"");
  const patterns=[
    new RegExp(`\\b${cleanCuenta}\\b`),
    new RegExp(`\\b${cleanCuenta.slice(-8)}\\b`),
    new RegExp(`\\b${cleanCuenta.slice(-10)}\\b`),
    new RegExp(cleanCuenta.split("").join("\\s*")),
  ];
  for(const p of patterns){ if(p.test(documentText)) return { valid:true, matchType:"found", error:null }; }
  const lastSix = cleanCuenta.slice(-6);
  if(new RegExp(`\\b${lastSix}\\b`).test(documentText)) return { valid:true, matchType:"partial", error:null, warning:"Solo últimos 6 dígitos" };
  return { valid:false, error:"No se encontró el número de cuenta en el documento" };
}

export function validateClabeCheckDigit(clabe){
  const weights=[3,7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7]; let sum=0;
  for(let i=0;i<17;i++) sum += parseInt(clabe[i],10)*weights[i];
  const remainder = sum%10; const checkDigit = remainder===0? 0 : 10-remainder;
  return checkDigit===parseInt(clabe[17],10);
}

export function validateClabe(clabe, documentText){
  if(!clabe || clabe.length!==18) return { valid:false, error:"La CLABE debe tener exactamente 18 dígitos" };
  if(!/^\d{18}$/.test(clabe)) return { valid:false, error:"La CLABE solo debe contener números" };
  if(!validateClabeCheckDigit(clabe)) return { valid:false, error:"La CLABE no es válida (dígito verificador incorrecto)" };
  const patterns=[
    new RegExp(`\\b${clabe}\\b`),
    new RegExp(clabe.split("").join("\\s*")),
    new RegExp(`${clabe.slice(0,3)}\\s*${clabe.slice(3,6)}\\s*${clabe.slice(6)}`),
  ];
  for(const p of patterns){ if(p.test(documentText)) return { valid:true, matchType:"found", error:null }; }
  const clabeStart = clabe.slice(0,10);
  if(new RegExp(`\\b${clabeStart}`).test(documentText)) return { valid:true, matchType:"partial", error:null, warning:"Inicio de CLABE encontrado" };
  return { valid:false, error:"No se encontró la CLABE en el documento" };
}

export function extractBankName(documentText){
  const banks=["BBVA","BANAMEX","SANTANDER","BANORTE","HSBC","SCOTIABANK","INBURSA","BAJIO","MIFEL","ACTINVER","BANCOPPEL","AZTECA","COMPARTAMOS","BANCO WALMART","BANCOMER","CITIBANAMEX","CITIBANK","INVEX","MONEX","MULTIVA","BANSI","AFIRME","BANREGIO"];
  for(const bank of banks){ const regex=new RegExp(`\\b${bank}\\b`,"i"); if(regex.test(documentText)) return bank; }
  const patterns=[/BANCO\s+([A-ZÁÉÍÓÚÑ]+)/i, /(\w+)\s+BANCO/i, /GRUPO\s+FINANCIERO\s+([A-ZÁÉÍÓÚÑ]+)/i];
  for(const pattern of patterns){ const m=documentText.match(pattern); if(m) return m[1].toUpperCase(); }
  return "No identificado";
}
