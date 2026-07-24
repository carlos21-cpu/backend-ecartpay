import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MercadoPagoConfig, Preference } from "mercadopago";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Configuración Mercado Pago (usa tu Access Token real)
const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || "",
});

// Ping simple
app.get("/", (_req, res) => {
    res.json({ ok: true, message: "Backend Mercado Pago funcionando" });
});

/**
 * Endpoint que reemplaza a /api/clip/create-checkout
 * Crea una preferencia en Mercado Pago y devuelve el init_point para redirigir al checkout.
 * El frontend ya está mandando: amount, placa, folio, estado, description, customerEmail, etc.
 */
app.post("/api/mp/create-preference", async(req, res) => {
    try {
        const {
            amount,
            placa,
            folio,
            estado,
            description,
            customerEmail,
            customerPhone,
            customerFirstName,
            customerLastName,
        } = req.body;

        const amountNumber = Number(amount);

        if (!Number.isFinite(amountNumber) ||
            amountNumber <= 0 ||
            !placa ||
            !folio
        ) {
            return res.status(400).json({
                success: false,
                error: "Datos incompletos o monto inválido para crear la preferencia.",
            });
        }

        if (!process.env.MP_ACCESS_TOKEN) {
            console.error("Falta MP_ACCESS_TOKEN en variables de entorno");
            return res.status(500).json({
                success: false,
                error: "Configuración incompleta de Mercado Pago.",
            });
        }

        // URLs de retorno (puedes ponerlas en env o dejarlas así al inicio)
        const successUrl =
            process.env.MP_BACK_URL_SUCCESS ||
            `https://guiatenenciamx.mx/pago-exitoso?placa=${encodeURIComponent(
        placa,
      )}&folio=${encodeURIComponent(folio)}`;
        const failureUrl =
            process.env.MP_BACK_URL_FAILURE ||
            "https://guiatenenciamx.mx/pago-fallido";
        const pendingUrl =
            process.env.MP_BACK_URL_PENDING ||
            "https://guiatenenciamx.mx/pago-pendiente";

        const email = customerEmail || "cliente@guiatenenciamx.mx";
        const firstName = customerFirstName || "Cliente";
        const lastName = customerLastName || "Control Vehicular";
        const phoneNumber = customerPhone || "5555555555";

        const preference = new Preference(mpClient);

        const body = {
            items: [{
                title: description ||
                    `Pago control vehicular ${placa} - folio ${folio}`,
                quantity: 1,
                unit_price: amountNumber,
                currency_id: "MXN",
            }, ],
            payer: {
                name: firstName,
                surname: lastName,
                email,
                phone: {
                    area_code: "",
                    number: phoneNumber,
                },
            },
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl,
            },
            auto_return: "approved",
            external_reference: folio,
            metadata: {
                placa,
                folio,
                estado,
            },
        };

        console.log("Body enviado a Mercado Pago:", JSON.stringify(body));

        const result = await preference.create({ body });

        console.log(
            "Preferencia MP creada:",
            result.id,
            result.init_point,
            result.sandbox_init_point,
        );

        const initPoint = result.init_point || result.sandbox_init_point;

        if (!initPoint) {
            console.error("Mercado Pago no devolvió init_point");
            return res.status(500).json({
                success: false,
                error: "Mercado Pago no devolvió un enlace de pago.",
            });
        }

        // Devolvemos el link al frontend
        return res.json({
            success: true,
            init_point: initPoint,
            preferenceId: result.id,
        });
    } catch (err) {
        console.error("Error MP create-preference:", err);
        return res.status(500).json({
            success: false,
            error: "Error interno al crear la preferencia de pago.",
        });
    }
});

app.listen(PORT, () => {
    console.log(
        `Servidor Mercado Pago escuchando en http://localhost:${PORT}`,
    );
});