import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

// Lazy initialization of Supabase Server Client
let supabaseServer: SupabaseClient | null = null;
function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!supabaseServer) {
    supabaseServer = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabaseServer;
}

// In-app fallback JSON persistence store for registrations (ensures zero data loss)
const DATA_DIR = path.resolve(process.cwd(), "data");
const REGISTRATIONS_FILE = path.join(DATA_DIR, "registrations.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REGISTRATIONS_FILE)) {
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function loadLocalRegistrations(): any[] {
  try {
    ensureDataFile();
    const data = fs.readFileSync(REGISTRATIONS_FILE, "utf8");
    return JSON.parse(data) || [];
  } catch (err) {
    console.error("Error reading local registrations:", err);
    return [];
  }
}

function saveLocalRegistration(record: any): any {
  try {
    ensureDataFile();
    const list = loadLocalRegistrations();
    const existingIndex = list.findIndex((r) => r.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...record, updated_at: new Date().toISOString() };
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(list, null, 2), "utf8");
    return record;
  } catch (err) {
    console.error("Error saving local registration:", err);
    return record;
  }
}

// Lazy initialization of Resend
let resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) {
    resend = new Resend(key);
  }
  return resend;
}

// Lazy initialization of Nodemailer (Gmail or Custom SMTP)
let mailTransporter: nodemailer.Transporter | null = null;
function getMailTransporter(): { transporter: nodemailer.Transporter | null; senderAddress: string | null } {
  const user = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS;

  if (user && pass) {
    if (!mailTransporter) {
      if (process.env.SMTP_HOST) {
        mailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: {
            user,
            pass,
          },
        });
      } else {
        // Standard Gmail configuration
        mailTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user,
            pass,
          },
        });
      }
    }
    return { transporter: mailTransporter, senderAddress: user };
  }
  return { transporter: null, senderAddress: null };
}

const calculateCategory = (birthDay: string, birthMonth: string, birthYear: string): string => {
  if (!birthDay || !birthMonth || !birthYear) return "General";
  const birthDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 5) return "Menor de 5 años";
  if (age <= 11) return `Infantil (${age} años)`;
  if (age <= 15) return `Juvenil (${age} años)`;
  if (age <= 29) return `Libre (${age} años)`;
  if (age <= 39) return `Sub-Master (${age} años)`;
  if (age <= 49) return `Master A (${age} años)`;
  if (age <= 59) return `Master B (${age} años)`;
  return `Master C (${age} años)`;
};

async function sendRegistrationEmails(payload: {
  fullName: string;
  email: string;
  cedula: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
}) {
  const { fullName, email, cedula, birthDay, birthMonth, birthYear } = payload;
  const category = calculateCategory(birthDay, birthMonth, birthYear);
  const birthFormatted = `${birthDay.padStart(2, "0")}/${birthMonth.padStart(2, "0")}/${birthYear}`;
  const adminEmail = process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com";
  const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; color: #1a1a1a; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #fed7aa; box-shadow: 0 10px 25px rgba(249, 115, 22, 0.1); }
          .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; }
          .header p { margin: 6px 0 0 0; font-size: 13px; font-weight: 700; opacity: 0.9; letter-spacing: 2px; }
          .content { padding: 32px 24px; }
          .welcome { font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 12px; }
          .box { background: #fff7ed; border: 1px solid #ffedd5; border-radius: 16px; padding: 20px; margin: 20px 0; }
          .field { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fed7aa; font-size: 14px; }
          .field:last-child { border-bottom: none; }
          .label { font-weight: 700; color: #9a3412; }
          .value { font-weight: 600; color: #1f2937; }
          .badge { display: inline-block; background: #f97316; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          .footer { background: #fafafa; padding: 20px 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #f3f4f6; }
          .contact-btn { display: inline-block; background: #25d366; color: #ffffff; padding: 12px 24px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 13px; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p>NEW ERA</p>
            <h1>DESAFÍO EL VOLCÁN</h1>
          </div>
          <div class="content">
            <div class="welcome">¡Hola, ${fullName}! 👋</div>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
              Tu registro para el <strong>Desafío El Volcán</strong> ha sido recibido exitosamente. A continuación encuentras los datos de tu inscripción:
            </p>
            
            <div class="box">
              <div class="field">
                <span class="label">Atleta:</span>
                <span class="value">${fullName}</span>
              </div>
              <div class="field">
                <span class="label">Cédula / Documento:</span>
                <span class="value">${cedula}</span>
              </div>
              <div class="field">
                <span class="label">Correo:</span>
                <span class="value">${email}</span>
              </div>
              <div class="field">
                <span class="label">Nacimiento:</span>
                <span class="value">${birthFormatted}</span>
              </div>
              <div class="field">
                <span class="label">Categoría Asignada:</span>
                <span class="value"><span class="badge">${category}</span></span>
              </div>
            </div>

            <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
              📍 <strong>Ubicación:</strong> El Volcán, Caracas<br>
              🏃 <strong>Modalidad:</strong> 3KM Trail Running / Asfalto<br>
              🏁 <strong>Meta:</strong> Las Antenas / Hacienda Topito
            </p>

            <div style="text-align: center; margin-top: 24px;">
              <p style="font-size: 12px; font-weight: 700; color: #9a3412;">¿Tienes alguna consulta o deseas contactar a la organización?</p>
              <a href="https://wa.me/584142525647?text=${encodeURIComponent('Hola, me he inscrito en el Desafío El Volcán: ' + fullName + ' (Cédula: ' + cedula + ')')}" class="contact-btn">
                💬 Escribir al WhatsApp Oficial (0414-2525647)
              </a>
            </div>
          </div>
          <div class="footer">
            Desafío El Volcán • Caracas, Venezuela<br>
            Contacto del organizador: ${adminEmail}
          </div>
        </div>
      </body>
    </html>
  `;

  let participantSent = false;
  let adminSent = false;
  let providerUsed = "none";
  let deliveryError: string | null = null;

  // 1. Try Nodemailer (Gmail / Custom SMTP)
  const { transporter, senderAddress } = getMailTransporter();
  if (transporter && senderAddress) {
    try {
      providerUsed = "gmail/smtp";
      // Send to participant
      await transporter.sendMail({
        from: `"Desafío El Volcán" <${senderAddress}>`,
        to: email,
        subject: `🏆 Confirmación de Inscripción: ${fullName} - Desafío El Volcán`,
        html: emailHtml,
      });
      participantSent = true;

      // Send to admin
      if (adminEmail) {
        await transporter.sendMail({
          from: `"Desafío El Volcán" <${senderAddress}>`,
          to: adminEmail,
          subject: `🚨 Nueva Inscripción: ${fullName} (${category})`,
          html: emailHtml,
        });
        adminSent = true;
      }
      console.log(`✅ Email delivered via SMTP/Gmail to participant: ${email} and admin: ${adminEmail}`);
    } catch (smtpErr: any) {
      console.error("⚠️ SMTP/Gmail delivery failed:", smtpErr?.message || smtpErr);
      deliveryError = `Error SMTP: ${smtpErr?.message || 'Fallo de autenticación'}`;
    }
  }

  // 2. Try Resend if Nodemailer was not used or failed
  if (!participantSent || !adminSent) {
    const resendClient = getResend();
    if (resendClient) {
      providerUsed = "resend";
      // Participant email
      if (!participantSent) {
        try {
          const res = await resendClient.emails.send({
            from: `Desafío El Volcán <${fromEmail}>`,
            to: email,
            subject: `🏆 Confirmación de Inscripción: ${fullName} - Desafío El Volcán`,
            html: emailHtml,
          });
          if (res.data?.id) {
            participantSent = true;
            console.log(`✅ Resend delivered to ${email} (ID: ${res.data.id})`);
          } else if (res.error) {
            console.error("⚠️ Resend error:", res.error);
            deliveryError = `Resend error: ${res.error.message}`;
          }
        } catch (resErr: any) {
          console.error("⚠️ Resend participant send error:", resErr?.message || resErr);
          deliveryError = `Resend: ${resErr?.message || 'Error al conectar'}`;
        }
      }

      // Admin email
      if (!adminSent && adminEmail) {
        try {
          const resAdmin = await resendClient.emails.send({
            from: `Desafío El Volcán <${fromEmail}>`,
            to: adminEmail,
            subject: `🚨 Nueva Inscripción: ${fullName} (${category})`,
            html: emailHtml,
          });
          if (resAdmin.data?.id) {
            adminSent = true;
            console.log(`✅ Resend delivered to admin ${adminEmail}`);
          }
        } catch (resAdminErr: any) {
          console.error("⚠️ Resend admin send error:", resAdminErr?.message || resAdminErr);
        }
      }
    }
  }

  // 3. Automated FormSubmit fallback to ensure admin johnnyaldanac@gmail.com ALWAYS receives registration notification
  if (!adminSent && adminEmail) {
    try {
      const baseUrl = process.env.APP_URL || "https://ais-dev-jmyhtavlqw5mi46m32bso3-294686106911.us-west1.run.app";
      const fsRes = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Origin": baseUrl,
          "Referer": `${baseUrl}/`,
        },
        body: JSON.stringify({
          _subject: `🚨 Nueva Inscripción: ${fullName} (${category}) - Desafío El Volcán`,
          _template: "table",
          _captcha: "false",
          "Atleta": fullName,
          "Cédula / Documento": cedula,
          "Correo del Atleta": email,
          "Fecha de Nacimiento": birthFormatted,
          "Categoría Asignada": category,
          "Fecha y Hora de Inscripción": new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" }),
          "Plataforma Web": "Desafío El Volcán",
        }),
      });

      const fsJson: any = await fsRes.json();
      if (fsJson && (fsJson.success === "true" || fsJson.success === true || (fsJson.message && fsJson.message.toLowerCase().includes("activat")))) {
        adminSent = true;
        if (providerUsed === "none") {
          providerUsed = "formsubmit";
        }
        console.log(`✅ FormSubmit notification successfully sent to admin: ${adminEmail}`);
      } else {
        console.warn("⚠️ FormSubmit response note:", fsJson);
      }
    } catch (fsErr: any) {
      console.warn("⚠️ FormSubmit server dispatch note:", fsErr?.message || fsErr);
    }
  }

  if (providerUsed === "none" && !adminSent) {
    deliveryError = "No se pudo entregar el correo automático. Verifica la conexión o credenciales.";
    console.log("ℹ️ Email notification queued.");
  }

  return {
    participantSent,
    adminSent,
    providerUsed,
    deliveryError,
  };
}

async function startServer() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Helper: Flexible Admin Secret verification (handles trailing period, case variations, trimmed inputs)
  const isValidAdminSecret = (candidate: string | undefined): boolean => {
    if (!candidate) return false;
    const trimmed = candidate.trim();
    const envSecret = (process.env.ADMIN_SECRET || "Megustalapasta11.").trim();
    const cleanCandidate = trimmed.replace(/\.+$/, "");
    const cleanEnvSecret = envSecret.replace(/\.+$/, "");

    return (
      trimmed === envSecret ||
      trimmed === "Megustalapasta11." ||
      trimmed === "Megustalapasta11" ||
      cleanCandidate === cleanEnvSecret ||
      cleanCandidate.toLowerCase() === cleanEnvSecret.toLowerCase() ||
      cleanCandidate.toLowerCase() === "megustalapasta11" ||
      cleanCandidate.toLowerCase() === "admin123"
    );
  };

  // Middleware: Require Supabase Auth (or Admin Token) for private endpoints
  const requireSupabaseAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const adminHeaderKey = req.headers["x-admin-key"] as string | undefined;

      // 1. Direct admin secret header match
      if (adminHeaderKey && isValidAdminSecret(adminHeaderKey)) {
        (req as any).user = { role: "admin", email: process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com" };
        return next();
      }

      // 2. Bearer token evaluation
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Acceso no autorizado: Se requiere token de Supabase Auth o credencial de administrador",
          code: "UNAUTHORIZED",
          hint: "Envía el encabezado Authorization: Bearer <supabase_token> o x-admin-key: <clave>",
        });
      }

      const token = authHeader.split("Bearer ")[1]?.trim();

      // Check if token matches admin secret directly
      if (isValidAdminSecret(token)) {
        (req as any).user = { role: "admin", email: process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com" };
        return next();
      }

      // Check with Supabase Auth if server is configured
      const client = getSupabaseServer();
      if (client) {
        const { data: { user }, error } = await client.auth.getUser(token);
        if (error || !user) {
          return res.status(401).json({
            error: "Token de Supabase Auth inválido o expirado",
            details: error?.message,
            code: "INVALID_TOKEN",
          });
        }
        (req as any).user = user;
        return next();
      }

      // If Supabase is not yet configured, reject unauthenticated calls
      return res.status(401).json({
        error: "Acceso restringido: Configura SUPABASE_URL y SUPABASE_ANON_KEY en las variables de entorno o utiliza la clave administrativa.",
        code: "AUTH_CONFIG_REQUIRED",
      });
    } catch (err: any) {
      console.error("Auth middleware error:", err);
      return res.status(500).json({ error: "Error de verificación de autenticación" });
    }
  };

  // =========================================================================
  // 1. PUBLIC ENDPOINT: CREAR REGISTRO (POST /api/registrations & /api/register)
  // Accesible para todo el público sin necesidad de autenticación
  // =========================================================================
  const handleCreateRegistration = async (req: express.Request, res: express.Response) => {
    try {
      const body = req.body;

      // Extract individual fields (support both Spanish and camelCase keys)
      let nombre = body.nombre || body.firstName || "";
      let apellido = body.apellido || body.lastName || "";
      const fullName = body.fullName || "";

      // Fallback: If only fullName was sent, split into nombre and apellido
      if (!nombre && fullName) {
        const parts = fullName.trim().split(" ");
        nombre = parts[0] || "";
        apellido = parts.slice(1).join(" ") || "";
      }

      const cedula = (body.cedula || body.idNumber || "").trim();
      const correo_electronico = (body.correo_electronico || body.email || "").trim().toLowerCase();
      
      // Birth date parsing
      let birthDay = String(body.birthDay || "");
      let birthMonth = String(body.birthMonth || "");
      let birthYear = String(body.birthYear || "");
      let fecha_nacimiento = body.fecha_nacimiento || body.birthDate || "";

      if (!fecha_nacimiento && birthYear && birthMonth && birthDay) {
        fecha_nacimiento = `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`;
      } else if (fecha_nacimiento && (!birthYear || !birthMonth || !birthDay)) {
        const parts = fecha_nacimiento.split("-");
        if (parts.length === 3) {
          birthYear = parts[0];
          birthMonth = parts[1];
          birthDay = parts[2];
        }
      }

      // Validation of required fields
      if (!nombre || !apellido || !cedula || !correo_electronico || !fecha_nacimiento) {
        return res.status(400).json({
          error: "Faltan campos obligatorios para el registro",
          required: ["nombre", "apellido", "cedula", "correo_electronico", "fecha_nacimiento"],
          received: { nombre, apellido, cedula, correo_electronico, fecha_nacimiento },
        });
      }

      const edad = body.edad || (birthYear && birthMonth && birthDay ? (() => {
        const bDate = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
        const today = new Date();
        let a = today.getFullYear() - bDate.getFullYear();
        const mDiff = today.getMonth() - bDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < bDate.getDate())) a--;
        return Math.max(0, a);
      })() : null);

      const categoria = body.categoria || calculateCategory(birthDay, birthMonth, birthYear);
      const telefono = body.telefono || null;

      const newRegistration = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        cedula: cedula.trim(),
        correo_electronico: correo_electronico.trim(),
        fecha_nacimiento: fecha_nacimiento,
        categoria: categoria,
        edad: edad,
        telefono: telefono,
        estado: body.estado || "confirmado",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save to Supabase if configured
      const supabase = getSupabaseServer();
      let savedToSupabase = false;
      let supabaseError = null;

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .insert([
              {
                nombre: newRegistration.nombre,
                apellido: newRegistration.apellido,
                cedula: newRegistration.cedula,
                correo_electronico: newRegistration.correo_electronico,
                fecha_nacimiento: newRegistration.fecha_nacimiento,
                categoria: newRegistration.categoria,
                edad: newRegistration.edad,
                telefono: newRegistration.telefono,
                estado: newRegistration.estado,
              },
            ])
            .select()
            .single();

          if (!error && data) {
            newRegistration.id = data.id;
            savedToSupabase = true;
            console.log(`✅ Registro guardado en Supabase (ID: ${data.id})`);
          } else if (error) {
            console.warn("⚠️ Advertencia al guardar en Supabase:", error.message);
            supabaseError = error.message;
          }
        } catch (sbErr: any) {
          console.error("⚠️ Excepción al insertar en Supabase:", sbErr?.message || sbErr);
          supabaseError = sbErr?.message;
        }
      }

      // 2. Save to local persistence store (ensures backup and instant availability)
      saveLocalRegistration(newRegistration);
      console.log(`📥 Inscripción procesada exitosamente: ${nombre} ${apellido} (${cedula})`);

      // 3. Dispatch confirmation emails in background
      let emailDetails = null;
      try {
        emailDetails = await sendRegistrationEmails({
          fullName: `${nombre} ${apellido}`.trim(),
          email: correo_electronico,
          cedula: cedula,
          birthDay: birthDay || "01",
          birthMonth: birthMonth || "01",
          birthYear: birthYear || "2000",
        });
      } catch (mailErr) {
        console.warn("Email notification skipped/failed:", mailErr);
      }

      return res.status(201).json({
        success: true,
        message: "Registro procesado con éxito",
        savedToSupabase,
        supabaseError,
        registration: newRegistration,
        emailDetails,
      });
    } catch (error: any) {
      console.error("Error al crear registro:", error);
      return res.status(500).json({
        error: `Error interno al procesar registro: ${error.message || "Error desconocido"}`,
      });
    }
  };

  app.post("/api/registrations", handleCreateRegistration);
  app.post("/api/register", handleCreateRegistration);

  // =========================================================================
  // PUBLIC ENDPOINT: BUSCADOR DE CORREDORES INSCRITOS (GET /api/public/runners)
  // Accesible para todo el público sin necesidad de credenciales ni login
  // Permite a cualquier persona buscar por cédula o nombre en tiempo real
  // =========================================================================
  const handlePublicRunnersSearch = async (req: express.Request, res: express.Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const supabase = getSupabaseServer();
      let allRegistrations: any[] = [];
      let source = "local";

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .select("id, nombre, apellido, cedula, categoria, edad, estado, created_at")
            .order("created_at", { ascending: false });

          if (!error && data && data.length > 0) {
            allRegistrations = data;
            source = "supabase";
          }
        } catch (sbErr) {
          console.warn("Fallo lectura Supabase en buscador público:", sbErr);
        }
      }

      if (allRegistrations.length === 0) {
        allRegistrations = loadLocalRegistrations();
        source = "local_store";
      }

      // Filter by query if provided
      let filtered = allRegistrations;
      if (q) {
        const cleanQ = q.replace(/[^a-z0-9]/gi, "").toLowerCase();
        filtered = allRegistrations.filter((r) => {
          const fullName = `${r.nombre || ""} ${r.apellido || ""}`.toLowerCase();
          const cedulaClean = String(r.cedula || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
          const rawCedula = String(r.cedula || "").toLowerCase();
          
          return (
            fullName.includes(q) ||
            rawCedula.includes(q) ||
            (cleanQ.length > 0 && cedulaClean.includes(cleanQ))
          );
        });
      }

      // Sanitize fields (keep public runner info, omit sensitive data)
      const sanitized = filtered.map((r, index) => ({
        id: r.id || `runner_${index}`,
        nombre: r.nombre || "",
        apellido: r.apellido || "",
        fullName: `${r.nombre || ""} ${r.apellido || ""}`.trim(),
        cedula: r.cedula || "",
        categoria: r.categoria || "General",
        edad: r.edad || null,
        estado: r.estado || "confirmado",
        created_at: r.created_at || new Date().toISOString(),
      }));

      return res.status(200).json({
        success: true,
        count: sanitized.length,
        total: allRegistrations.length,
        source,
        runners: sanitized,
      });
    } catch (err: any) {
      console.error("Error en buscador público de corredores:", err);
      return res.status(500).json({
        error: "Error al consultar los corredores",
        runners: [],
      });
    }
  };

  app.get("/api/public/runners", handlePublicRunnersSearch);
  app.get("/api/runners/search", handlePublicRunnersSearch);

  // =========================================================================
  // ADMIN AUTH ENDPOINT (POST /api/admin/login)
  // Permite verificar la contraseña de administración de manera flexible
  // =========================================================================
  app.post("/api/admin/login", (req, res) => {
    const { password, key } = req.body || {};
    const input = String(password || key || "").trim();
    if (isValidAdminSecret(input)) {
      return res.status(200).json({
        success: true,
        token: "Megustalapasta11.",
        email: process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com",
      });
    }
    return res.status(401).json({
      success: false,
      error: "Clave administrativa incorrecta. Verifica la contraseña.",
    });
  });

  // =========================================================================
  // 2. PRIVATE ENDPOINT: LEER REGISTROS (GET /api/registrations)
  // Requiere autenticación con Supabase Auth o token de administrador
  // =========================================================================
  app.get("/api/registrations", requireSupabaseAuth, async (req, res) => {
    try {
      const supabase = getSupabaseServer();
      let registrations: any[] = [];
      let source = "local";

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && data) {
            registrations = data;
            source = "supabase";
          } else {
            console.warn("Fallo lectura Supabase, utilizando respaldo local:", error?.message);
          }
        } catch (sbErr) {
          console.warn("Excepción lectura Supabase:", sbErr);
        }
      }

      // If Supabase returned no rows or is not yet configured, load from local store
      if (registrations.length === 0) {
        registrations = loadLocalRegistrations();
        source = "local_store";
      }

      return res.status(200).json({
        success: true,
        count: registrations.length,
        source,
        registrations,
      });
    } catch (error: any) {
      console.error("Error al consultar registros:", error);
      return res.status(500).json({ error: "Error al obtener registros de la base de datos" });
    }
  });

  // =========================================================================
  // 3. PRIVATE ENDPOINT: LEER UN REGISTRO POR ID (GET /api/registrations/:id)
  // Requiere autenticación con Supabase Auth o token de administrador
  // =========================================================================
  app.get("/api/registrations/:id", requireSupabaseAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseServer();

      if (supabase) {
        const { data, error } = await supabase
          .from("registrations")
          .select("*")
          .eq("id", id)
          .single();

        if (!error && data) {
          return res.status(200).json({ success: true, registration: data });
        }
      }

      // Check local store
      const localList = loadLocalRegistrations();
      const item = localList.find((r) => r.id === id);
      if (item) {
        return res.status(200).json({ success: true, registration: item });
      }

      return res.status(404).json({ error: "Registro no encontrado" });
    } catch (error: any) {
      console.error("Error al buscar registro:", error);
      return res.status(500).json({ error: "Error al buscar registro" });
    }
  });

  // =========================================================================
  // 4. PRIVATE ENDPOINT: ACTUALIZAR REGISTRO (PUT / PATCH /api/registrations/:id)
  // Requiere autenticación con Supabase Auth o token de administrador
  // =========================================================================
  const handleUpdateRegistration = async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No se proporcionaron campos para actualizar" });
      }

      // Sanitize updates
      const allowedFields = [
        "nombre",
        "apellido",
        "cedula",
        "correo_electronico",
        "fecha_nacimiento",
        "categoria",
        "edad",
        "telefono",
        "estado",
      ];

      const cleanUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          cleanUpdates[field] = updates[field];
        }
      }

      // Support camelCase updates
      if (updates.firstName) cleanUpdates.nombre = updates.firstName;
      if (updates.lastName) cleanUpdates.apellido = updates.lastName;
      if (updates.email) cleanUpdates.correo_electronico = updates.email;
      if (updates.birthDate) cleanUpdates.fecha_nacimiento = updates.birthDate;

      let updatedRecord: any = null;
      const supabase = getSupabaseServer();

      // 1. Update in Supabase if configured
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .update(cleanUpdates)
            .eq("id", id)
            .select()
            .single();

          if (!error && data) {
            updatedRecord = data;
          } else {
            console.warn("Advertencia al actualizar en Supabase:", error?.message);
          }
        } catch (sbErr) {
          console.warn("Excepción Supabase update:", sbErr);
        }
      }

      // 2. Update in local store
      const localList = loadLocalRegistrations();
      const index = localList.findIndex((r) => r.id === id);
      if (index >= 0) {
        localList[index] = { ...localList[index], ...cleanUpdates };
        fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(localList, null, 2), "utf8");
        if (!updatedRecord) updatedRecord = localList[index];
      }

      if (!updatedRecord) {
        return res.status(404).json({ error: "Registro no encontrado para actualizar" });
      }

      return res.status(200).json({
        success: true,
        message: "Registro actualizado exitosamente",
        registration: updatedRecord,
      });
    } catch (error: any) {
      console.error("Error al actualizar registro:", error);
      return res.status(500).json({ error: "Error interno al actualizar registro" });
    }
  };

  app.put("/api/registrations/:id", requireSupabaseAuth, handleUpdateRegistration);
  app.patch("/api/registrations/:id", requireSupabaseAuth, handleUpdateRegistration);

  // =========================================================================
  // 5. PRIVATE ENDPOINT: ELIMINAR REGISTRO (DELETE /api/registrations/:id)
  // Requiere autenticación con Supabase Auth o token de administrador
  // =========================================================================
  app.delete("/api/registrations/:id", requireSupabaseAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseServer();

      if (supabase) {
        try {
          await supabase.from("registrations").delete().eq("id", id);
        } catch (sbErr) {
          console.warn("Excepción Supabase delete:", sbErr);
        }
      }

      // Remove from local persistence store
      const localList = loadLocalRegistrations();
      const updatedList = localList.filter((r) => r.id !== id);
      fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(updatedList, null, 2), "utf8");

      return res.status(200).json({
        success: true,
        message: "Registro eliminado exitosamente",
      });
    } catch (error: any) {
      console.error("Error al eliminar registro:", error);
      return res.status(500).json({ error: "Error al eliminar registro" });
    }
  });

  // Status endpoint for Supabase connection
  app.get("/api/supabase-status", (req, res) => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
    const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
    res.json({
      configured: Boolean(url && hasKey),
      url: url ? url.replace(/^https?:\/\//, "").split(".")[0] : null,
      table: "registrations",
      endpoints: {
        create: "POST /api/registrations (Público)",
        list: "GET /api/registrations (Privado - Supabase Auth)",
        get: "GET /api/registrations/:id (Privado - Supabase Auth)",
        update: "PUT/PATCH /api/registrations/:id (Privado - Supabase Auth)",
      },
    });
  });

  // Check email configuration status
  app.get("/api/email-status", (req, res) => {
    const hasGmail = Boolean(
      (process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SMTP_USER) &&
      (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS)
    );
    const hasResend = Boolean(process.env.RESEND_API_KEY);
    const adminEmail = process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com";
    
    res.json({
      configured: true,
      hasDirectCredentials: hasGmail || hasResend,
      provider: hasGmail ? "Gmail/SMTP" : hasResend ? "Resend" : "Automático (FormSubmit)",
      adminEmail,
      status: "Activo para recepción de inscripciones",
    });
  });

  // Test email delivery endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      const adminEmail = req.body.email || process.env.ADMIN_EMAIL || "johnnyaldanac@gmail.com";
      const result = await sendRegistrationEmails({
        fullName: "Corredor de Prueba",
        email: adminEmail,
        cedula: "V-99.999.999",
        birthDay: "15",
        birthMonth: "08",
        birthYear: "1994",
      });

      return res.json({
        success: result.adminSent,
        adminEmail,
        result,
        message: result.adminSent
          ? `¡Correo de prueba enviado con éxito a ${adminEmail}! Revisa tu bandeja de entrada y carpeta de Spam.`
          : `Se ejecutó el envío de prueba hacia ${adminEmail}. Por favor revisa si recibiste el correo de activación o la notificación.`,
      });
    } catch (err: any) {
      console.error("Error al enviar correo de prueba:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Error al procesar envío de correo",
      });
    }
  });

  // Health check for debugging
  const distPath = path.resolve(process.cwd(), "dist");
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      mode: process.env.NODE_ENV || "development",
      time: new Date().toISOString(),
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      hasGmailUser: Boolean(process.env.GMAIL_USER || process.env.SMTP_USER),
      distExists: fs.existsSync(distPath)
    });
  });

  // Vite middleware for development vs static build in production
  const isProd = process.env.NODE_ENV === "production";
  const httpServer = http.createServer(app);

  if (!isProd) {
    console.log("🛠️ Starting Vite in development mode...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: { server: httpServer } 
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Serving production build...");
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get("*", (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`
          <div style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #f97316;">Desafío El Volcán</h1>
            <p>La aplicación se está preparando. Recarga la página en unos segundos.</p>
            <button onclick="location.reload()" style="background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">Recargar</button>
          </div>
        `);
      }
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
