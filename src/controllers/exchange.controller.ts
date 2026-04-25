import { Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';

interface CacheEntry {
    fetchedAt: number;
    data: any;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

async function fetchRates(): Promise<any> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.data;
    }
    const { data } = await axios.get(env.EXCHANGE_RATE_API_URL, { timeout: 8000 });
    cache = { fetchedAt: Date.now(), data };
    return data;
}

/**
 * GET /api/exchange/rates
 * Devuelve el listado actual de tipos de cambio (base USD).
 */
export const getRates = async (_req: Request, res: Response): Promise<void> => {
    try {
        const data = await fetchRates();
        res.status(200).json({
            base: data.base_code ?? 'USD',
            updatedAt: data.time_last_update_utc,
            rates: data.rates,
        });
    } catch (error) {
        console.error(error);
        res.status(502).json({ message: 'No se pudo obtener el tipo de cambio externo' });
    }
};

/**
 * GET /api/exchange/convert?amount=100&to=MXN&from=USD
 * Convierte un monto entre divisas. Util para mostrar el valor de los
 * creditos del casino en moneda local.
 */
export const convert = async (req: Request, res: Response): Promise<void> => {
    try {
        const amount = Number(req.query.amount);
        const to = String(req.query.to ?? '').toUpperCase();
        const from = String(req.query.from ?? 'USD').toUpperCase();

        if (!Number.isFinite(amount) || amount < 0 || !to) {
            res.status(400).json({
                message: 'Parametros invalidos: amount (numero) y to (codigo ISO) requeridos',
            });
            return;
        }

        const data = await fetchRates();
        const rates = data.rates as Record<string, number>;

        if (!rates[from] || !rates[to]) {
            res.status(400).json({ message: 'Codigo de moneda no soportado' });
            return;
        }

        // open.er-api.com tiene base USD; convertimos via USD.
        const amountInUsd = amount / rates[from];
        const converted = amountInUsd * rates[to];

        res.status(200).json({
            from,
            to,
            amount,
            converted: Number(converted.toFixed(4)),
            rate: rates[to] / rates[from],
            updatedAt: data.time_last_update_utc,
        });
    } catch (error) {
        console.error(error);
        res.status(502).json({ message: 'No se pudo realizar la conversion' });
    }
};
