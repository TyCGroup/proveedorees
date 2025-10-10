
// uploader.js
// Subida a Firebase Storage (sin OCR), reutilizando un submissionId por sesión
export async function uploadOnly(docType, file){
  try{
    const ts = Date.now();
    let submissionId = sessionStorage.getItem("submissionId");
    if(!submissionId){ submissionId=`sub-${ts}`; sessionStorage.setItem("submissionId", submissionId); }
    const mapName={ opinion:"32D", constancia:"CSF", bancario:"EDO.CTA" };
    const base = mapName[docType] || docType.toUpperCase();
    const safeOrig = file.name.replace(/[^\w.\- ()]/g,"_");
    const fileName = `${base}_${ts}_${safeOrig}`;
    const path = `suppliers/${submissionId}/${fileName}`;
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(path);
    const metadata = { contentType: file.type || "application/pdf" };
    await fileRef.put(file, metadata);
    const url = await fileRef.getDownloadURL();
    window.dispatchEvent(new CustomEvent("fileUploaded",{ detail:{ docType, url, name:file.name } }));
    return url;
  }catch(e){ throw e; }
}
