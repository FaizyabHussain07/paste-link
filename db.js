/**
 * db.js — Database Service (Production Ready)
 * Communicates with Serverless Functions (/api) to keep tokens secure.
 */

export const database = {
    async savePaste(data) {
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
        const response = await fetch(`/api/get?id=${customId}`);
        if (response.status === 404) return null;
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to retrieve');
        }
        return response.json();
    },

    async deletePaste(customId) {
        await fetch(`/api/delete?id=${customId}`, {
            method: 'POST'
        });
    }
};
