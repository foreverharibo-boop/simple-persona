// Simple Persona — ST 기본 페르소나 창 대체 모달
import { power_user } from '../../../power-user.js';
import { getUserAvatars, setUserAvatar, user_avatar } from '../../../personas.js';
import { getThumbnailUrl, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const MODULE_NAME = 'simple-persona';

(function () {
    'use strict';

    // ─── 설정 ────────────────────────────────────────────────────────────────

    function getSettings() {
        if (!extension_settings[MODULE_NAME])
            extension_settings[MODULE_NAME] = { enabled: true };
        if (extension_settings[MODULE_NAME].enabled === undefined)
            extension_settings[MODULE_NAME].enabled = true;
        return extension_settings[MODULE_NAME];
    }

    function isEnabled() { return getSettings().enabled !== false; }

    // ─── 데이터 헬퍼 ─────────────────────────────────────────────────────────

    function getCurrentPersona() { return user_avatar ?? null; }

    function getPersonaName(file) {
        return power_user.personas?.[file] ?? file;
    }

    /** 메모: ST 원본 DOM .ch_additional_info 에서 직접 읽음 */
    function getPersonaMemo(file) {
        const selector = `#user_avatar_block [data-avatar-id="${CSS.escape(file)}"] .ch_additional_info`;
        return document.querySelector(selector)?.textContent?.trim() ?? '';
    }

    function getAvatarUrl(file) {
        if (!file) return 'img/user-default.png';
        try { return getThumbnailUrl('persona', file); }
        catch { return `/thumbnail?type=persona&file=${encodeURIComponent(file)}`; }
    }

    async function listPersonas() {
        try {
            const avatars = await getUserAvatars(false);
            return avatars.map(file => ({
                file,
                name: getPersonaName(file),
                memo: getPersonaMemo(file),
            }));
        } catch {
            const entries = [];
            document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
                const file = el.dataset.avatarId ?? el.getAttribute('data-avatar-id') ?? '';
                if (!file) return;
                entries.push({
                    file,
                    name: el.querySelector('.ch_name')?.textContent?.trim() ?? file,
                    memo: el.querySelector('.ch_additional_info')?.textContent?.trim() ?? '',
                });
            });
            return entries;
        }
    }

    // ─── 모달 HTML ───────────────────────────────────────────────────────────

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.innerHTML = `
        <div id="sp-modal" role="dialog" aria-modal="true">
            <div id="sp-header">
                <span id="sp-title">페르소나</span>
                <button id="sp-close" aria-label="닫기">✕</button>
            </div>
            <div id="sp-current">
                <img id="sp-current-avatar" src="img/user-default.png" alt="" />
                <div id="sp-current-info">
                    <div id="sp-current-name">—</div>
                    <div id="sp-current-sub">현재 선택된 페르소나</div>
                </div>
                <div id="sp-current-actions">
                    <button class="sp-icon-btn" id="sp-export-current" title="내보내기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>
            </div>
            <div id="sp-toolbar">
                <div id="sp-search-wrap">
                    <svg class="sp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="sp-search" type="text" placeholder="페르소나 검색..." />
                </div>
                <button class="sp-tool-btn" id="sp-import-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    불러오기
                </button>
                <input type="file" id="sp-import-file" accept=".json,.png" style="display:none" multiple />
            </div>
            <div id="sp-grid"></div>
        </div>`;
        return overlay;
    }

    // ─── 그리드 ──────────────────────────────────────────────────────────────

    function h(str) {
        return String(str ?? '').replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }

    async function renderGrid(filter = '') {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;

        let entries = await listPersonas();
        const current = getCurrentPersona();
        const q = filter.trim().toLowerCase();
        if (q) entries = entries.filter(e =>
            e.name.toLowerCase().includes(q) || e.memo.toLowerCase().includes(q)
        );

        grid.innerHTML = '';
        if (!entries.length) {
            grid.innerHTML = '<div id="sp-empty">표시할 페르소나가 없습니다.</div>';
            return;
        }

        for (const { file, name, memo } of entries) {
            const isActive = file === current;
            const card = document.createElement('div');
            card.className = 'sp-card' + (isActive ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${h(name)}" loading="lazy" />
                    ${isActive ? '<div class="sp-card-badge">✓</div>' : ''}
                </div>
                <div class="sp-card-name">${h(name)}</div>
                ${memo ? `<div class="sp-card-sub">${h(memo)}</div>` : ''}
                <div class="sp-card-actions">
                    <button class="sp-card-btn sp-card-select" data-file="${h(file)}" title="선택">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="sp-card-btn sp-card-export" data-file="${h(file)}" title="내보내기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>`;
            grid.appendChild(card);
        }
    }

    // ─── 배너 ────────────────────────────────────────────────────────────────

    function updateCurrentBanner() {
        const file = getCurrentPersona();
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(file);
        if (nameEl) nameEl.textContent = file ? getPersonaName(file) : '없음';
    }

    // ─── 열기/닫기 ───────────────────────────────────────────────────────────

    async function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.body.appendChild(overlay);
            bindModalEvents(overlay);
        }
        updateCurrentBanner();
        overlay.classList.add('sp-visible');
        renderGrid(); // 비동기지만 기다리지 않음 — 모달은 바로 보이고 그리드가 채워짐
        document.getElementById('sp-search')?.focus();
    }

    function closeModal() {
        document.getElementById('sp-overlay')?.classList.remove('sp-visible');
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        // 오버레이 배경 클릭 시 닫기 (모달 내부 클릭은 제외)
        overlay.addEventListener('pointerdown', e => {
            if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        overlay.querySelector('#sp-grid')?.addEventListener('click', async e => {
            const sel = e.target.closest('.sp-card-select');
            const exp = e.target.closest('.sp-card-export');
            const card = e.target.closest('.sp-card');
            if (sel) { await setUserAvatar(sel.dataset.file); updateCurrentBanner(); renderGrid(document.getElementById('sp-search')?.value ?? ''); }
            else if (exp) { exportPersona(exp.dataset.file); }
            else if (card) { await setUserAvatar(card.dataset.file); updateCurrentBanner(); renderGrid(document.getElementById('sp-search')?.value ?? ''); }
        });

        overlay.querySelector('#sp-export-current')?.addEventListener('click', () => {
            const file = getCurrentPersona();
            if (file) exportPersona(file); else showToast('선택된 페르소나가 없습니다.', true);
        });
        overlay.querySelector('#sp-import-btn')?.addEventListener('click', () =>
            overlay.querySelector('#sp-import-file')?.click()
        );
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.classList.contains('sp-visible'))
                closeModal();
        });
    }

    // ─── 내보내기/불러오기 ───────────────────────────────────────────────────

    async function exportPersona(file) {
        try {
            const name = getPersonaName(file);
            const res = await fetch(getAvatarUrl(file));
            if (res.ok) {
                const blob = await res.blob();
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = file.includes('.') ? file : `${file}.png`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
            const desc = power_user.persona_descriptions?.[file];
            const a2 = document.createElement('a');
            a2.href = URL.createObjectURL(new Blob(
                [JSON.stringify({ file, name, description: desc?.description ?? '', position: desc?.position ?? 0 }, null, 2)],
                { type: 'application/json' }
            ));
            a2.download = `${name || file}.json`;
            a2.click();
            URL.revokeObjectURL(a2.href);
            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) { showToast('내보내기 실패: ' + e.message, true); }
    }

    async function importPersonaFiles(files) {
        let jsonData = null, pngFile = null;
        for (const f of files) {
            if (f.name.endsWith('.json')) { try { jsonData = JSON.parse(await f.text()); } catch {} }
            else if (f.name.endsWith('.png')) pngFile = f;
        }
        if (!pngFile && !jsonData) { showToast('JSON 또는 PNG를 선택해주세요.', true); return; }

        if (pngFile) {
            const input = document.querySelector('#form_upload_avatar input[type="file"]');
            if (input) {
                const dt = new DataTransfer();
                dt.items.add(pngFile);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                showToast(`"${pngFile.name}" 불러오는 중...`);
            }
        }
        setTimeout(async () => {
            if (jsonData?.file && jsonData?.name) power_user.personas[jsonData.file] = jsonData.name;
            saveSettingsDebounced();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
        }, 800);
    }

    function showToast(msg, isError = false) {
        let t = document.getElementById('sp-toast');
        if (!t) { t = document.createElement('div'); t.id = 'sp-toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.className = isError ? 'sp-toast-error' : '';
        t.classList.add('sp-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('sp-toast-show'), 2800);
    }

    // ─── ★ 핵심: PersonaManagement drawer를 MutationObserver로 감시 ────────────
    //
    // 버튼 클릭을 가로채는 대신, ST가 #PersonaManagement에
    // 'openDrawer' 클래스를 추가하는 순간을 감지해서
    // 즉시 제거하고 우리 모달을 열기.
    // → 버튼 후킹/stopPropagation 불필요, 클릭 충돌 없음.

    function watchPersonaPanel() {
        const panel = document.getElementById('PersonaManagement');
        if (!panel || panel.dataset.spWatching) return false;
        panel.dataset.spWatching = '1';

        const obs = new MutationObserver(() => {
            if (panel.classList.contains('openDrawer') && isEnabled()) {
                // ST가 서랍을 열려고 했을 때 — 즉시 닫고 우리 모달 열기
                panel.classList.remove('openDrawer');
                openModal();
            }
        });
        obs.observe(panel, { attributes: true, attributeFilter: ['class'] });
        console.log('[Simple Persona] PersonaManagement 감시 시작 ✓');
        return true;
    }

    // ─── 확장 탭 설정 UI 주입 ────────────────────────────────────────────────

    function injectSettings() {
        if (document.getElementById('sp-settings-block')) return true;

        // ST 버전마다 컨테이너 ID가 다를 수 있어 여러 셀렉터 시도
        const container =
            document.getElementById('extensions_settings2') ??
            document.getElementById('extensions_settings') ??
            document.querySelector('#extensions .inline-drawer') ??
            document.querySelector('.extension_settings');

        if (!container) return false;

        const settings = getSettings();
        const block = document.createElement('div');
        block.id = 'sp-settings-block';
        block.className = 'inline-drawer';
        block.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Simple Persona</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display:none; padding:8px 4px;">
                <label class="checkbox_label" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input id="sp-enabled-toggle" type="checkbox" ${settings.enabled !== false ? 'checked' : ''} />
                    <span>활성화 — 페르소나 버튼 클릭 시 Simple Persona 열기</span>
                </label>
                <small style="display:block;margin-top:4px;opacity:0.5;font-size:0.74rem;padding-left:22px;">
                    끄면 기본 페르소나 창이 열립니다.
                </small>
            </div>`;

        // ST의 기존 서랍(inline-drawer) 바로 앞에 삽입하거나 container에 append
        const firstDrawer = container.querySelector?.('.inline-drawer');
        if (firstDrawer) container.insertBefore(block, firstDrawer);
        else container.appendChild(block);

        // 서랍 열고 닫기
        block.querySelector('.inline-drawer-toggle').addEventListener('click', () => {
            const content = block.querySelector('.inline-drawer-content');
            const icon = block.querySelector('.inline-drawer-icon');
            const opening = content.style.display === 'none';
            content.style.display = opening ? 'block' : 'none';
            icon.classList.toggle('up', opening);
            icon.classList.toggle('down', !opening);
        });

        // 체크박스
        block.querySelector('#sp-enabled-toggle').addEventListener('change', e => {
            getSettings().enabled = e.target.checked;
            saveSettingsDebounced();
            if (!e.target.checked) closeModal();
        });

        console.log('[Simple Persona] 설정 UI 주입 완료 ✓');
        return true;
    }

    // ─── 초기화 ──────────────────────────────────────────────────────────────

    function init() {
        getSettings();

        // #PersonaManagement 감시 시작 — 없으면 DOM 준비될 때까지 대기
        if (!watchPersonaPanel()) {
            const obs = new MutationObserver(() => {
                if (watchPersonaPanel()) obs.disconnect();
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        // 설정 UI — 여러 타이밍에 시도 (확장 탭은 클릭 시 늦게 로드될 수 있음)
        const delays = [500, 1500, 3000, 6000, 10000];
        delays.forEach(d => setTimeout(injectSettings, d));

        // 확장 탭 클릭할 때도 시도
        document.addEventListener('click', e => {
            if (e.target.closest('#extensionsMenuButton, .extensions-button, [data-tab="extensions"]')) {
                setTimeout(injectSettings, 300);
            }
        });

        console.log('[Simple Persona] 로드 완료 ✓');
    }

    // ST 로드 완료 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
