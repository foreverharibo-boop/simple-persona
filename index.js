// Simple Persona — ST 기본 페르소나 창 대체 모달
import { power_user } from '../../../power-user.js';
import { getUserAvatars, setUserAvatar, user_avatar } from '../../../personas.js';
import { getThumbnailUrl, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const MODULE_NAME = 'simple-persona';

(function () {
    'use strict';

    // ─── 페르소나 데이터 ─────────────────────────────────────────────────────

    function getCurrentPersona() {
        return user_avatar ?? null;
    }

    function getPersonaName(file) {
        return power_user.personas?.[file] ?? file;
    }

    /** 메모: ST 원본 DOM의 .ch_additional_info 에서 직접 읽음
     *  (persona_descriptions.description 는 긴 시스템 프롬프트라 안 씀) */
    function getPersonaMemo(file) {
        const el = document.querySelector(
            `#user_avatar_block [data-avatar-id="${CSS.escape(file)}"] .ch_additional_info`
        );
        return el?.textContent?.trim() ?? '';
    }

    function getAvatarUrl(file) {
        if (!file) return 'img/user-default.png';
        try { return getThumbnailUrl('persona', file); } catch { return `user/images/${file}`; }
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
            // DOM 폴백
            const entries = [];
            document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
                const file = el.dataset.avatarId ?? '';
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

    // ─── 그리드 렌더링 ───────────────────────────────────────────────────────

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
            const card = document.createElement('div');
            card.className = 'sp-card' + (file === current ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${h(name)}" loading="lazy" />
                    ${file === current ? '<div class="sp-card-badge">✓</div>' : ''}
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

    function h(str) {
        return String(str ?? '').replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
        );
    }

    // ─── 배너 갱신 ───────────────────────────────────────────────────────────

    function updateCurrentBanner() {
        const file = getCurrentPersona();
        const name = file ? getPersonaName(file) : '없음';
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(file);
        if (nameEl) nameEl.textContent = name;
    }

    // ─── 페르소나 선택 ───────────────────────────────────────────────────────

    async function selectPersona(file) {
        await setUserAvatar(file);
        updateCurrentBanner();
        await renderGrid(document.getElementById('sp-search')?.value ?? '');
    }

    // ─── 내보내기 ────────────────────────────────────────────────────────────

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
            const data = { file, name, description: desc?.description ?? '', position: desc?.position ?? 0 };
            const a2 = document.createElement('a');
            a2.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a2.download = `${name || file}.json`;
            a2.click();
            URL.revokeObjectURL(a2.href);
            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) {
            showToast('내보내기 실패: ' + e.message, true);
        }
    }

    // ─── 불러오기 ────────────────────────────────────────────────────────────

    async function importPersonaFiles(files) {
        let jsonData = null, pngFile = null;
        for (const f of files) {
            if (f.name.endsWith('.json')) { try { jsonData = JSON.parse(await f.text()); } catch {} }
            else if (f.name.endsWith('.png')) pngFile = f;
        }
        if (!pngFile && !jsonData) { showToast('JSON 또는 PNG를 선택해주세요.', true); return; }

        if (pngFile) {
            const nativeInput = document.querySelector('#form_upload_avatar input[type="file"]');
            if (nativeInput) {
                const dt = new DataTransfer();
                dt.items.add(pngFile);
                nativeInput.files = dt.files;
                nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
                showToast(`"${pngFile.name}" 불러오는 중...`);
            } else {
                showToast('업로드 폼을 찾을 수 없습니다.', true);
            }
        }
        if (jsonData) {
            setTimeout(async () => {
                const file = jsonData.file ?? pngFile?.name ?? '';
                if (file && jsonData.name) power_user.personas[file] = jsonData.name;
                if (file && jsonData.description !== undefined) {
                    if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
                    power_user.persona_descriptions[file] = { description: jsonData.description, position: jsonData.position ?? 0 };
                }
                saveSettingsDebounced();
                await renderGrid(document.getElementById('sp-search')?.value ?? '');
            }, 800);
        } else {
            setTimeout(() => renderGrid(document.getElementById('sp-search')?.value ?? ''), 800);
        }
    }

    // ─── 토스트 ─────────────────────────────────────────────────────────────

    function showToast(msg, isError = false) {
        let t = document.getElementById('sp-toast');
        if (!t) { t = document.createElement('div'); t.id = 'sp-toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.className = isError ? 'sp-toast-error' : '';
        t.classList.add('sp-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('sp-toast-show'), 2800);
    }

    // ─── 열기/닫기 ──────────────────────────────────────────────────────────

    async function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.body.appendChild(overlay);
            bindModalEvents(overlay);
        }
        updateCurrentBanner();
        await renderGrid();
        overlay.classList.add('sp-visible');
        document.getElementById('sp-search')?.focus();
    }

    function closeModal() {
        document.getElementById('sp-overlay')?.classList.remove('sp-visible');
    }

    // ─── 이벤트 바인딩 ──────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        overlay.querySelector('#sp-grid')?.addEventListener('click', e => {
            const sel = e.target.closest('.sp-card-select');
            const exp = e.target.closest('.sp-card-export');
            const card = e.target.closest('.sp-card');
            if (sel) selectPersona(sel.dataset.file);
            else if (exp) exportPersona(exp.dataset.file);
            else if (card) selectPersona(card.dataset.file);
        });

        overlay.querySelector('#sp-export-current')?.addEventListener('click', () => {
            const file = getCurrentPersona();
            if (file) exportPersona(file); else showToast('선택된 페르소나가 없습니다.', true);
        });
        overlay.querySelector('#sp-import-btn')?.addEventListener('click', () => {
            overlay.querySelector('#sp-import-file')?.click();
        });
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.classList.contains('sp-visible'))
                closeModal();
        });
    }

    // ─── 페르소나 버튼 후킹 ─────────────────────────────────────────────────

    function findPersonaBtn() {
        return document.querySelector('[data-i18n="[title]Persona Management"]')
            ?? document.querySelector('[title="Persona Management"]')
            ?? document.querySelector('[title="페르소나 관리"]');
    }

    function hookPersonaButton() {
        const btn = findPersonaBtn();
        if (!btn || btn.dataset.spHooked) return false;
        btn.dataset.spHooked = '1';
        btn.addEventListener('click', () => { if (isEnabled()) openModal(); });
        console.log('[Simple Persona] 버튼 후킹 완료');
        return true;
    }

    // ─── 활성화 설정 ────────────────────────────────────────────────────────

    const defaultSettings = { enabled: true };

    function getSettings() {
        if (!extension_settings[MODULE_NAME])
            extension_settings[MODULE_NAME] = { ...defaultSettings };
        for (const k in defaultSettings)
            if (extension_settings[MODULE_NAME][k] === undefined)
                extension_settings[MODULE_NAME][k] = defaultSettings[k];
        return extension_settings[MODULE_NAME];
    }

    function isEnabled() { return getSettings().enabled; }

    function applyEnabledState() {
        document.body.classList.toggle('sp-active', isEnabled());
    }

    // ─── 확장 탭 설정 UI 주입 (jQuery 사용 — ST 전역 $ 있음) ────────────────

    function injectSettings() {
        if (document.getElementById('sp-settings-block')) return; // 이미 주입됨

        // ST 확장 설정 컨테이너를 여러 방법으로 시도
        const container = document.getElementById('extensions_settings2')
            ?? document.getElementById('extensions_settings')
            ?? document.querySelector('#extensions_block .extensions_block_inner')
            ?? document.querySelector('.extensions_block');
        if (!container) return;

        const settings = getSettings();
        const html = `
        <div id="sp-settings-block" class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Simple Persona</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display:none; padding:10px 0 4px;">
                <label class="checkbox_label" style="display:flex;align-items:center;gap:8px;">
                    <input id="sp-enabled-toggle" type="checkbox" ${settings.enabled ? 'checked' : ''} />
                    <span>활성화 — 페르소나 버튼 클릭 시 Simple Persona 열기</span>
                </label>
                <small style="display:block;margin-top:4px;opacity:0.55;font-size:0.74rem;padding-left:22px;">
                    끄면 기본 페르소나 창이 열립니다.
                </small>
            </div>
        </div>`;

        // jQuery가 있으면 사용, 없으면 일반 DOM
        if (typeof $ !== 'undefined') {
            $(container).append(html);
            // ST의 inline-drawer 공통 핸들러가 이미 document에 위임돼 있으므로 별도 추가 불필요
        } else {
            container.insertAdjacentHTML('beforeend', html);
        }

        // 서랍 토글
        const block = document.getElementById('sp-settings-block');
        block?.querySelector('.inline-drawer-toggle')?.addEventListener('click', function () {
            const content = block.querySelector('.inline-drawer-content');
            const icon = block.querySelector('.inline-drawer-icon');
            const open = content.style.display !== 'none';
            content.style.display = open ? 'none' : 'block';
            icon?.classList.toggle('down', open);
            icon?.classList.toggle('up', !open);
        });

        // 체크박스
        document.getElementById('sp-enabled-toggle')?.addEventListener('change', e => {
            getSettings().enabled = e.target.checked;
            saveSettingsDebounced();
            applyEnabledState();
            if (!e.target.checked) closeModal();
        });
    }

    // ─── 초기화 ─────────────────────────────────────────────────────────────

    function init() {
        getSettings();
        applyEnabledState();

        // 버튼 후킹 + 설정 UI 주입 — DOM 준비 안 됐을 수 있으니 MutationObserver로 재시도
        const obs = new MutationObserver(() => {
            hookPersonaButton();
            injectSettings();
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // 즉시도 시도
        hookPersonaButton();
        injectSettings();

        // 5초 후 한 번 더 (ST 완전 로드 대기)
        setTimeout(() => { hookPersonaButton(); injectSettings(); }, 5000);

        console.log('[Simple Persona] 로드 완료 ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
