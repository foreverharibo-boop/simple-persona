import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const MODULE = 'simplePersona';

const defaultSettings = {
    enabled: true,
    showCurrentBar: true,
};

function getSettings() {
    if (!extension_settings[MODULE]) {
        extension_settings[MODULE] = structuredClone(defaultSettings);
    }
    // fill any missing keys after an update
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE][key] === undefined) {
            extension_settings[MODULE][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE];
}

/** Toggle the reskin class on the persona block. */
function applyEnabledState() {
    const settings = getSettings();
    const block = document.getElementById('user_avatar_block');
    if (!block) return;
    block.classList.toggle('sp-enabled', !!settings.enabled);
    if (!settings.enabled) {
        removeCurrentBar();
    } else {
        syncCurrentBar();
    }
}

function removeCurrentBar() {
    document.getElementById('sp-current-bar')?.remove();
}

/**
 * Build / update the "current persona" bar and place it above the
 * persona list, right under the search row. Reads directly from the
 * card that ST has already marked `.selected`, so it needs no access
 * to internal persona state.
 */
function syncCurrentBar() {
    const settings = getSettings();
    const block = document.getElementById('user_avatar_block');
    if (!block || !settings.enabled || !settings.showCurrentBar) {
        removeCurrentBar();
        return;
    }

    const selected = block.querySelector('.avatar-container.selected');
    if (!selected) {
        removeCurrentBar();
        return;
    }

    const imgSrc = selected.querySelector('.avatar img')?.getAttribute('src') || '';
    const name = selected.querySelector('.ch_name')?.textContent?.trim() || '';

    let bar = document.getElementById('sp-current-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'sp-current-bar';
        bar.innerHTML = `
            <img class="sp-current-avatar" src="" alt="">
            <div class="sp-current-text">
                <div class="sp-current-label" data-i18n="Current persona">Current persona</div>
                <div class="sp-current-name"></div>
            </div>
        `;
        // Clicking the bar scrolls to and flashes the active card.
        bar.addEventListener('click', () => {
            const active = block.querySelector('.avatar-container.selected');
            active?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        // Insert directly before the persona list block.
        block.parentElement?.insertBefore(bar, block);
    }

    const barImg = bar.querySelector('.sp-current-avatar');
    if (barImg.getAttribute('src') !== imgSrc) barImg.setAttribute('src', imgSrc);
    const barName = bar.querySelector('.sp-current-name');
    if (barName.textContent !== name) barName.textContent = name;
}

/** Watch the persona list for re-renders / selection changes. */
function observeBlock() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;

    const observer = new MutationObserver(() => {
        // Re-apply class in case ST rebuilt the block, then resync bar.
        const settings = getSettings();
        block.classList.toggle('sp-enabled', !!settings.enabled);
        syncCurrentBar();
    });

    observer.observe(block, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
    });
}

async function addSettingsPanel() {
    // Never add the panel twice.
    if (document.getElementById('sp-enabled')) return;

    const settings = getSettings();
    const html = `
    <div class="simple-persona-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Simple Persona</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label" for="sp-enabled">
                    <input id="sp-enabled" type="checkbox">
                    <span>Enable card grid</span>
                </label>
                <label class="checkbox_label" for="sp-show-current-bar">
                    <input id="sp-show-current-bar" type="checkbox">
                    <span>Show "current persona" bar on top</span>
                </label>
                <small class="text_muted">
                    Restyles the native Persona Management panel into a card
                    grid. All original features keep working.
                </small>
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(html);

    const $enabled = $('#sp-enabled');
    const $bar = $('#sp-show-current-bar');
    $enabled.prop('checked', settings.enabled);
    $bar.prop('checked', settings.showCurrentBar);

    $enabled.on('change', function () {
        settings.enabled = $(this).prop('checked');
        saveSettingsDebounced();
        applyEnabledState();
    });
    $bar.on('change', function () {
        settings.showCurrentBar = $(this).prop('checked');
        saveSettingsDebounced();
        syncCurrentBar();
    });
}

export async function init() {
    // Guard against double-init: the manifest `activate` hook and the
    // jQuery bootstrap below can both fire depending on ST version.
    if (window.__simplePersonaInit) return;
    window.__simplePersonaInit = true;

    getSettings();
    await addSettingsPanel();

    // The persona drawer may not be in the DOM until first opened, so
    // apply lazily and also when the drawer button is clicked.
    applyEnabledState();
    observeBlock();

    $(document).on('click', '#persona-management-button .drawer-toggle', () => {
        // Give ST a tick to render the list, then style it.
        setTimeout(() => {
            applyEnabledState();
            syncCurrentBar();
        }, 50);
    });
}

// Some ST versions call the manifest hook, some just import the module.
// init() is self-guarding, so calling it from both paths is safe.
jQuery(async () => {
    try {
        await init();
    } catch (e) {
        console.error('[Simple Persona] init failed:', e);
    }
});
