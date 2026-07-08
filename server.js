import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// Usamos fetch global de Node, no node-fetch

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ ok: true, message: "Backend Ecart Pay (producción) funcionando" });
});

/**
 * Header de autenticación para Ecart Pay en PRODUCCIÓN.
 * Usa tu API key de producción y el esquema que indique su doc (normalmente Bearer).
 */
function getEcartAuthHeader() {
    const apiKey = process.env.ECART_API_KEY; // API key de PRODUCCIÓN

    if (!apiKey) {
        console.error("Falta ECART_API_KEY en variables de entorno (producción)");
        return null;
    }

    // Ajusta si Ecart Pay usa otro esquema; lo usual es Bearer.
    return `Bearer ${apiKey}`;
}

// Mantengo la misma ruta para que el frontend no cambie:
app.post("/api/clip/create-checkout", async(req, res) => {
    try {
        const { amount, placa, folio, estado, description } = req.body;

        if (!amount || !placa || !folio) {
            return res.status(400).json({
                success: false,
                error: "Datos incompletos para crear la orden.",
            });
        }

        // URL base de PRODUCCIÓN de Ecart Pay
        const ecartBaseUrl =
            process.env.ECART_BASE_URL || "https://ecartpay.com";

        const authHeader = getEcartAuthHeader();

        if (!ecartBaseUrl || !authHeader) {
            console.error("Falta ECART_BASE_URL o token de autenticación de Ecart Pay");
            return res.status(500).json({
                success: false,
                error: "Configuración incompleta de Ecart Pay.",
            });
        }

        // Orden para Ecart Pay (producción).
        const body = {
            currency: "MXN",
            customer: {
                name: "Cliente Control Vehicular",
                // Agrega aquí email/phone si los tienes.
            },
            items: [{
                name: description ||
                    `Pago control vehicular ${placa} - folio ${folio}`,
                quantity: 1,
                price: Number(amount),
            }, ],
            // URL donde Ecart Pay enviará notificaciones de pago
            notify_url: process.env.ECART_NOTIFY_URL ||
                "https://TU_BACKEND_URL/api/ecart/webhook",
            // URLs de redirección para el cliente
            redirect_url: {
                success: `https://tu-dominio.com/pago-exitoso?placa=${placa}&folio=${folio}`,
                error: `https://tu-dominio.com/pago-error?placa=${placa}&folio=${folio}`,
            },
            metadata: {
                placa,
                folio,
                estado,
            },
        };

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

        const ecartData = await ecartRes.json();
        console.log("Respuesta Ecart (prod) JSON:", ecartData);

        if (!ecartRes.ok) {
            const errorMsg = ecartData ? .error || JSON.stringify(ecartData);
            console.error("Error Ecart (prod):", ecartRes.status, errorMsg);
            return res.status(502).json({
                success: false,
                error: ecartData ? .error ||
                    "Error al comunicarse con Ecart Pay en producción.",
            });
        }

        // En producción, el link de pago sigue siendo el pay_link de la orden. [web:96]
        const checkoutUrl = ecartData.pay_link;

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