// Simple Persona — ST 기본 페르소나 창 대체 모달
//
// ★ v6 변경사항 ★
// v5에서 "openDrawer 클래스 감시" 방식으로 바꿨다가 ST 자체 애니메이션과
// 충돌해서 깜빡이며 사라지는 버그가 생김. 처음에 실제로 성공적으로 떴던
// v3의 "클릭 후킹 + CSS로 기본 패널 숨김" 방식으로 되돌림 — 이게 검증된 방법.
//
// 설정 UI도 v4/v5에서 JS로 수동 주입하려던 걸 그만두고,
// manifest.json의 "settings": "settings.html" — ST 내장 자동 로딩 기능에 맡김.
// 체크박스는 언제 삽입될지 몰라서 document 이벤트 위임으로 연결.

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

    function applyEnabledState() {
        document.body.classList.toggle('sp-active', isEnabled());
    }

    // 체크박스는 settings.html이 ST에 의해 삽입된 후 등장하므로
    // 존재 여부와 상관없이 항상 작동하는 이벤트 위임 방식 사용
    document.addEventListener('change', e => {
        if (e.target?.id === 'sp-enabled-toggle') {
            getSettings().enabled = e.target.checked;
            saveSettingsDebounced();
            applyEnabledState();
            if (!e.target.checked) closeModal();
        }
    });

    // 체크박스가 삽입되는 시점에 현재 설정값 반영 (초기 상태 동기화)
    function syncSettingsCheckbox() {
        const box = document.getElementById('sp-enabled-toggle');
        if (box && box.dataset.spSynced !== '1') {
            box.checked = isEnabled();
            box.dataset.spSynced = '1';
        }
    }

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

    function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.body.appendChild(overlay);
            bindModalEvents(overlay);
        }
        updateCurrentBanner();
        overlay.classList.add('sp-visible');
        renderGrid();
        document.getElementById('sp-search')?.focus();
    }

    function closeModal() {
        document.getElementById('sp-overlay')?.classList.remove('sp-visible');
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        overlay.querySelector('#sp-grid')?.addEventListener('click', async e => {
            const sel = e.target.closest('.sp-card-select');
            const exp = e.target.closest('.sp-card-export');
            const card = e.target.closest('.sp-card');
            const file = sel?.dataset.file ?? card?.dataset.file;
            if (exp) {
                exportPersona(exp.dataset.file);
            } else if (file) {
                await setUserAvatar(file);
                updateCurrentBanner();
                renderGrid(document.getElementById('sp-search')?.value ?? '');
            }
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

    // ─── 기본 페르소나 버튼 후킹 (v3에서 실제로 작동했던 검증된 방식) ────────

    function findPersonaBtn() {
        return document.querySelector('[data-i18n="[title]Persona Management"]')
            ?? document.querySelector('[title="Persona Management"]')
            ?? document.querySelector('[title="페르소나 관리"]');
    }

    function hookPersonaButton() {
        const btn = findPersonaBtn();
        if (!btn || btn.dataset.spHooked) return false;
        btn.dataset.spHooked = '1';
        btn.addEventListener('click', () => {
            if (isEnabled()) openModal();
        });
        console.log('[Simple Persona] 버튼 후킹 완료:', btn);
        return true;
    }

    // ─── 초기화 ──────────────────────────────────────────────────────────────

    function init() {
        getSettings();
        applyEnabledState();

        if (!hookPersonaButton()) {
            const obs = new MutationObserver(() => {
                if (hookPersonaButton()) obs.disconnect();
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        // settings.html의 체크박스가 삽입되면 현재 값으로 동기화
        syncSettingsCheckbox();
        const settingsObs = new MutationObserver(syncSettingsCheckbox);
        settingsObs.observe(document.body, { childList: true, subtree: true });

        console.log('[Simple Persona] 로드 완료 ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
