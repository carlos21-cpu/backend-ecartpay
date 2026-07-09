import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ ok: true, message: "Backend Ecart Pay (producción) funcionando" });
});

/**
 * Construye el header de autenticación para Ecart Pay (producción).
 * Usa API key de producción en ECART_API_KEY y esquema Bearer.
 */
function getEcartAuthHeader() {
    const apiKey = process.env.ECART_API_KEY;

    if (!apiKey) {
        console.error("Falta ECART_API_KEY en variables de entorno (producción)");
        return null;
    }

    return `Bearer ${apiKey}`;
}

app.post("/api/clip/create-checkout", async(req, res) => {
    try {
        const { amount, placa, folio, estado, description } = req.body;

        // Validación básica de entrada
        const amountNumber = Number(amount);
        if (!Number.isFinite(amountNumber) || amountNumber <= 0 || !placa || !folio) {
            return res.status(400).json({
                success: false,
                error: "Datos incompletos o monto inválido para crear la orden.",
            });
        }

        // URL base de producción de Ecart Pay
        const ecartBaseUrl = process.env.ECART_BASE_URL || "https://ecartpay.com";
        const authHeader = getEcartAuthHeader();

        if (!ecartBaseUrl || !authHeader) {
            console.error("Falta ECART_BASE_URL o token de autenticación de Ecart Pay");
            return res.status(500).json({
                success: false,
                error: "Configuración incompleta de Ecart Pay.",
            });
        }

        // IMPORTANTE: sustituye estas URLs por las reales de tu backend/frontend
        const notifyUrl =
            process.env.ECART_NOTIFY_URL ||
            "https://backend-ecartpay.onrender.com/api/ecart/webhook";

        const successUrl = `https://guiatenenciamx.mx/pago-exitoso?placa=${encodeURIComponent(
      placa
    )}&folio=${encodeURIComponent(folio)}`;

        const errorUrl = `https://guiatenenciamx.mx/pago-error?placa=${encodeURIComponent(
      placa
    )}&folio=${encodeURIComponent(folio)}`;

        // Orden para Ecart Pay (producción) — incluye customer.email que pide la API
        const body = {
            currency: "MXN",
            customer: {
                name: "Cliente Control Vehicular",
                email: "cliente@guiatenenciamx.mx", // usa un email válido para tu negocio
            },
            items: [{
                name: description ||
                    `Pago control vehicular ${placa} - folio ${folio}`,
                quantity: 1,
                price: amountNumber,
            }, ],
            notify_url: notifyUrl,
            redirect_url: {
                success: successUrl,
                error: errorUrl,
            },
            metadata: {
                placa,
                folio,
                estado,
            },
        };

        console.log("Body enviado a Ecart:", JSON.stringify(body));

        const ecartRes = await fetch(`${ecartBaseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                accept: "application/json",
            },
            body: JSON.stringify(body),
        });

        console.log("Respuesta Ecart (prod) status:", ecartRes.status);

        let ecartData;
        try {
            ecartData = await ecartRes.json();
        } catch (e) {
            console.error("No se pudo parsear JSON de Ecart:", e);
            ecartData = null;
        }

        console.log("Respuesta Ecart (prod) JSON:", ecartData);

        if (!ecartRes.ok) {
            const errorMsg =
                (ecartData && ecartData.error) || JSON.stringify(ecartData);
            console.error("Error Ecart (prod):", ecartRes.status, errorMsg);
            return res.status(502).json({
                success: false,
                error:
                    (ecartData && ecartData.error) ||
                    "Error al comunicarse con Ecart Pay en producción.",
            });
        }

        const checkoutUrl = ecartData && ecartData.pay_link;

        if (!checkoutUrl) {
            console.error("Ecart Pay (prod) no devolvió pay_link");
            return res.status(500).json({
                success: false,
                error: "Ecart Pay no devolvió un enlace de pago.",
            });
        }

        return res.json({
            success: true,
            checkout_url: checkoutUrl,
        });
    } catch (err) {
        console.error("Error create-checkout (prod):", err);
        return res.status(500).json({
            success: false,
            error: "Error interno al crear el enlace de pago.",
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor producción escuchando en http://localhost:${PORT}`);
});