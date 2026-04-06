"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIGDBAccessToken = getIGDBAccessToken;
exports.searchGames = searchGames;
exports.getGameDetails = getGameDetails;
exports.getIGDBCoverUrl = getIGDBCoverUrl;
const IGDB_BASE_URL = 'https://api.igdb.com/v4';
async function getIGDBAccessToken() {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: process.env.IGDB_CLIENT_ID,
            client_secret: process.env.IGDB_CLIENT_SECRET,
            grant_type: 'client_credentials',
        }),
    });
    if (!response.ok) {
        throw new Error('Failed to get IGDB access token');
    }
    const data = await response.json();
    return data.access_token;
}
async function searchGames(query, accessToken) {
    let body;
    if (query.trim()) {
        // Search for specific games
        body = `search "${query}"; fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, platforms.name, storyline; limit 50;`;
    }
    else {
        // Get popular games when no search query
        body = `fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, platforms.name, storyline; sort rating desc; where rating > 80 & cover != null; limit 20;`;
    }
    const response = await fetch(`${IGDB_BASE_URL}/games`, {
        method: 'POST',
        headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body,
        next: { revalidate: 3600 },
    });
    if (!response.ok) {
        throw new Error('Failed to search games');
    }
    return response.json();
}
async function getGameDetails(id, accessToken) {
    const response = await fetch(`${IGDB_BASE_URL}/games`, {
        method: 'POST',
        headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: `where id = ${id}; fields id, name, summary, cover.url, first_release_date, rating, genres.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, platforms.name, storyline;`,
        next: { revalidate: 3600 },
    });
    if (!response.ok) {
        throw new Error('Failed to get game details');
    }
    const games = await response.json();
    return games[0];
}
function getIGDBCoverUrl(url, size = 'cover_big') {
    if (!url)
        return null;
    const fullUrl = url.startsWith('//') ? `https:${url}` : url;
    return fullUrl.replace('thumb', size);
}
