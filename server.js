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
 * Usa ECART_API_KEY tal como te lo da Ecart, igual que en tu curl:
 *   Authorization: <token>
 */
function getEcartAuthHeader() {
    const apiKey = process.env.ECART_API_KEY;

    if (!apiKey) {
        console.error("Falta ECART_API_KEY en variables de entorno (producción)");
        return null;
    }

    // Igual que tu ejemplo curl: Authorization: <token>
    return apiKey;
}

app.post("/api/clip/create-checkout", async(req, res) => {
    try {
        const { amount, placa, folio, estado, description } = req.body;

        const amountNumber = Number(amount);
        if (!Number.isFinite(amountNumber) || amountNumber <= 0 || !placa || !folio) {
            return res.status(400).json({
                success: false,
                error: "Datos incompletos o monto inválido para crear la orden.",
            });
        }

        // Usa sandbox o producción según tu entorno
        const ecartBaseUrl = process.env.ECART_BASE_URL || "https://ecartpay.com";
        const authHeader = getEcartAuthHeader();

        if (!ecartBaseUrl || !authHeader) {
            console.error("Falta ECART_BASE_URL o token de autenticación de Ecart Pay");
            return res.status(500).json({
                success: false,
                error: "Configuración incompleta de Ecart Pay.",
            });
        }

        const notifyUrl =
            process.env.ECART_NOTIFY_URL ||
            "https://backend-ecartpay.onrender.com/api/ecart/webhook";

        const redirectUrl = `https://guiatenenciamx.mx/pago-exitoso?placa=${encodeURIComponent(
      placa
    )}&folio=${encodeURIComponent(folio)}`;

        // Datos de cliente al nivel raíz, siguiendo el ejemplo de Ecart
        const clientEmail = "cliente@guiatenenciamx.mx";
        const clientFirstName = "Cliente";
        const clientLastName = "Control Vehicular";
        const clientPhone = "5555555555"; // pon un número válido según tu caso

        // Orden para Ecart Pay (producción), alineada al ejemplo curl
        const body = {
            currency: "MXN",

            // Datos del cliente al nivel raíz
            email: clientEmail,
            first_name: clientFirstName,
            last_name: clientLastName,
            phone: clientPhone,

            items: [{
                name: description ||
                    `Pago control vehicular ${placa} - folio ${folio}`,
                price: amountNumber,
                quantity: 1,
            }, ],

            notify_url: notifyUrl,

            // redirect_url DEBE SER UN STRING según el error de la API
            redirect_url: redirectUrl,

            // Datos adicionales de referencia
            metafields: {
                placa,
                folio,
                estado,
            },

            reference_id: folio,
            reference: `control_vehicular_${placa}_${folio}`,
        };

        console.log("Body enviado a Ecart:", JSON.stringify(body));

        const ecartRes = await fetch(`${ecartBaseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: authHeader, // aquí va el token directo
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