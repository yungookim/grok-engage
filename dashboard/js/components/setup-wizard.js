/**
 * Setup Wizard Component
 * First-run configuration modal for API credentials
 */

import * as api from '../api.js';
import { createElement } from '../utils.js';

let wizardState = {
    currentStep: 1,
    totalSteps: 2,
    xCredentials: {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessSecret: ''
    },
    xaiCredentials: {
        apiKey: ''
    },
    validationStatus: {
        x: null,      // null | 'validating' | 'success' | 'error'
        xai: null
    },
    validationDetails: {
        x: null,
        xai: null
    },
    validationError: {
        x: null,
        xai: null
    }
};

/**
 * Show the setup wizard modal
 * @param {Function} onComplete - Callback when setup is complete
 */
export function showSetupWizard(onComplete) {
    // Create modal backdrop
    const backdrop = createElement('div', '',
        'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50'
    );
    backdrop.id = 'setup-wizard-backdrop';

    // Create modal container
    const modal = createElement('div', '',
        'bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl'
    );

    // Render initial step
    renderStep(modal, onComplete);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
}

/**
 * Close the setup wizard
 */
function closeWizard() {
    const backdrop = document.getElementById('setup-wizard-backdrop');
    if (backdrop) {
        backdrop.remove();
    }
    // Reset state for next time
    wizardState.currentStep = 1;
    wizardState.validationStatus = { x: null, xai: null };
    wizardState.validationDetails = { x: null, xai: null };
    wizardState.validationError = { x: null, xai: null };
}

/**
 * Create a link element
 */
function createLink(text, href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-x-blue hover:underline';
    link.textContent = text;
    return link;
}

/**
 * Render the current step
 */
function renderStep(container, onComplete) {
    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Header
    const header = createElement('div', '', 'p-6 border-b border-gray-800');

    const title = createElement('h2', 'Welcome to grok-engage',
        'text-xl font-bold text-white mb-2'
    );
    header.appendChild(title);

    const subtitle = createElement('p', "Let's get you set up. You'll need API keys from:", 'text-gray-400 text-sm');
    header.appendChild(subtitle);

    const links = createElement('ul', '', 'text-sm mt-2 space-y-1');

    // X Developer link
    const xLinkItem = createElement('li', '', 'text-gray-400');
    xLinkItem.appendChild(document.createTextNode('\u2022 '));
    xLinkItem.appendChild(createLink('developer.x.com', 'https://developer.x.com'));
    xLinkItem.appendChild(document.createTextNode(' (X API)'));
    links.appendChild(xLinkItem);

    // xAI link
    const xaiLinkItem = createElement('li', '', 'text-gray-400');
    xaiLinkItem.appendChild(document.createTextNode('\u2022 '));
    xaiLinkItem.appendChild(createLink('x.ai', 'https://x.ai'));
    xaiLinkItem.appendChild(document.createTextNode(' (xAI API)'));
    links.appendChild(xaiLinkItem);

    header.appendChild(links);
    container.appendChild(header);

    // Body
    const body = createElement('div', '', 'p-6');

    if (wizardState.currentStep === 1) {
        renderStep1(body, container, onComplete);
    } else {
        renderStep2(body, container, onComplete);
    }

    container.appendChild(body);
}

/**
 * Render Step 1: X API Credentials
 */
function renderStep1(body, modalContainer, onComplete) {
    const stepHeader = createElement('div', '', 'mb-4');
    const stepTitle = createElement('h3', 'Step 1 of 2: X API Credentials',
        'text-lg font-semibold text-white'
    );
    stepHeader.appendChild(stepTitle);

    // Permission requirement note
    const permNote = createElement('p', '', 'text-sm text-yellow-400 mt-1 flex items-center gap-1');
    const warnIcon = createElement('span', '\u26A0', '');
    permNote.appendChild(warnIcon);
    permNote.appendChild(document.createTextNode(' Requires Read and Write permissions'));
    stepHeader.appendChild(permNote);

    body.appendChild(stepHeader);

    const form = createElement('div', '', 'space-y-4');

    // API Key
    form.appendChild(createInputGroup('API Key', 'x-api-key', 'text',
        wizardState.xCredentials.apiKey, 'Enter your X API Key',
        (val) => { wizardState.xCredentials.apiKey = val; }
    ));

    // API Secret
    form.appendChild(createInputGroup('API Secret', 'x-api-secret', 'password',
        wizardState.xCredentials.apiSecret, 'Enter your X API Secret',
        (val) => { wizardState.xCredentials.apiSecret = val; }
    ));

    // Access Token
    form.appendChild(createInputGroup('Access Token', 'x-access-token', 'text',
        wizardState.xCredentials.accessToken, 'Enter your Access Token',
        (val) => { wizardState.xCredentials.accessToken = val; }
    ));

    // Access Secret
    form.appendChild(createInputGroup('Access Secret', 'x-access-secret', 'password',
        wizardState.xCredentials.accessSecret, 'Enter your Access Secret',
        (val) => { wizardState.xCredentials.accessSecret = val; }
    ));

    body.appendChild(form);

    // Detailed help section
    const helpBox = createElement('div', '', 'mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700');

    const helpTitle = createElement('p', '', 'text-sm font-medium text-gray-300 mb-2');
    helpTitle.appendChild(document.createTextNode('How to get your credentials from '));
    helpTitle.appendChild(createLink('developer.x.com', 'https://developer.x.com/en/portal/dashboard'));
    helpTitle.appendChild(document.createTextNode(':'));
    helpBox.appendChild(helpTitle);

    const helpList = createElement('ol', '', 'text-sm text-gray-400 space-y-2 list-decimal list-inside');

    const step1 = createElement('li', '', '');
    step1.appendChild(document.createTextNode('Create a project and app (or use an existing one)'));
    helpList.appendChild(step1);

    const step2 = createElement('li', '', '');
    step2.appendChild(document.createTextNode('Go to your app\'s '));
    const settingsStrong = createElement('strong', 'Settings', 'text-gray-300');
    step2.appendChild(settingsStrong);
    step2.appendChild(document.createTextNode(' tab'));
    helpList.appendChild(step2);

    const step3 = createElement('li', '', '');
    step3.appendChild(document.createTextNode('Scroll to "User authentication settings" and click '));
    const editStrong = createElement('strong', 'Edit', 'text-gray-300');
    step3.appendChild(editStrong);
    helpList.appendChild(step3);

    const step4 = createElement('li', '', '');
    step4.appendChild(document.createTextNode('Set App permissions to '));
    const rwStrong = createElement('strong', 'Read and Write', 'text-gray-300');
    step4.appendChild(rwStrong);
    step4.appendChild(document.createTextNode(' (required for posting replies)'));
    helpList.appendChild(step4);

    const step5 = createElement('li', '', '');
    step5.appendChild(document.createTextNode('Set Callback URL to '));
    const urlCode = createElement('code', 'http://localhost:3001', 'text-gray-300 bg-gray-700 px-1 rounded');
    step5.appendChild(urlCode);
    helpList.appendChild(step5);

    const step6 = createElement('li', '', '');
    step6.appendChild(document.createTextNode('Go to the '));
    const keysStrong = createElement('strong', 'Keys and tokens', 'text-gray-300');
    step6.appendChild(keysStrong);
    step6.appendChild(document.createTextNode(' tab to find your credentials'));
    helpList.appendChild(step6);

    helpBox.appendChild(helpList);
    body.appendChild(helpBox);

    // Validation status
    const statusContainer = createElement('div', '', 'mt-4');
    statusContainer.id = 'validation-status';
    renderValidationStatus(statusContainer, 'x');
    body.appendChild(statusContainer);

    // Buttons
    const buttons = createElement('div', '', 'flex justify-end gap-3 mt-6');

    const nextBtn = createElement('button', 'Next',
        'bg-x-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed'
    );
    nextBtn.id = 'next-btn';
    nextBtn.addEventListener('click', () => handleStep1Next(modalContainer, onComplete));
    buttons.appendChild(nextBtn);

    body.appendChild(buttons);
}

/**
 * Render Step 2: xAI API Key
 */
function renderStep2(body, modalContainer, onComplete) {
    const stepHeader = createElement('div', '', 'flex items-center justify-between mb-4');
    const stepTitle = createElement('h3', 'Step 2 of 2: xAI API Key',
        'text-lg font-semibold text-white'
    );
    stepHeader.appendChild(stepTitle);
    body.appendChild(stepHeader);

    const form = createElement('div', '', 'space-y-4');

    // xAI API Key
    form.appendChild(createInputGroup('API Key', 'xai-api-key', 'password',
        wizardState.xaiCredentials.apiKey, 'Enter your xAI API Key',
        (val) => { wizardState.xaiCredentials.apiKey = val; }
    ));

    body.appendChild(form);

    // Help text
    const help = createElement('p', '', 'text-sm text-gray-500 mt-4');
    help.appendChild(document.createTextNode('Get your API key from '));
    help.appendChild(createLink('x.ai console', 'https://console.x.ai'));
    help.appendChild(document.createTextNode('.'));
    body.appendChild(help);

    // Security note
    const secNote = createElement('div', '', 'mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700 flex items-start gap-2');

    // Info icon (using text instead of SVG for safety)
    const infoIcon = createElement('span', '\u24D8', 'text-gray-400');
    secNote.appendChild(infoIcon);

    const secText = createElement('span', '', 'text-sm text-gray-400');
    secText.appendChild(document.createTextNode('Your API keys are stored locally. For encryption at rest, set '));
    const secCode = createElement('code', 'MASTER_KEY', 'text-gray-300 bg-gray-700 px-1 rounded');
    secText.appendChild(secCode);
    secText.appendChild(document.createTextNode(' in your .env file.'));
    secNote.appendChild(secText);

    body.appendChild(secNote);

    // Validation status
    const statusContainer = createElement('div', '', 'mt-4');
    statusContainer.id = 'validation-status';
    renderValidationStatus(statusContainer, 'xai');
    body.appendChild(statusContainer);

    // Buttons
    const buttons = createElement('div', '', 'flex justify-between mt-6');

    const backBtn = createElement('button', 'Back',
        'bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium'
    );
    backBtn.addEventListener('click', () => {
        wizardState.currentStep = 1;
        wizardState.validationStatus.xai = null;
        renderStep(modalContainer, onComplete);
    });
    buttons.appendChild(backBtn);

    const completeBtn = createElement('button', 'Complete Setup',
        'bg-x-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed'
    );
    completeBtn.id = 'complete-btn';
    completeBtn.addEventListener('click', () => handleStep2Complete(modalContainer, onComplete));
    buttons.appendChild(completeBtn);

    body.appendChild(buttons);
}

/**
 * Create an input group (label + input)
 */
function createInputGroup(label, id, type, value, placeholder, onChange) {
    const group = createElement('div', '', '');

    const labelEl = createElement('label', label, 'block text-gray-400 text-sm mb-1');
    labelEl.htmlFor = id;
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.value = value || '';
    input.placeholder = placeholder;
    input.className = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue';
    input.addEventListener('input', (e) => onChange(e.target.value));
    group.appendChild(input);

    return group;
}

/**
 * Render validation status message
 */
function renderValidationStatus(container, type) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const status = wizardState.validationStatus[type];
    if (!status) return;

    const statusDiv = createElement('div', '', 'rounded-lg p-3 flex items-center gap-2');

    if (status === 'validating') {
        statusDiv.className += ' bg-gray-800 border border-gray-700';
        // Spinner icon (Unicode)
        const spinner = createElement('span', '\u23F3', 'text-gray-400');
        statusDiv.appendChild(spinner);
        const text = createElement('span', 'Validating...', 'text-gray-400');
        statusDiv.appendChild(text);
    } else if (status === 'success') {
        statusDiv.className += ' bg-green-900/50 border border-green-700';
        // Checkmark
        const checkmark = createElement('span', '\u2713', 'text-green-400');
        statusDiv.appendChild(checkmark);
        const details = wizardState.validationDetails[type];
        let successText = 'Connected successfully';
        if (type === 'x' && details?.username) {
            successText += ` as @${details.username}`;
        } else if (type === 'xai' && details?.modelsAvailable) {
            successText += ` (${details.modelsAvailable} models available)`;
        }
        const text = createElement('span', successText, 'text-green-400');
        statusDiv.appendChild(text);
    } else if (status === 'error') {
        statusDiv.className += ' bg-red-900/50 border border-red-700';
        // X mark
        const xmark = createElement('span', '\u2717', 'text-red-400');
        statusDiv.appendChild(xmark);
        const error = wizardState.validationError[type] || 'Validation failed';
        const text = createElement('span', error, 'text-red-400');
        statusDiv.appendChild(text);
    }

    container.appendChild(statusDiv);
}

/**
 * Handle Step 1 Next button
 */
async function handleStep1Next(modalContainer, onComplete) {
    const { apiKey, apiSecret, accessToken, accessSecret } = wizardState.xCredentials;

    // Basic validation
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        wizardState.validationStatus.x = 'error';
        wizardState.validationError.x = 'All four credentials are required';
        const statusContainer = document.getElementById('validation-status');
        if (statusContainer) renderValidationStatus(statusContainer, 'x');
        return;
    }

    // Show validating state
    wizardState.validationStatus.x = 'validating';
    const statusContainer = document.getElementById('validation-status');
    if (statusContainer) renderValidationStatus(statusContainer, 'x');

    // Disable button
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Validating...';
    }

    try {
        const result = await api.validateCredentials('x', {
            apiKey,
            apiSecret,
            accessToken,
            accessSecret
        });

        if (result.valid) {
            wizardState.validationStatus.x = 'success';
            wizardState.validationDetails.x = result.details;
            if (statusContainer) renderValidationStatus(statusContainer, 'x');

            // Save credentials
            await api.saveCredentials('x', {
                apiKey,
                apiSecret,
                accessToken,
                accessSecret
            });

            // Move to next step after a brief pause
            setTimeout(() => {
                wizardState.currentStep = 2;
                renderStep(modalContainer, onComplete);
            }, 800);
        } else {
            wizardState.validationStatus.x = 'error';
            wizardState.validationError.x = result.error;
            if (statusContainer) renderValidationStatus(statusContainer, 'x');
        }
    } catch (error) {
        wizardState.validationStatus.x = 'error';
        wizardState.validationError.x = error.message || 'Failed to validate credentials';
        if (statusContainer) renderValidationStatus(statusContainer, 'x');
    } finally {
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.textContent = 'Next';
        }
    }
}

/**
 * Handle Step 2 Complete button
 */
async function handleStep2Complete(modalContainer, onComplete) {
    const { apiKey } = wizardState.xaiCredentials;

    // Basic validation
    if (!apiKey) {
        wizardState.validationStatus.xai = 'error';
        wizardState.validationError.xai = 'API key is required';
        const statusContainer = document.getElementById('validation-status');
        if (statusContainer) renderValidationStatus(statusContainer, 'xai');
        return;
    }

    // Show validating state
    wizardState.validationStatus.xai = 'validating';
    const statusContainer = document.getElementById('validation-status');
    if (statusContainer) renderValidationStatus(statusContainer, 'xai');

    // Disable button
    const completeBtn = document.getElementById('complete-btn');
    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.textContent = 'Validating...';
    }

    try {
        const result = await api.validateCredentials('xai', { apiKey });

        if (result.valid) {
            wizardState.validationStatus.xai = 'success';
            wizardState.validationDetails.xai = result.details;
            if (statusContainer) renderValidationStatus(statusContainer, 'xai');

            // Save credentials
            await api.saveCredentials('xai', { apiKey });

            // Mark setup as complete in localStorage
            localStorage.setItem('setup_completed', 'true');

            // Close wizard and call completion callback
            setTimeout(() => {
                closeWizard();
                if (onComplete) onComplete();
            }, 800);
        } else {
            wizardState.validationStatus.xai = 'error';
            wizardState.validationError.xai = result.error;
            if (statusContainer) renderValidationStatus(statusContainer, 'xai');
        }
    } catch (error) {
        wizardState.validationStatus.xai = 'error';
        wizardState.validationError.xai = error.message || 'Failed to validate API key';
        if (statusContainer) renderValidationStatus(statusContainer, 'xai');
    } finally {
        if (completeBtn) {
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete Setup';
        }
    }
}

/**
 * Check if setup wizard should be shown
 * @returns {Promise<boolean>}
 */
export async function shouldShowSetupWizard() {
    try {
        const status = await api.getConfigStatus();
        // Show wizard if required config is missing
        return status.missing && status.missing.length > 0;
    } catch (error) {
        console.error('Failed to check config status:', error);
        // If we can't check, show wizard to be safe
        return true;
    }
}
