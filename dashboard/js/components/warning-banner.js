/**
 * Warning Banner Component
 * Persistent warnings for configuration issues
 */

import { createElement } from '../utils.js';

const WARNING_MESSAGES = {
    x_api: {
        message: 'X API connection failed. Monitoring is paused.',
        severity: 'error',
        link: '#/settings',
        linkText: 'Fix in Settings'
    },
    xai_api: {
        message: 'xAI API connection failed. Reply generation unavailable.',
        severity: 'error',
        link: '#/settings',
        linkText: 'Fix in Settings'
    },
    no_keywords: {
        message: 'No keywords configured. Add keywords to start monitoring.',
        severity: 'warning',
        link: '#/keywords',
        linkText: 'Add Keywords'
    },
    no_product_profile: {
        message: 'No product profile configured. Add one to generate replies.',
        severity: 'warning',
        link: '#/profiles',
        linkText: 'Add Profile'
    }
};

let currentWarnings = [];

/**
 * Update the warning banner based on config status
 * @param {object} configStatus - { missing: [], warnings: [] }
 */
export function updateWarningBanner(configStatus) {
    // Combine missing (errors) and warnings
    currentWarnings = [
        ...(configStatus.missing || []),
        ...(configStatus.warnings || [])
    ];

    renderWarningBanner();
}

/**
 * Render the warning banner
 */
function renderWarningBanner() {
    // Get or create banner container
    let container = document.getElementById('warning-banner-container');
    if (!container) {
        // Create container and insert after nav
        container = createElement('div', '', '');
        container.id = 'warning-banner-container';
        const mainContent = document.getElementById('app');
        if (mainContent && mainContent.parentNode) {
            mainContent.parentNode.insertBefore(container, mainContent);
        }
    }

    // Clear existing banners
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // If no warnings, hide container
    if (currentWarnings.length === 0) {
        container.className = 'hidden';
        return;
    }

    container.className = 'flex flex-col';

    // Show up to 2 warnings, with "+N more" if there are more
    const visibleWarnings = currentWarnings.slice(0, 2);
    const remainingCount = currentWarnings.length - 2;

    visibleWarnings.forEach(warningKey => {
        const warningConfig = WARNING_MESSAGES[warningKey];
        if (!warningConfig) return;

        const banner = createBanner(warningConfig);
        container.appendChild(banner);
    });

    // Show "+N more" indicator if needed
    if (remainingCount > 0) {
        const moreIndicator = createElement('div', '',
            'bg-gray-800 border-b border-gray-700 px-4 py-1 text-center text-sm text-gray-400'
        );
        moreIndicator.textContent = `+${remainingCount} more issue${remainingCount > 1 ? 's' : ''} in Settings`;
        container.appendChild(moreIndicator);
    }
}

/**
 * Create a single banner element
 */
function createBanner(warningConfig) {
    const { message, severity, link: linkHref, linkText } = warningConfig;

    const isError = severity === 'error';
    const bgColor = isError ? 'bg-red-900/80' : 'bg-yellow-900/80';
    const borderColor = isError ? 'border-red-700' : 'border-yellow-700';
    const textColor = isError ? 'text-red-200' : 'text-yellow-200';
    const iconColor = isError ? 'text-red-400' : 'text-yellow-400';

    const banner = createElement('div', '',
        `${bgColor} border-b ${borderColor} px-4 py-2 flex items-center justify-between`
    );

    // Left side: icon + message
    const left = createElement('div', '', 'flex items-center gap-2');

    // Warning icon (Unicode)
    const icon = createElement('span', isError ? '\u26A0' : '\u26A0', `${iconColor} text-lg`);
    left.appendChild(icon);

    const text = createElement('span', message, `${textColor} text-sm`);
    left.appendChild(text);

    banner.appendChild(left);

    // Right side: action link
    const link = createElement('a', '', `${textColor} text-sm hover:underline flex items-center gap-1`);
    link.href = linkHref;
    link.textContent = linkText;

    // Arrow icon
    const arrow = createElement('span', '\u2192', '');
    link.appendChild(arrow);

    banner.appendChild(link);

    return banner;
}

/**
 * Clear all warnings
 */
export function clearWarningBanner() {
    currentWarnings = [];
    renderWarningBanner();
}

/**
 * Check if there are active warnings
 * @returns {boolean}
 */
export function hasWarnings() {
    return currentWarnings.length > 0;
}
