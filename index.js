import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const MODULE = 'simplePersona';
const THEMES = ['soft', 'paper', 'polaroid', 'circle', 'magazine', 'sticker', 'tcg', 'glass', 'bubble-pink', 'bubble-sky', 'heart-pink', 'heart-sky', 'bare-white', 'bare-black'];

const defaultSettings = {
    enabled: true,
    showCurrentBar: true,
    theme: 'soft',
    useCustomAccent: false,
    accentColor: '#c8a0e6',
    useCustomCardColor: false,
    cardColor: '#8a8aa0',
    cardMin: 105,
    avatarScale: 96,
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

/** Apply the current theme preset + accent color to one element. */
function applyThemeToEl(el) {
    if (!el) return;
    const settings = getSettings();
    for (const t of THEMES) {
        el.classList.toggle('sp-theme-' + t, settings.theme === t);
    }
    if (settings.useCustomAccent && settings.accentColor) {
        el.style.setProperty('--sp-accent', settings.accentColor);
    } else {
        el.style.removeProperty('--sp-accent');
    }
    // Normal (unselected) card color — a visible-but-soft tint of the
    // chosen color, overriding the theme's default card background.
    if (settings.useCustomCardColor && settings.cardColor) {
        el.style.setProperty('--sp-card-bg',
            `color-mix(in srgb, ${settings.cardColor} 20%, transparent)`);
        el.style.setProperty('--sp-card-bg-hover',
            `color-mix(in srgb, ${settings.cardColor} 32%, transparent)`);
    } else {
        el.style.removeProperty('--sp-card-bg');
        el.style.removeProperty('--sp-card-bg-hover');
    }
    // Size controls: card min-width (density) + avatar scale.
    el.style.setProperty('--sp-card-min', (settings.cardMin || 105) + 'px');
    el.style.setProperty('--sp-avatar-scale', (settings.avatarScale || 96) + '%');
}

/** Apply theme to both the grid block and the current-persona bar. */
function applyTheme() {
    applyThemeToEl(document.getElementById('user_avatar_block'));
    applyThemeToEl(document.getElementById('sp-current-bar'));
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
        applyTheme();
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
        // Clicking the bar scrolls to the active card.
        bar.addEventListener('click', () => {
            const active = block.querySelector('.avatar-container.selected');
            active?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        // Insert directly before the persona list block.
        block.parentElement?.insertBefore(bar, block);
        applyThemeToEl(bar);
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
        // Re-apply classes in case ST rebuilt the block, then resync.
        const settings = getSettings();
        block.classList.toggle('sp-enabled', !!settings.enabled);
        applyTheme();
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

                <div class="flex-container flexFlowColumn" style="margin-top:8px;">
                    <label for="sp-theme"><small>Theme preset</small></label>
                    <select id="sp-theme" class="text_pole">
                        <option value="soft">Soft (default)</option>
                        <option value="paper">Paper</option>
                        <option value="polaroid">Polaroid</option>
                        <option value="circle">Circle</option>
                        <option value="magazine">Magazine</option>
                        <option value="sticker">Sticker</option>
                        <option value="tcg">Trading Card</option>
                        <option value="glass">Glass</option>
                        <option value="bubble-pink">Bubble Pink 🫧💕</option>
                        <option value="bubble-sky">Bubble Sky 🫧💙</option>
                        <option value="heart-pink">Heart Pink 💕</option>
                        <option value="heart-sky">Heart Sky 💙</option>
                        <option value="bare-white">Bare White ⬜</option>
                        <option value="bare-black">Bare Black ⬛</option>
                    </select>
                </div>

                <label class="checkbox_label" for="sp-use-accent" style="margin-top:8px;">
                    <input id="sp-use-accent" type="checkbox">
                    <span>Custom selected-card color</span>
                </label>
                <div class="flex-container alignItemsCenter" id="sp-accent-row" style="gap:8px;">
                    <input id="sp-accent-color" type="color" style="width:42px;height:28px;padding:0;border:none;background:none;cursor:pointer;">
                    <small class="text_muted">Selected card (glow, border &amp; dot)</small>
                </div>

                <label class="checkbox_label" for="sp-use-card" style="margin-top:8px;">
                    <input id="sp-use-card" type="checkbox">
                    <span>Custom normal-card color</span>
                </label>
                <div class="flex-container alignItemsCenter" id="sp-card-row" style="gap:8px;">
                    <input id="sp-card-color" type="color" style="width:42px;height:28px;padding:0;border:none;background:none;cursor:pointer;">
                    <small class="text_muted">All unselected cards</small>
                </div>

                <hr style="margin:10px 0; opacity:0.2;">
                <div class="flex-container flexFlowColumn" style="margin-top:4px;">
                    <label for="sp-card-min"><small>Card size (dense ↔ large)</small></label>
                    <input id="sp-card-min" type="range" min="30" max="300" step="5" class="text_pole" style="width:100%;">
                </div>
                <div class="flex-container flexFlowColumn" style="margin-top:6px;">
                    <label for="sp-avatar-scale"><small>Avatar size</small></label>
                    <input id="sp-avatar-scale" type="range" min="60" max="100" step="2" class="text_pole" style="width:100%;">
                </div>

                <small class="text_muted" style="display:block;margin-top:8px;">
                    Restyles the native Persona Management panel into a card
                    grid. All original features keep working.
                </small>
            </div>
        </div>
    </div>`;

    $('#extensions_settings2').append(html);

    const $enabled = $('#sp-enabled');
    const $bar = $('#sp-show-current-bar');
    const $theme = $('#sp-theme');
    const $useAccent = $('#sp-use-accent');
    const $accent = $('#sp-accent-color');
    const $useCard = $('#sp-use-card');
    const $card = $('#sp-card-color');

    $enabled.prop('checked', settings.enabled);
    $bar.prop('checked', settings.showCurrentBar);
    $theme.val(settings.theme);
    $useAccent.prop('checked', settings.useCustomAccent);
    $accent.val(settings.accentColor);
    $accent.prop('disabled', !settings.useCustomAccent);
    $useCard.prop('checked', settings.useCustomCardColor);
    $card.val(settings.cardColor);
    $card.prop('disabled', !settings.useCustomCardColor);

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
    $theme.on('change', function () {
        settings.theme = $(this).val();
        saveSettingsDebounced();
        applyTheme();
    });
    $useAccent.on('change', function () {
        settings.useCustomAccent = $(this).prop('checked');
        $accent.prop('disabled', !settings.useCustomAccent);
        saveSettingsDebounced();
        applyTheme();
    });
    $accent.on('input', function () {
        settings.accentColor = $(this).val();
        saveSettingsDebounced();
        applyTheme();
    });
    $useCard.on('change', function () {
        settings.useCustomCardColor = $(this).prop('checked');
        $card.prop('disabled', !settings.useCustomCardColor);
        saveSettingsDebounced();
        applyTheme();
    });
    $card.on('input', function () {
        settings.cardColor = $(this).val();
        saveSettingsDebounced();
        applyTheme();
    });

    const $cardMin = $('#sp-card-min');
    const $avatarScale = $('#sp-avatar-scale');
    $cardMin.val(settings.cardMin);
    $avatarScale.val(settings.avatarScale);
    $cardMin.on('input', function () {
        settings.cardMin = parseInt($(this).val(), 10);
        saveSettingsDebounced();
        applyTheme();
    });
    $avatarScale.on('input', function () {
        settings.avatarScale = parseInt($(this).val(), 10);
        saveSettingsDebounced();
        applyTheme();
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
            applyTheme();
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
