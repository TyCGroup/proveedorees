const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");
const XLSX = require("xlsx");

admin.initializeApp();

// Función para crear transporter dinámicamente
function createTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  console.log("Configuring email with user:", emailUser ? "SET" : "NOT SET");
  console.log("Password configured:", emailPassword ? "SET" : "NOT SET");
  
  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

// Cloud Function principal
exports.notifyNewSupplier = onDocumentCreated(
  {
    document: "suppliers/{supplierId}",
    secrets: ["EMAIL_USER", "EMAIL_PASSWORD"]
  },
  async (event) => {
    try {
      const snap = event.data;
      const supplierId = event.params.supplierId;
      const supplierData = snap.data();

      logger.info("Nuevo proveedor registrado:", supplierId);

      // Crear transporter dinámicamente
      const transporter = createTransporter();
      logger.info("Email transporter created successfully");

      // Preparar datos para los emails
      const emailData = extractEmailData(supplierData, supplierId);
      emailData.fileUrls = supplierData.files || {}; // Agregar URLs de archivos
      
      logger.info("Target emails:", {
        admin: "compras@tycgroup.com",
        supplier: emailData.paymentsEmail
      });
      logger.info("Document URLs:", emailData.fileUrls);

      // Email al administrador de compras
      const adminMailOptions = {
        from: process.env.EMAIL_USER,
        to: "compras@tycgroup.com",
        subject: `Nuevo Registro de Proveedor: ${emailData.companyName}`,
        html: generateAdminEmailTemplate(emailData),
      };

      logger.info("Sending admin email...");
      await transporter.sendMail(adminMailOptions);
      logger.info("Admin email sent successfully");

      // Email de confirmación al proveedor (usar contacto-email)
      const supplierEmail = emailData.paymentsEmail;
      if (supplierEmail && supplierEmail.includes("@")) {
        const supplierMailOptions = {
          from: process.env.EMAIL_USER,
          to: supplierEmail,
          subject: "Confirmación de Pre-registro - T&C Group",
          html: generateSupplierConfirmationTemplate(emailData),
        };

        logger.info("Sending supplier email to:", supplierEmail);
        await transporter.sendMail(supplierMailOptions);
        logger.info("Supplier email sent successfully");
      } else {
        logger.warn("No valid supplier email found:", supplierEmail);
      }

      // Actualizar documento con flag de email enviado
      await snap.ref.update({
        emailNotificationSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        notificationEmails: {
          admin: "compras@tycgroup.com",
          supplier: supplierEmail || null,
        },
      });

      logger.info("Emails enviados exitosamente para:", supplierId);
      return null;
    } catch (error) {
      logger.error("Error enviando notificaciones:", error);

      // Actualizar documento con error
      await event.data.ref.update({
        emailNotificationSent: false,
        emailError: error.message,
        emailErrorAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  }
);

// Función para extraer datos relevantes
function extractEmailData(supplierData, supplierId) {
  return {
    supplierId: supplierId,
    companyName: supplierData["nombre-comercial"] || supplierData["razon-social"] || "No especificado",
    razonSocial: supplierData["razon-social"] || "No especificado",
    rfc: supplierData.rfc || "No especificado",
    contactName: `${supplierData["contacto-nombre"] || ""} ${supplierData["contacto-apellido"] || ""}`.trim() || "No especificado",
    contactEmail: supplierData["contacto-email"] || "No especificado",
    paymentsEmail: supplierData["contacto-email"] || null,
    contactPhone: supplierData["contacto-celular"] || "No especificado",
    contactPosition: supplierData["contacto-cargo"] || "No especificado",
    bankingPhone: supplierData["telefono-cobranza"] || "No especificado",
    accountNumber: supplierData["numero-cuenta"] || "No especificado",
    clabe: supplierData.clabe || "No especificado",
    bank: supplierData.banco || "No especificado",
    segments: supplierData.segmentos ? supplierData.segmentos.join(", ") : "No especificado",
    geographicCoverage: supplierData["ciudades-servicio"] || "No especificado",
    responseTime: supplierData["tiempo-respuesta"] || "No especificado",
    additionalBenefits: supplierData["beneficios-adicionales"] || "Ninguno especificado",
    referredBy: supplierData["persona-invita"] || "Registro directo",
    registrationDate: new Date().toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Mexico_City",
    }),
    registrationTime: new Date().toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
    }),
  };
}

// Template para email al administrador
function generateAdminEmailTemplate(data) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nuevo Registro de Proveedor</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 700px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px 20px; }
        .section { margin-bottom: 25px; }
        .section h3 { 
          color: #1e40af; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 8px; 
          margin-bottom: 15px;
        }
        .info-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          margin-bottom: 20px;
        }
        .info-item { 
          background: #f8fafc; 
          padding: 12px; 
          border-radius: 6px;
          border-left: 4px solid #1e40af;
        }
        .info-item .label { 
          font-weight: bold; 
          color: #1e40af; 
          display: block;
          margin-bottom: 4px;
        }
        .info-item .value { 
          color: #374151;
        }
        .full-width { grid-column: 1 / -1; }
        .btn { 
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          display: inline-block; 
          margin: 15px 0;
          font-weight: bold;
        }
        .footer {
          background: #f8fafc;
          padding: 20px;
          text-align: center;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        .urgent { 
          background: #fef3c7; 
          border-left: 4px solid #f59e0b; 
          padding: 15px; 
          margin: 20px 0;
          border-radius: 6px;
        }
        .documents-section {
          background: #f0fdf4;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #10b981;
        }
        .document-item {
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #d1fae5;
        }
        .document-item:last-child {
          border-bottom: none;
        }
        .document-label {
          font-weight: 500;
          color: #374151;
        }
        .document-link {
          background: #10b981;
          color: white !important;
          padding: 6px 12px;
          text-decoration: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        .document-link:hover {
          background: #059669;
        }
        .document-missing {
          color: #ef4444;
          font-style: italic;
          margin: 8px 0;
          font-size: 14px;
        }
        @media (max-width: 600px) {
          .info-grid { grid-template-columns: 1fr; }
          .container { margin: 10px; }
          .header, .content { padding: 20px 15px; }
          .document-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nuevo Registro de Proveedor</h1>
          <p>Pre-registro completado en el portal T&C Group</p>
          <p><strong>${data.registrationDate} a las ${data.registrationTime}</strong></p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <strong>Acción requerida:</strong> Revisar y validar la información del nuevo proveedor registrado.
          </div>

          <div class="section">
            <h3>Información de la Empresa</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Nombre Comercial:</span>
                <span class="value">${data.companyName}</span>
              </div>
              <div class="info-item">
                <span class="label">Razón Social:</span>
                <span class="value">${data.razonSocial}</span>
              </div>
              <div class="info-item">
                <span class="label">RFC:</span>
                <span class="value">${data.rfc}</span>
              </div>
              <div class="info-item">
                <span class="label">Fecha de Registro:</span>
                <span class="value">${data.registrationDate}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Contacto Principal</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Nombre:</span>
                <span class="value">${data.contactName}</span>
              </div>
              <div class="info-item">
                <span class="label">Cargo:</span>
                <span class="value">${data.contactPosition}</span>
              </div>
              <div class="info-item">
                <span class="label">Email de contacto:</span>
                <span class="value">${data.contactEmail}</span>
              </div>
              <div class="info-item">
                <span class="label">Teléfono:</span>
                <span class="value">${data.contactPhone}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Información Bancaria</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Email para comunicaciones:</span>
                <span class="value">${data.paymentsEmail || "No proporcionado"}</span>
              </div>
              <div class="info-item">
                <span class="label">Teléfono cobranza:</span>
                <span class="value">${data.bankingPhone}</span>
              </div>
              <div class="info-item">
                <span class="label">Banco:</span>
                <span class="value">${data.bank}</span>
              </div>
              <div class="info-item">
                <span class="label">CLABE:</span>
                <span class="value">${data.clabe}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">Número de cuenta:</span>
                <span class="value">${data.accountNumber}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Información Comercial</h3>
            <div class="info-grid">
              <div class="info-item full-width">
                <span class="label">Servicios/Segmentos:</span>
                <span class="value">${data.segments}</span>
              </div>
              <div class="info-item">
                <span class="label">Tiempo de Respuesta:</span>
                <span class="value">${data.responseTime}</span>
              </div>
              <div class="info-item">
                <span class="label">Referido por:</span>
                <span class="value">${data.referredBy}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">Cobertura Geográfica:</span>
                <span class="value">${data.geographicCoverage}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">Beneficios Adicionales:</span>
                <span class="value">${data.additionalBenefits}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Documentos Subidos</h3>
            <div class="documents-section">
              ${data.fileUrls && data.fileUrls.opinion ? `
                <div class="document-item">
                  <span class="document-label">Opinión de Cumplimiento 32D:</span>
                  <a href="${data.fileUrls.opinion}" class="document-link" target="_blank">
                    Abrir PDF
                  </a>
                </div>
              ` : '<div class="document-missing">Opinión 32D: No disponible</div>'}
              
              ${data.fileUrls && data.fileUrls.constancia ? `
                <div class="document-item">
                  <span class="document-label">Constancia de Situación Fiscal:</span>
                  <a href="${data.fileUrls.constancia}" class="document-link" target="_blank">
                    Abrir PDF
                  </a>
                </div>
              ` : '<div class="document-missing">Constancia Fiscal: No disponible</div>'}
              
              ${data.fileUrls && data.fileUrls.bancario ? `
                <div class="document-item">
                  <span class="document-label">Estado de Cuenta Bancario:</span>
                  <a href="${data.fileUrls.bancario}" class="document-link" target="_blank">
                    Abrir PDF
                  </a>
                </div>
              ` : '<div class="document-missing">Estado de Cuenta: No disponible</div>'}
            </div>
          </div>

          <div class="section">
            <h3>Acciones</h3>
            <a href="https://console.firebase.google.com/project/compras-tyc/firestore/data/~2Fsuppliers~2F${data.supplierId}" 
               class="btn" target="_blank">
               Ver Detalles Completos en Firebase
            </a>
          </div>
        </div>

        <div class="footer">
          <p><strong>ID del Registro:</strong> ${data.supplierId}</p>
          <p>Sistema Automático de Notificaciones - T&C Group</p>
          <p><em>Este mensaje fue enviado automáticamente desde respaldos@tycgroup.com</em></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Template para confirmación al proveedor
function generateSupplierConfirmationTemplate(data) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmación de Pre-registro</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f0fdf4;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          color: white; 
          padding: 40px 20px; 
          text-align: center; 
        }
        .success-icon { 
          font-size: 48px; 
          margin-bottom: 15px; 
          display: block;
        }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px 25px; }
        .highlight { 
          background: #f0fdf4; 
          padding: 20px; 
          border-radius: 6px; 
          border-left: 4px solid #10b981;
          margin: 20px 0;
        }
        .steps { 
          background: #f8fafc; 
          padding: 20px; 
          border-radius: 6px; 
          margin: 20px 0;
        }
        .steps h4 { color: #10b981; margin-top: 0; }
        .steps ul { padding-left: 20px; }
        .steps li { margin: 8px 0; }
        .contact-info { 
          background: #1e40af; 
          color: white; 
          padding: 20px; 
          border-radius: 6px; 
          text-align: center;
          margin: 25px 0;
        }
        .contact-info a { color: #93c5fd; text-decoration: none; }
        .footer {
          background: #f8fafc;
          padding: 20px;
          text-align: center;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        .reference-box {
          background: #fffbeb;
          border: 1px solid #fbbf24;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="success-icon">✅</span>
          <h1>Pre-registro Exitoso</h1>
          <p>Confirmación de solicitud recibida</p>
        </div>
        
        <div class="content">
          <p>Estimado(a) representante de <strong>${data.companyName}</strong>,</p>
          
          <div class="highlight">
            <p><strong>Gracias por su interés en formar parte de nuestra red de proveedores</strong></p>
            <p>Confirmamos que hemos recibido correctamente su solicitud de pre-registro como proveedor de T&C Group el día <strong>${data.registrationDate}</strong>.</p>
          </div>
          
          <div class="reference-box">
            <strong>Número de referencia de su solicitud:</strong><br>
            <span style="font-size: 18px; color: #1e40af; font-weight: bold;">${data.supplierId}</span>
          </div>
          
          <div class="steps">
            <h4>Próximos pasos en el proceso:</h4>
            <ul>
              <li><strong>Revisión inicial:</strong> Nuestro equipo de compras analizará la información proporcionada</li>
              <li><strong>Validación de documentos:</strong> Verificaremos la autenticidad y vigencia de los documentos subidos</li>
              <li><strong>Notificación de resultado:</strong> Le informaremos sobre el estatus de su solicitud a este mismo correo</li>
            </ul>
          </div>
          
          <div class="highlight">
            <p><strong>Tiempo estimado de respuesta:</strong> 5-7 días hábiles</p>
            <p><strong>Email de notificación:</strong> ${data.paymentsEmail}</p>
          </div>
          
          <p><strong>Información importante:</strong></p>
          <ul>
            <li>Conserve este correo como comprobante de su solicitud</li>
            <li>Si necesita actualizar algún dato, contacte a nuestro equipo citando su número de referencia</li>
            <li>Recibirá notificaciones sobre el avance del proceso en este correo</li>
            <li>Todas las comunicaciones oficiales se enviarán a este email</li>
          </ul>
          
          <div class="contact-info">
            <h4>¿Necesita ayuda o tiene preguntas?</h4>
            <p>Email: <a href="mailto:compras@tycgroup.com">compras@tycgroup.com</a></p>
            <p><strong>Importante:</strong> Al contactarnos, mencione siempre su número de referencia</p>
          </div>
          
          <p>Valoramos su interés en colaborar con T&C Group y esperamos establecer una relación comercial exitosa y duradera.</p>
          
          <p><strong>Atentamente,</strong><br>
          Equipo de Compras<br>
          <strong>T&C Group</strong><br>
          <em>Turismo y Convenciones S.A. de C.V.</em></p>
        </div>

        <div class="footer">
          <p>Este es un mensaje automático, por favor no responda directamente a este correo.</p>
          <p>Para consultas, escriba a: <strong>compras@tycgroup.com</strong></p>
          <p>© 2025 T&C Group - Sistema de Gestión de Proveedores</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Cloud Function adicional para reenviar notificaciones (opcional)
exports.resendNotification = onCall(
  {
    secrets: ["EMAIL_USER", "EMAIL_PASSWORD"]
  },
  async (request) => {
    try {
      const {data} = request;
      const {supplierId} = data;

      const doc = await admin.firestore().collection("suppliers").doc(supplierId).get();

      if (!doc.exists) {
        throw new Error("Supplier not found");
      }

      const supplierData = doc.data();
      const emailData = extractEmailData(supplierData, supplierId);
      emailData.fileUrls = supplierData.files || {};

      // Crear transporter dinámicamente
      const transporter = createTransporter();

      // Reenviar email al administrador
      const adminMailOptions = {
        from: process.env.EMAIL_USER,
        to: "compras@tycgroup.com",
        subject: `REENVIADO - Registro: ${emailData.companyName}`,
        html: generateAdminEmailTemplate(emailData),
      };

      await transporter.sendMail(adminMailOptions);

      await doc.ref.update({
        emailResent: true,
        emailResentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {success: true, message: "Notificación reenviada exitosamente"};
    } catch (error) {
      logger.error("Error reenviando notificación:", error);
      throw new Error(error.message);
    }
  }
);

// Cloud Function para enviar emails de prueba (desarrollo)
exports.sendTestEmail = onCall(
  {
    secrets: ["EMAIL_USER", "EMAIL_PASSWORD"]
  },
  async () => {
    try {
      // Crear transporter dinámicamente
      const transporter = createTransporter();

      const testMailOptions = {
        from: process.env.EMAIL_USER,
        to: "compras@tycgroup.com",
        subject: "Prueba de configuración de email - T&C Group",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Configuración de email funcionando correctamente</h2>
            <p>Este es un email de prueba para verificar que Cloud Functions puede enviar emails.</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-MX")}</p>
            <p><strong>Desde:</strong> ${process.env.EMAIL_USER}</p>
            <p><strong>Para:</strong> compras@tycgroup.com</p>
            <hr>
            <small>T&C Group - Sistema de notificaciones</small>
          </div>
        `,
      };

      await transporter.sendMail(testMailOptions);

      return {success: true, message: "Email de prueba enviado correctamente"};
    } catch (error) {
      logger.error("Error enviando email de prueba:", error);
      throw new Error(error.message);
    }
  }
);

// Cloud Function HTTP para pruebas (temporal)
exports.testEmailHttp = onRequest(
  {
    secrets: ["EMAIL_USER", "EMAIL_PASSWORD"]
  },
  async (req, res) => {
    try {
      const transporter = createTransporter();
      
      const testMailOptions = {
        from: process.env.EMAIL_USER,
        to: "compras@tycgroup.com",
        subject: "Prueba HTTP - T&C Group",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Email de prueba HTTP funcionando</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-MX")}</p>
            <p><strong>Desde:</strong> ${process.env.EMAIL_USER}</p>
            <p><strong>Para:</strong> compras@tycgroup.com</p>
          </div>
        `,
      };

      await transporter.sendMail(testMailOptions);
      
      res.json({success: true, message: "Email enviado correctamente"});
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({error: error.message});
    }
  }
);

// Agregar estas funciones al archivo functions/index.js

// Cloud Function para manejar notificaciones de revisión manual
exports.notifyManualReviewSupplier = onDocumentCreated(
  {
    document: "manual-review-suppliers/{supplierId}",
    secrets: ["EMAIL_USER", "EMAIL_PASSWORD"]
  },
  async (event) => {
    try {
      const snap = event.data;
      const supplierId = event.params.supplierId;
      const supplierData = snap.data();

      logger.info("Nueva solicitud de revisión manual:", supplierId);

      // Crear transporter dinámicamente
      const transporter = createTransporter();
      logger.info("Email transporter created successfully for manual review");

      // Preparar datos para los emails
      const emailData = extractManualReviewEmailData(supplierData, supplierId);
      emailData.fileUrls = supplierData.files || {}; // Agregar URLs de archivos
      
      logger.info("Manual review target emails:", {
        admin: "compras@tycgroup.com",
        supplier: emailData.contactEmail
      });
      logger.info("Manual review document URLs:", emailData.fileUrls);

      // Email al administrador de compras (diferente para revisión manual)
      const adminMailOptions = {
        from: process.env.EMAIL_USER,
        to: "compras@tycgroup.com",
        subject: `🔍 REVISIÓN MANUAL REQUERIDA: ${emailData.companyName}`,
        html: generateManualReviewAdminTemplate(emailData),
      };

      logger.info("Sending manual review admin email...");
      await transporter.sendMail(adminMailOptions);
      logger.info("Manual review admin email sent successfully");

      // Email de confirmación al proveedor (para revisión manual)
      const supplierEmail = emailData.contactEmail;
      if (supplierEmail && supplierEmail.includes("@")) {
        const supplierMailOptions = {
          from: process.env.EMAIL_USER,
          to: supplierEmail,
          subject: "Solicitud Recibida para Revisión Manual - T&C Group",
          html: generateManualReviewSupplierTemplate(emailData),
        };

        logger.info("Sending manual review supplier email to:", supplierEmail);
        await transporter.sendMail(supplierMailOptions);
        logger.info("Manual review supplier email sent successfully");
      } else {
        logger.warn("No valid supplier email found for manual review:", supplierEmail);
      }

      // Actualizar documento con flag de email enviado
      await snap.ref.update({
        emailNotificationSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        notificationEmails: {
          admin: "compras@tycgroup.com",
          supplier: supplierEmail || null,
        },
      });

      logger.info("Manual review emails enviados exitosamente para:", supplierId);
      return null;
    } catch (error) {
      logger.error("Error enviando notificaciones de revisión manual:", error);

      // Actualizar documento con error
      await event.data.ref.update({
        emailNotificationSent: false,
        emailError: error.message,
        emailErrorAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  }
);

// Función para extraer datos relevantes de revisión manual
function extractManualReviewEmailData(supplierData, supplierId) {
  return {
    supplierId: supplierId,
    companyName: supplierData.companyName || "No especificado",
    contactName: supplierData.contactName || "No especificado",
    contactEmail: supplierData.contactEmail || "No especificado",
    contactPhone: supplierData.contactPhone || "No especificado",
    submissionType: supplierData.submissionType || "manual-review",
    reason: supplierData.reason || "documents-validation-failed",
    registrationDate: new Date().toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Mexico_City",
    }),
    registrationTime: new Date().toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City",
    }),
  };
}

// Template para email al administrador (revisión manual)
function generateManualReviewAdminTemplate(data) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Revisión Manual Requerida</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #fef3c7;
        }
        .container { 
          max-width: 700px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .warning-badge {
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          margin: 15px 0;
        }
        .content { padding: 30px 20px; }
        .section { margin-bottom: 25px; }
        .section h3 { 
          color: #f59e0b; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 8px; 
          margin-bottom: 15px;
        }
        .info-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          margin-bottom: 20px;
        }
        .info-item { 
          background: #fef3c7; 
          padding: 12px; 
          border-radius: 6px;
          border-left: 4px solid #f59e0b;
        }
        .info-item .label { 
          font-weight: bold; 
          color: #92400e; 
          display: block;
          margin-bottom: 4px;
        }
        .info-item .value { 
          color: #78350f;
        }
        .full-width { grid-column: 1 / -1; }
        .urgent-notice { 
          background: #fee2e2; 
          border-left: 4px solid #ef4444; 
          padding: 20px; 
          margin: 20px 0;
          border-radius: 6px;
        }
        .urgent-notice h4 {
          color: #991b1b;
          margin: 0 0 10px 0;
        }
        .urgent-notice p {
          color: #7f1d1d;
          margin: 0;
        }
        .documents-section {
          background: #fff7ed;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #f97316;
        }
        .document-item {
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #fed7aa;
        }
        .document-item:last-child {
          border-bottom: none;
        }
        .document-label {
          font-weight: 500;
          color: #9a3412;
        }
        .document-link {
          background: #f97316;
          color: white !important;
          padding: 6px 12px;
          text-decoration: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        .document-link:hover {
          background: #ea580c;
        }
        .document-missing {
          color: #ef4444;
          font-style: italic;
          margin: 8px 0;
          font-size: 14px;
        }
        .btn { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 6px; 
          display: inline-block; 
          margin: 15px 0;
          font-weight: bold;
        }
        .footer {
          background: #fef3c7;
          padding: 20px;
          text-align: center;
          color: #92400e;
          border-top: 1px solid #fcd34d;
        }
        @media (max-width: 600px) {
          .info-grid { grid-template-columns: 1fr; }
          .container { margin: 10px; }
          .header, .content { padding: 20px 15px; }
          .document-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="warning-badge">🔍 REVISIÓN MANUAL</div>
          <h1>Solicitud de Revisión Manual</h1>
          <p>Documentos requieren validación adicional</p>
          <p><strong>${data.registrationDate} a las ${data.registrationTime}</strong></p>
        </div>
        
        <div class="content">
          <div class="urgent-notice">
            <h4>⚠️ Acción Inmediata Requerida</h4>
            <p>Esta solicitud requiere revisión manual porque los documentos no pasaron la validación automática. Es necesario revisar manualmente los archivos subidos.</p>
          </div>

          <div class="section">
            <h3>Información de la Empresa</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Nombre de la Empresa:</span>
                <span class="value">${data.companyName}</span>
              </div>
              <div class="info-item">
                <span class="label">Fecha de Solicitud:</span>
                <span class="value">${data.registrationDate}</span>
              </div>
              <div class="info-item">
                <span class="label">Tipo de Solicitud:</span>
                <span class="value">Revisión Manual</span>
              </div>
              <div class="info-item">
                <span class="label">Motivo:</span>
                <span class="value">Validación automática fallida</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Contacto del Solicitante</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Nombre del Contacto:</span>
                <span class="value">${data.contactName}</span>
              </div>
              <div class="info-item">
                <span class="label">Email:</span>
                <span class="value">${data.contactEmail}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">Teléfono:</span>
                <span class="value">${data.contactPhone}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Documentos para Revisión Manual</h3>
            <div class="documents-section">
              <p><strong>Los siguientes documentos requieren validación manual:</strong></p>
              
              ${data.fileUrls && data.fileUrls.opinion ? `
                <div class="document-item">
                  <span class="document-label">📄 Opinión de Cumplimiento 32D:</span>
                  <a href="${data.fileUrls.opinion}" class="document-link" target="_blank">
                    Revisar PDF
                  </a>
                </div>
              ` : '<div class="document-missing">❌ Opinión 32D: No disponible</div>'}
              
              ${data.fileUrls && data.fileUrls.constancia ? `
                <div class="document-item">
                  <span class="document-label">📄 Constancia de Situación Fiscal:</span>
                  <a href="${data.fileUrls.constancia}" class="document-link" target="_blank">
                    Revisar PDF
                  </a>
                </div>
              ` : '<div class="document-missing">❌ Constancia Fiscal: No disponible</div>'}
              
              ${data.fileUrls && data.fileUrls.bancario ? `
                <div class="document-item">
                  <span class="document-label">📄 Estado de Cuenta Bancario:</span>
                  <a href="${data.fileUrls.bancario}" class="document-link" target="_blank">
                    Revisar PDF
                  </a>
                </div>
              ` : '<div class="document-missing">❌ Estado de Cuenta: No disponible</div>'}
            </div>
          </div>

          <div class="section">
            <h3>Pasos a Seguir</h3>
            <div class="info-grid">
              <div class="info-item full-width">
                <span class="label">1. Revisar documentos:</span>
                <span class="value">Descargar y validar manualmente cada archivo PDF</span>
              </div>
              <div class="info-item full-width">
                <span class="label">2. Verificar información:</span>
                <span class="value">Confirmar que los datos coinciden entre documentos</span>
              </div>
              <div class="info-item full-width">
                <span class="label">3. Tomar decisión:</span>
                <span class="value">Aprobar, rechazar o solicitar documentos adicionales</span>
              </div>
              <div class="info-item full-width">
                <span class="label">4. Notificar resultado:</span>
                <span class="value">Contactar al proveedor con la decisión final</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Acciones</h3>
            <a href="https://console.firebase.google.com/project/compras-tyc/firestore/data/~2Fmanual-review-suppliers~2F${data.supplierId}" 
               class="btn" target="_blank">
               📋 Ver Detalles Completos en Firebase
            </a>
          </div>
        </div>

        <div class="footer">
          <p><strong>ID de Solicitud:</strong> ${data.supplierId}</p>
          <p><strong>Colección:</strong> manual-review-suppliers</p>
          <p>Sistema de Revisión Manual - T&C Group</p>
          <p><em>Este mensaje fue enviado automáticamente desde respaldos@tycgroup.com</em></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Template para confirmación al proveedor (revisión manual)
function generateManualReviewSupplierTemplate(data) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Solicitud en Revisión Manual</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #fff7ed;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white; 
          padding: 40px 20px; 
          text-align: center; 
        }
        .review-icon { 
          font-size: 48px; 
          margin-bottom: 15px; 
          display: block;
        }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px 25px; }
        .highlight { 
          background: #fff7ed; 
          padding: 20px; 
          border-radius: 6px; 
          border-left: 4px solid #f59e0b;
          margin: 20px 0;
        }
        .steps { 
          background: #fef3c7; 
          padding: 20px; 
          border-radius: 6px; 
          margin: 20px 0;
        }
        .steps h4 { color: #92400e; margin-top: 0; }
        .steps ul { padding-left: 20px; }
        .steps li { margin: 8px 0; }
        .contact-info { 
          background: #1e40af; 
          color: white; 
          padding: 20px; 
          border-radius: 6px; 
          text-align: center;
          margin: 25px 0;
        }
        .contact-info a { color: #93c5fd; text-decoration: none; }
        .footer {
          background: #fff7ed;
          padding: 20px;
          text-align: center;
          color: #92400e;
          border-top: 1px solid #fcd34d;
        }
        .reference-box {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
        }
        .timeline {
          background: #f8fafc;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
        }
        .timeline h4 {
          color: #1e40af;
          margin-top: 0;
        }
        .timeline-item {
          display: flex;
          align-items: center;
          margin: 10px 0;
          padding: 8px 0;
        }
        .timeline-icon {
          width: 24px;
          height: 24px;
          background: #f59e0b;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          font-size: 12px;
          font-weight: bold;
        }
        .timeline-content {
          flex: 1;
        }
        .timeline-title {
          font-weight: 600;
          color: #374151;
          margin: 0 0 4px 0;
        }
        .timeline-desc {
          color: #6b7280;
          margin: 0;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="review-icon">🔍</span>
          <h1>Solicitud en Revisión Manual</h1>
          <p>Su solicitud está siendo procesada</p>
        </div>
        
        <div class="content">
          <p>Estimado(a) <strong>${data.contactName}</strong>,</p>
          
          <div class="highlight">
            <p><strong>Gracias por su solicitud de registro como proveedor de T&C Group</strong></p>
            <p>Su solicitud para <strong>${data.companyName}</strong> está siendo procesada mediante revisión manual por parte de nuestro equipo especializado.</p>
          </div>
          
          <div class="reference-box">
            <strong>Número de referencia de su solicitud:</strong><br>
            <span style="font-size: 18px; color: #f59e0b; font-weight: bold;">${data.supplierId}</span>
          </div>
          
          <div class="timeline">
            <h4>Proceso de Revisión Manual:</h4>
            
            <div class="timeline-item">
              <div class="timeline-icon">✓</div>
              <div class="timeline-content">
                <div class="timeline-title">Solicitud Recibida</div>
                <div class="timeline-desc">Documentos e información recibidos correctamente</div>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-icon">🔍</div>
              <div class="timeline-content">
                <div class="timeline-title">Revisión en Proceso</div>
                <div class="timeline-desc">Nuestro equipo está validando manualmente sus documentos</div>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-icon">📋</div>
              <div class="timeline-content">
                <div class="timeline-title">Validación de Información</div>
                <div class="timeline-desc">Verificación de datos y cumplimiento de requisitos</div>
              </div>
            </div>
            
            <div class="timeline-item">
              <div class="timeline-icon">📧</div>
              <div class="timeline-content">
                <div class="timeline-title">Notificación de Resultado</div>
                <div class="timeline-desc">Le informaremos la decisión final por este correo</div>
              </div>
            </div>
          </div>
          
          <div class="highlight">
            <p><strong>¿Por qué revisión manual?</strong></p>
            <p>Algunos documentos requieren validación adicional para garantizar el cumplimiento de todos los requisitos. Esto es un proceso normal y no afecta negativamente su solicitud.</p>
          </div>
          
          <div class="steps">
            <h4>Tiempo estimado y próximos pasos:</h4>
            <ul>
              <li><strong>Tiempo de respuesta:</strong> 3-5 días hábiles</li>
              <li><strong>Revisión detallada:</strong> Validación manual de documentos</li>
              <li><strong>Posibles resultados:</strong> Aprobación, solicitud de documentos adicionales, o información sobre ajustes necesarios</li>
              <li><strong>Comunicación:</strong> Todas las actualizaciones se enviarán a ${data.contactEmail}</li>
            </ul>
          </div>
          
          <p><strong>Información importante:</strong></p>
          <ul>
            <li>Conserve este correo como comprobante de su solicitud</li>
            <li>No es necesario reenviar documentos a menos que se lo solicitemos</li>
            <li>Recibirá notificaciones sobre el avance del proceso en este correo</li>
            <li>Si requiere información adicional, nuestro equipo se comunicará directamente</li>
          </ul>
          
          <div class="contact-info">
            <h4>¿Necesita información adicional?</h4>
            <p>Email: <a href="mailto:compras@tycgroup.com">compras@tycgroup.com</a></p>
            <p><strong>Importante:</strong> Al contactarnos, mencione siempre su número de referencia</p>
          </div>
          
          <p>Agradecemos su paciencia durante este proceso de revisión. Nuestro equipo trabajará diligentemente para procesar su solicitud en el menor tiempo posible.</p>
          
          <p><strong>Atentamente,</strong><br>
          Equipo de Compras<br>
          <strong>T&C Group</strong><br>
          <em>Turismo y Convenciones S.A. de C.V.</em></p>
        </div>

        <div class="footer">
          <p>Este es un mensaje automático, por favor no responda directamente a este correo.</p>
          <p>Para consultas, escriba a: <strong>compras@tycgroup.com</strong></p>
          <p>© 2025 T&C Group - Sistema de Gestión de Proveedores</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
// --- Validación estricta de URL del SAT ---
const OFFICIAL_HOST = "siat.sat.gob.mx";
const OFFICIAL_PATH_RE = /^\/app\/qr\/faces\/pages\/mobile\/validadorqr\.jsf$/i;

function isOfficialSatUrl(u) {
  try {
    const { protocol, hostname, pathname } = new URL(u);
    return protocol === "https:" &&
           hostname.toLowerCase() === OFFICIAL_HOST &&
           OFFICIAL_PATH_RE.test(pathname);
  } catch (error) {
    return false;
  }
}

function normalizeRFC(rfc) {
  return (rfc || "").toUpperCase().replace(/\s+/g, "");
}

const norm = (s) => (s || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
const getParam = (u, k) => { try { return new URL(u).searchParams.get(k) || ""; } catch (error) { return ""; } };

// ------------------------------------
// Parsers
// ------------------------------------
function parseOpinionText(text) {
  const out = { tipo: "opinion" };

  // RFC (formato oficial)
  let m = text.match(/RFC\s*:?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i);
  out.rfc = m ? m[1].toUpperCase() : "";

  // Folio
  m = text.match(/Folio\s*:?\s*([A-Z0-9-]+)/i);
  out.folio = m ? m[1] : "";

  // Fecha (DD-MM-YYYY o DD/MM/YYYY)
 m = text.match(/Fecha\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i);
  out.fecha = m ? m[1] : "";
 
  // Sentido (Positivo/Negativo)
  m = text.match(/Sentido\s*:?\s*(Positivo|Negativo)/i);
  out.sentido = m ? m[1] : "";

  return out;
}

function parseCSFText(text) {
  const getAfter = (label) => {
    const re = new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)\\s*(?=[A-ZÁÉÍÓÚÑ].{0,40}:|$)`, "i");
    const m = text.match(re);
    return m ? norm(m[1]) : "";
  };
  const razon_social     = getAfter("Denominación o Razón Social") || getAfter("Denominación / Razón Social") || getAfter("Razón social") || "";
  const regimen_capital  = getAfter("Régimen de capital");
  const fecha_const      = getAfter("Fecha de constitución");
  const inicio_op        = getAfter("Fecha de Inicio de operaciones");
  const situacion        = getAfter("Situación del contribuyente");
  const fecha_ult_cambio = getAfter("Fecha del último cambio de situación");
  const entidad          = getAfter("Entidad Federativa");
  const municipio        = getAfter("Municipio o delegación") || getAfter("Municipio o Delegación");
  const colonia          = getAfter("Colonia");
  const tipo_vialidad    = getAfter("Tipo de vialidad");
  const vialidad_nombre  = getAfter("Nombre de la vialidad");
  const numero_ext       = getAfter("Número exterior");
  const numero_int       = getAfter("Número interior");
  const cp               = getAfter("CP") || getAfter("C.P.");
  const correo           = getAfter("Correo electrónico") || getAfter("Correo electronico");
  const regimen          = getAfter("Régimen") || getAfter("Regimen");
  const fecha_alta       = getAfter("Fecha de alta");
  const rfcLine          = getAfter("El RFC:");

  const domicilio_completo = norm([
    tipo_vialidad, vialidad_nombre, numero_ext,
    numero_int ? ("Int " + numero_int) : "",
    colonia, municipio, entidad, cp ? ("CP " + cp) : "",
  ].filter(Boolean).join(" "));

  return {
    tipo: "csf",
    rfc: (rfcLine || "").replace(/^El RFC:\s*/i, "").replace(/,.*$/, "").trim(),
    razon_social,
    regimen_capital,
    fecha_constitucion: fecha_const,
    inicio_operaciones: inicio_op,
    situacion,
    fecha_ultimo_cambio: fecha_ult_cambio,
    entidad, municipio, colonia,
    tipo_vialidad, vialidad_nombre,
    numero_exterior: numero_ext, numero_interior: numero_int,
    cp, correo, regimen, fecha_alta,
    domicilio_completo,
  };
}

// --- QR (D3) ---
function tryParseFromQuery(url) {
  const d1 = getParam(url, "D1");
  const d3 = getParam(url, "D3") || "";

  if (d1 === "1") {
    // <FOLIO>_<RFC>_<YYYYMMDD[HHmmss]>_<P|N>
    const m = d3.match(/^([^_]+)_([A-Z0-9&Ñ]{12,13})_([0-9]{8,14})_([A-Z])$/i);
    if (m) {
      const folio   = m[1];
      const rfc     = m[2];
      const fecha   = m[3];
      const sentido = (m[4] || "").toUpperCase() === "P" ? "Positivo" : "Negativo";
      return { tipo: "opinion", folio, rfc, fecha, sentido };
    }
  }

  if (d1 === "10") {
    const m = d3.match(/^[^_]+_([A-Z0-9&Ñ]{12,13})$/i);
    if (m) return { tipo: "csf", rfc: m[1] };
  }

  return null;
}

function parseByD1(url, text) {
  const d1 = getParam(url, "D1");
  if (d1 === "1")  return parseOpinionText(text);
  if (d1 === "10" || d1 === "26" || d1 === "0") return parseCSFText(text);
  return { tipo: "desconocido" };
}

function parseOpinionFecha(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{8,14}$/.test(s)) {
    const y = +s.slice(0,4), m = +s.slice(4,6)-1, d = +s.slice(6,8);
    const hh = s.length>=10? +s.slice(8,10):0, mm = s.length>=12? +s.slice(10,12):0, ss = s.length===14? +s.slice(12,14):0;
    return new Date(y,m,d,hh,mm,ss);
  }
  let m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1]);
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}
const isPositive = (sentido) => /positivo|positiva|^p$/i.test(String(sentido||"").trim());

// --- Descarga + parseo de UNA URL ---
async function fetchAndParseOne(url) {
  const fast = tryParseFromQuery(url);

  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es" },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  $('script,style,noscript').remove();        // <— evita “PrimeFaces.cw(…)”
  const text = norm($("body").text());

  const parsed = parseByD1(url, text);

  // Completar con datos del QR si faltan
  if (fast && fast.tipo === "csf" && fast.rfc && !parsed.rfc) parsed.rfc = fast.rfc;
  if (fast && fast.tipo === "opinion") {
    if (fast.folio   && !parsed.folio)   parsed.folio   = fast.folio;
    if (fast.rfc     && !parsed.rfc)     parsed.rfc     = fast.rfc;
    if (fast.fecha   && !parsed.fecha)   parsed.fecha   = fast.fecha;
    if (fast.sentido && !parsed.sentido) parsed.sentido = fast.sentido;
  }

  return { url, fields: { ...parsed, blob: text, html } };
}

async function isRfcIn69B(rfc) {
  const R = normalizeRFC(rfc);
  if (!R) return false;
  const db = admin.firestore();
  // 1) lookup por ID
  const byId = await db.collection("69B").doc(R).get();
  if (byId.exists) return true;
  // 2) fallback por campo (por si guardaste con otro ID)
  const snap = await db.collection("69B").where("rfc", "==", R).limit(1).get();
  return !snap.empty;
}


// --- HTTP Function ---
exports.satExtract = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método no permitido. Usa POST." });
    }

    const { url, urlOpinion, urlCSF } = req.body || {};

    // ======================
    // MODO PAREJA (OPINIÓN + CSF)
    // ======================
    if (urlOpinion || urlCSF) {
      if (!urlOpinion || !urlCSF) {
        return res.status(400).json({ ok: false, error: "Debes enviar ambas URLs: urlOpinion y urlCSF." });
      }
      if (!isOfficialSatUrl(urlOpinion) || !isOfficialSatUrl(urlCSF)) {
        return res.status(400).json({ ok: false, error: "Alguna URL no es oficial del SAT." });
      }

      // 1) Descargar y parsear ambas páginas del SAT
      const [opinion, csf] = await Promise.all([
        fetchAndParseOne(urlOpinion),
        fetchAndParseOne(urlCSF),
      ]);

      // 2) Coincidencia de RFC
      const rfcOpinion = normalizeRFC(opinion.fields.rfc);
      const rfcCSF     = normalizeRFC(csf.fields.rfc);
      if (!rfcOpinion || !rfcCSF || rfcOpinion !== rfcCSF) {
        return res.status(422).json({
          ok: false,
          error: "El RFC de la Opinión 32D y el de la CSF no coinciden.",
          details: { rfcOpinion: rfcOpinion || "?", rfcCSF: rfcCSF || "?" },
          opinion, csf,
        });
      }

      // 3) BLOQUEO por lista 69-B
      const listed = await isRfcIn69B(rfcOpinion);
      if (listed) {
        return res.status(422).json({
          ok: false,
          reason: "RFC_IN_69B",
          error: "El RFC aparece en la lista 69-B del SAT y no puede continuar.",
          details: { rfc: rfcOpinion },
          opinion, csf,
        });
      }

      // 4) Sentido POSITIVO
      if (!isPositive(opinion.fields.sentido)) {
        return res.status(422).json({
          ok: false,
          error: "La Opinión 32D no es POSITIVA.",
          details: { sentido: opinion.fields.sentido || "" },
          opinion, csf,
        });
      }

      // 5) Fecha de la Opinión: <= 30 días (no futura)
      const fechaOp = parseOpinionFecha(opinion.fields.fecha);
      if (!fechaOp) {
        return res.status(422).json({
          ok: false,
          error: "No se pudo leer la fecha de la Opinión 32D.",
          opinion, csf,
        });
      }
      const diffDays = Math.floor((Date.now() - fechaOp.getTime()) / 86400000);
      if (diffDays < 0 || diffDays > 30) {
        return res.status(422).json({
          ok: false,
          error: "La Opinión 32D tiene más de 30 días (o es futura).",
          details: { fecha: opinion.fields.fecha, diffDays },
          opinion, csf,
        });
      }

      // 6) OK
      return res.json({
        ok: true,
        mode: "pair",
        rfcMatch: true,
        rfc: rfcOpinion,
        sentido: "Positivo",
        fechaOpinion: fechaOp.toISOString(),
        opinion,
        csf,
      });
    }

    // ======================
    // MODO SINGLE (una sola URL del SAT)
    // ======================
    if (!url) {
      return res.status(400).json({ ok: false, error: "Falta 'url'." });
    }
    if (!isOfficialSatUrl(url)) {
      return res.status(400).json({ ok: false, error: "URL no permitida (debe ser oficial del SAT)." });
    }

    const result = await fetchAndParseOne(url);
    return res.json({ ok: true, mode: "single", ...result });

  } catch (error) {
    console.error("satExtract error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Error interno" });
  }
});

// ====== SAT 69-B: REPLACE COMPLETO (borra colección y reescribe con últimos RFC) ======

const BASE_PAGE_69B = "http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/contribuyentes_publicados.html";
const BASE_HOST_69B = "http://omawww.sat.gob.mx";

// --- Encuentra el enlace "Listado completo" en la página del SAT ---
function pickListadoCompletoLink(html) {
  const $ = cheerio.load(html);
  let link = null;
  $("a").each((_, a) => {
    const txt = ($(a).text() || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (txt.includes("listado completo")) { link = $(a).attr("href") || null; return false; }
  });
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return BASE_HOST_69B + (link.startsWith("/") ? link : "/" + link);
}

async function fetchListadoCompletoExcelUrl() {
  const { data: html } = await axios.get(BASE_PAGE_69B, { timeout: 20000 });
  const url = pickListadoCompletoLink(html);
  if (!url) throw new Error("No se encontró el enlace 'Listado completo' en la página del SAT.");
  return url;
}

async function downloadExcelBuffer(excelUrl) {
  const resp = await axios.get(excelUrl, { responseType: "arraybuffer", timeout: 60000 });
  return Buffer.from(resp.data);
}

// --- SOLO RFC: lee columna B (índice 1) desde la fila 3 (índice 2) ---
function extractRFCsFromSheet(ws) {
  const ref = ws["!ref"] || "A1:A1";
  const range = XLSX.utils.decode_range(ref);
  const rfcs = [];
  const seen = new Set();

  for (let r = Math.max(2, range.s.r); r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ c: 1, r });  // Columna B
    const cell = ws[addr];
    if (!cell) continue;

    let rfc = String(cell.v != null ? cell.v : "").toUpperCase().replace(/\s+/g, "").trim();
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) continue;  // valida formato
    if (!seen.has(rfc)) { seen.add(rfc); rfcs.push(rfc); }
  }
  return rfcs;
}

// --- Borra TODOS los docs de una colección usando BulkWriter ---
async function wipeCollection(colPath) {
  const db = admin.firestore();
  const writer = db.bulkWriter();
  const refs = await db.collection(colPath).listDocuments(); // no lee contenido, solo refs
  for (const ref of refs) writer.delete(ref);
  await writer.close();
}

// --- Reemplaza colección 69B con la lista nueva ---
async function replace69BFromBuffer(buf, excelUrl) {
  const wb = XLSX.read(buf, { type: "buffer" });   // autodetecta .xlsx o .csv
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("El archivo no tiene hojas válidas.");

  const rfcs = extractRFCsFromSheet(ws);
  const db = admin.firestore();

  // 1) BORRAR TODO lo anterior
  await wipeCollection("69B");

  // 2) ESCRIBIR los nuevos
  const writer = db.bulkWriter();
  for (const rfc of rfcs) {
    writer.set(db.collection("69B").doc(rfc), {
      rfc,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceUrl: excelUrl,
    });
  }
  await writer.close();

  // Bitácora del import
  await db.collection("69B_imports").add({
    at: admin.firestore.FieldValue.serverTimestamp(),
    sourceUrl: excelUrl,
    totalRFCs: rfcs.length,
    mode: "replace",
  });

  return { totalRFCs: rfcs.length };
}

// === Programado mensual: día 3 a las 09:00 (hora CDMX) ===
exports.replaceSat69BMonthly = onSchedule(
  { schedule: "0 4 * * *", timeZone: "America/Mexico_City", memory: "1GiB", timeoutSeconds: 540 },
  async () => {
    const excelUrl = await fetchListadoCompletoExcelUrl();
    const buf = await downloadExcelBuffer(excelUrl);
    const r = await replace69BFromBuffer(buf, excelUrl);
    console.log("69B replace done:", r);
    return r;
  }
);

