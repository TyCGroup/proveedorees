const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onCall} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

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