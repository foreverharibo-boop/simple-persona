// Simple Persona Extension for SillyTavern
// Intercepts the persona button and shows a custom modal

(function () {
    'use strict';

    const MODULE_NAME = 'simple-persona';

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function getST() {
        return window.SillyTavern?.getContext?.() ?? null;
    }

    function getUserAvatars() {
        // SillyTavern stores persona list in user_avatars_block
        const ctx = getST();
        if (ctx && ctx.personas) return ctx.personas; // object: { filename: displayName }
        // fallback: scrape from the original persona list in DOM
        const items = {};
        document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
            const img = el.querySelector('img');
            const name = el.querySelector('.ch_name')?.textContent?.trim() ?? '';
            const file = img?.dataset?.avatar ?? img?.src ?? '';
            if (file) items[file] = name;
        });
        return items;
    }

    function getCurrentPersona() {
        const ctx = getST();
        // user_avatar is the currently active persona filename
        return ctx?.user_avatar ?? null;
    }

    function getPersonaName(filename) {
        const ctx = getST();
        if (ctx?.personas?.[filename]) return ctx.personas[filename];
        // fallback from DOM
        const el = document.querySelector(`#user_avatar_block .avatar-container[data-avatar="${filename}"] .ch_name`);
        return el?.textContent?.trim() ?? filename ?? 'Unknown';
    }

    function getAvatarUrl(filename) {
        if (!filename) return 'img/user-default.png';
        if (filename.startsWith('http') || filename.startsWith('/')) return filename;
        return `user/images/${filename}`;
    }

    // ─── Modal HTML ──────────────────────────────────────────────────────────────

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.innerHTML = `
        <div id="sp-modal" role="dialog" aria-modal="true" aria-label="페르소나">
            <div id="sp-header">
                <span id="sp-title">페르소나</span>
                <button id="sp-close" aria-label="닫기">✕</button>
            </div>

            <!-- Current persona banner -->
            <div id="sp-current">
                <img id="sp-current-avatar" src="img/user-default.png" alt="현재 페르소나" />
                <div id="sp-current-info">
                    <div id="sp-current-name">—</div>
                    <div id="sp-current-sub">현재 선택된 페르소나</div>
                </div>
                <div id="sp-current-actions">
                    <button class="sp-icon-btn" id="sp-export-current" title="현재 페르소나 내보내기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>
            </div>

            <!-- Toolbar -->
            <div id="sp-toolbar">
                <div id="sp-search-wrap">
                    <svg class="sp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="sp-search" type="text" placeholder="페르소나 검색..." />
                </div>
                <button class="sp-tool-btn" id="sp-import-btn" title="JSON/PNG 불러오기">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    불러오기
                </button>
                <input type="file" id="sp-import-file" accept=".json,.png" style="display:none" multiple />
            </div>

            <!-- Grid -->
            <div id="sp-grid"></div>
        </div>`;
        return overlay;
    }

    // ─── Render grid ─────────────────────────────────────────────────────────────

    function renderGrid(filter = '') {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;

        const ctx = getST();
        // Build list from SillyTavern's internal persona store
        let entries = [];

        if (ctx && ctx.personas) {
            entries = Object.entries(ctx.personas).map(([file, name]) => ({ file, name }));
        } else {
            // DOM fallback
            document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
                const file = el.dataset.avatar ?? '';
                const name = el.querySelector('.ch_name')?.textContent?.trim() ?? file;
                entries.push({ file, name });
            });
        }

        const current = getCurrentPersona();
        const q = filter.toLowerCase();
        if (q) entries = entries.filter(e => e.name.toLowerCase().includes(q) || e.file.toLowerCase().includes(q));

        grid.innerHTML = '';

        if (entries.length === 0) {
            grid.innerHTML = '<div id="sp-empty">표시할 페르소나가 없습니다.</div>';
            return;
        }

        entries.forEach(({ file, name }) => {
            const card = document.createElement('div');
            card.className = 'sp-card' + (file === current ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${name}" loading="lazy" />
                    ${file === current ? '<div class="sp-card-badge">✓</div>' : ''}
                </div>
                <div class="sp-card-name">${name}</div>
                <div class="sp-card-actions">
                    <button class="sp-card-btn sp-card-select" data-file="${file}" title="선택">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="sp-card-btn sp-card-export" data-file="${file}" title="내보내기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>`;
            grid.appendChild(card);
        });
    }

    // ─── Current persona banner update ──────────────────────────────────────────

    function updateCurrentBanner() {
        const file = getCurrentPersona();
        const name = file ? getPersonaName(file) : '없음';
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(file);
        if (nameEl) nameEl.textContent = name;
    }

    // ─── Select persona ──────────────────────────────────────────────────────────

    function selectPersona(file) {
        // Click the matching avatar in the original hidden block
        const original = document.querySelector(`#user_avatar_block .avatar-container[data-avatar="${file}"]`);
        if (original) {
            original.click();
        } else {
            // Try img-based selector
            const img = document.querySelector(`#user_avatar_block img[data-avatar="${file}"]`);
            if (img) img.closest('.avatar-container')?.click();
        }
        setTimeout(() => {
            updateCurrentBanner();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
        }, 300);
    }

    // ─── Export ──────────────────────────────────────────────────────────────────

    async function exportPersona(file) {
        try {
            // Export PNG
            const imgUrl = getAvatarUrl(file);
            const imgRes = await fetch(imgUrl);
            if (imgRes.ok) {
                const blob = await imgRes.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file.includes('.') ? file : `${file}.png`;
                a.click();
                URL.revokeObjectURL(a.href);
            }

            // Export JSON (persona metadata)
            const ctx = getST();
            const name = ctx?.personas?.[file] ?? getPersonaName(file);
            const description = ctx?.persona_descriptions?.[file]?.description ?? '';
            const position = ctx?.persona_descriptions?.[file]?.position ?? 0;

            const data = { file, name, description, position };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${name || file}.json`;
            a.click();
            URL.revokeObjectURL(a.href);

            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) {
            console.error('[Simple Persona] Export failed:', e);
            showToast('내보내기 실패: ' + e.message, true);
        }
    }

    // ─── Import ──────────────────────────────────────────────────────────────────

    async function importPersonaFiles(files) {
        let jsonData = null;
        let pngFile = null;

        for (const f of files) {
            if (f.name.endsWith('.json')) {
                const text = await f.text();
                try { jsonData = JSON.parse(text); } catch { /* ignore */ }
            } else if (f.name.endsWith('.png')) {
                pngFile = f;
            }
        }

        if (!pngFile && !jsonData) {
            showToast('JSON 또는 PNG 파일을 선택해주세요.', true);
            return;
        }

        // Upload PNG via SillyTavern's avatar upload form
        if (pngFile) {
            const formData = new FormData();
            formData.append('avatar', pngFile);
            try {
                const res = await fetch('/uploaduseravatar', { method: 'POST', body: formData });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                showToast(`"${pngFile.name}" 불러오기 완료!`);
            } catch (e) {
                console.error('[Simple Persona] Import PNG failed:', e);
                showToast('PNG 불러오기 실패: ' + e.message, true);
                return;
            }
        }

        // Apply JSON metadata if provided
        if (jsonData) {
            const ctx = getST();
            const file = jsonData.file ?? pngFile?.name ?? '';
            if (ctx && file) {
                if (jsonData.name && ctx.personas) ctx.personas[file] = jsonData.name;
                if (ctx.persona_descriptions && (jsonData.description || jsonData.position !== undefined)) {
                    ctx.persona_descriptions[file] = {
                        description: jsonData.description ?? '',
                        position: jsonData.position ?? 0,
                    };
                }
            }
        }

        // Refresh grid
        setTimeout(() => renderGrid(document.getElementById('sp-search')?.value ?? ''), 500);
    }

    // ─── Toast ───────────────────────────────────────────────────────────────────

    function showToast(msg, isError = false) {
        let toast = document.getElementById('sp-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sp-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = isError ? 'sp-toast-error' : '';
        toast.classList.add('sp-toast-show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('sp-toast-show'), 2800);
    }

    // ─── Open / Close ────────────────────────────────────────────────────────────

    function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.body.appendChild(overlay);
            bindModalEvents(overlay);
        }
        updateCurrentBanner();
        renderGrid();
        overlay.classList.add('sp-visible');
        document.getElementById('sp-search')?.focus();
    }

    function closeModal() {
        document.getElementById('sp-overlay')?.classList.remove('sp-visible');
    }

    // ─── Events ──────────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        // Close
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);

        // Search
        overlay.querySelector('#sp-search')?.addEventListener('input', e => {
            renderGrid(e.target.value);
        });

        // Grid delegation
        overlay.querySelector('#sp-grid')?.addEventListener('click', e => {
            const selectBtn = e.target.closest('.sp-card-select');
            const exportBtn = e.target.closest('.sp-card-export');
            const card = e.target.closest('.sp-card');

            if (selectBtn) {
                selectPersona(selectBtn.dataset.file);
            } else if (exportBtn) {
                exportPersona(exportBtn.dataset.file);
            } else if (card) {
                selectPersona(card.dataset.file);
            }
        });

        // Export current
        overlay.querySelector('#sp-export-current')?.addEventListener('click', () => {
            const file = getCurrentPersona();
            if (file) exportPersona(file);
            else showToast('선택된 페르소나가 없습니다.', true);
        });

        // Import
        overlay.querySelector('#sp-import-btn')?.addEventListener('click', () => {
            overlay.querySelector('#sp-import-file')?.click();
        });
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        // Keyboard
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.classList.contains('sp-visible')) {
                closeModal();
            }
        });
    }

    // ─── Intercept persona button ────────────────────────────────────────────────

    function interceptPersonaButton() {
        // The persona button in the top bar — try multiple selectors
        const selectors = [
            '#persona_management_button',
            '#user-settings-button',          // some builds
            'a[data-action="persona"]',
            '.drawer-toggle[data-tooltip*="ersona"]',
            '#personas-drawer-button',
            '#manage-personas-button',
        ];

        for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn) {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    openModal();
                }, true);
                console.log(`[Simple Persona] Intercepted: ${sel}`);
                return true;
            }
        }
        return false;
    }

    // ─── Also intercept the tab-bar persona icon (sillytavern sidebar) ──────────

    function interceptSidebarPersona() {
        // Look for any button whose tooltip or aria-label mentions persona
        document.querySelectorAll('button, a, .drawer-icon').forEach(el => {
            const tip = (el.getAttribute('title') || el.getAttribute('data-i18n') || el.getAttribute('aria-label') || '').toLowerCase();
            if (tip.includes('persona') && !el.dataset.spHooked) {
                el.dataset.spHooked = '1';
                el.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    openModal();
                }, true);
                console.log('[Simple Persona] Intercepted sidebar button:', el);
            }
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────────────

    function init() {
        // Try to intercept immediately, then retry after DOM settles
        const found = interceptPersonaButton();
        interceptSidebarPersona();

        if (!found) {
            const observer = new MutationObserver(() => {
                if (interceptPersonaButton()) {
                    observer.disconnect();
                }
                interceptSidebarPersona();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        console.log('[Simple Persona] Extension loaded ✓');
    }

    // Wait for ST to finish loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Small delay to let ST register its own handlers first, so we can override
        setTimeout(init, 500);
    }
})();
