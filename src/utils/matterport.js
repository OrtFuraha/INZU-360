/**
 * INZU360 — Matterport Utility
 * Server-side Matterport Model ID detection. No React.
 */

const MATTERPORT_DOMAINS = ['my.matterport.com', 'matterport.com', 'www.matterport.com'];

function detectMatterport(input) {
    if (!input || typeof input !== 'string') {
        return { ok: false, error: 'No input provided.' };
    }
    const raw = input.trim();

    if (/^[A-Za-z0-9]{6,24}$/.test(raw)) {
        return {
            ok: true,
            modelId: raw,
            canonicalUrl: 'https://my.matterport.com/show/?m=' + raw,
            source: 'bare'
        };
    }

    let candidate = raw;
    const iframeMatch = raw.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
    if (iframeMatch) candidate = iframeMatch[1];

    let url;
    try {
        url = new URL(candidate, 'https://my.matterport.com');
    } catch (e) {
        return { ok: false, error: 'Unable to detect a valid Matterport tour.' };
    }

    const host = url.hostname.toLowerCase();
    const allowed = MATTERPORT_DOMAINS.some(function (d) {
        return host === d || host.endsWith('.' + d);
    });
    if (!allowed) {
        return { ok: false, error: 'Only official Matterport links are accepted.' };
    }

    let modelId = url.searchParams.get('m');
    if (!modelId) {
        const m = url.pathname.match(/\/(?:show|model)\/([A-Za-z0-9]{6,24})/);
        if (m) modelId = m[1];
    }
    if (!modelId || !/^[A-Za-z0-9]{6,24}$/.test(modelId)) {
        return {
            ok: false,
            error: 'Unable to detect a valid Matterport tour. Please paste a Matterport sharing link or embed code.'
        };
    }

    return {
        ok: true,
        modelId: modelId,
        canonicalUrl: 'https://my.matterport.com/show/?m=' + modelId,
        source: 'url'
    };
}

function buildEmbedUrl(modelId) {
    if (!modelId) return null;
    return 'https://my.matterport.com/show/?m=' + encodeURIComponent(modelId);
}

module.exports = {
    detectMatterport: detectMatterport,
    buildEmbedUrl: buildEmbedUrl,
    MATTERPORT_DOMAINS: MATTERPORT_DOMAINS
};
