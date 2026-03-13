/**
 * db.js — Database Service (Hybrid for Local & Production)
 * 
 * Works on Localhost (direct Upstash) and Vercel Production (secure /api).
 */

// Local Testing Config (Used only when hostname is localhost or 127.0.0.1)
// On Vercel, the app will use environment variables via the /api folder for security.
const LOCAL_CONFIG = {
    url: 'https://prompt-bunny-70192.upstash.io',
    token: 'gQAAAAAAARIwAAIncDEyYjJhNTIxNmZlMGM0YTdkYTdkNzVhZDcwNGRkODAyMHAxNzAxOTI'
};

const isLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

export const database = {
    async savePaste(data) {
        if (isLocal) {
            console.log('Running in Local Mode (Direct Upstash)');
            const pasteData = {
                ...data,
                expiresAt: Date.now() + (data.expirySeconds * 1000)
            };
            const response = await fetch(`${LOCAL_CONFIG.url}/set/${data.customId}?ex=${data.expirySeconds}`, {
                headers: { Authorization: `Bearer ${LOCAL_CONFIG.token}` },
                method: 'POST',
                body: JSON.stringify(pasteData)
            });
            return response.json();
        }

        // Production (Vercel) Mode
        const response = await fetch('/api/save', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save');
        }
        return response.json();
    },

    async getPaste(customId) {
        if (isLocal) {
            const response = await fetch(`${LOCAL_CONFIG.url}/get/${customId}`, {
                headers: { Authorization: `Bearer ${LOCAL_CONFIG.token}` }
            });
            const result = await response.json();
            if (!result.result) return null;
            const data = JSON.parse(result.result);
            if (data.expiresAt && data.expiresAt < Date.now()) return null;
            return { data };
        }

        // Production Mode
        const response = await fetch(`/api/get?id=${customId}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to retrieve');
        }
        return response.json();
    },

    async deletePaste(customId) {
        if (isLocal) {
            await fetch(`${LOCAL_CONFIG.url}/del/${customId}`, {
                headers: { Authorization: `Bearer ${LOCAL_CONFIG.token}` },
                method: 'POST'
            });
            return;
        }

        // Production Mode
        await fetch(`/api/delete?id=${customId}`, {
            method: 'POST'
        });
    }
};
