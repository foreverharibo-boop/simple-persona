// ==========================================================
// Simple Persona — 기본 페르소나 창을 대체하는 커스텀 모달
// ==========================================================
//
// ★ 이전 버전과의 핵심 차이 ★
// 예전엔 window.SillyTavern.getContext()로 데이터를 긁으려 했는데,
// 이 객체엔 .personas / .user_avatar 같은 필드가 원래 없어서
// 페르소나 목록을 아예 못 읽어왔음 (그래서 안 됐던 것).
//
// 이번엔 ST 코어 모듈을 ES module import로 직접 불러와서 씀 —
// Polaroid / Narrative Card 만들 때 썼던 것과 동일한 검증된 방식.
// ==========================================================

// ★ 이전 버그: setPersonaDescription 이라는 존재 확인 안 된 함수를 import
//   했었는데, 이게 실제로 없으면 모듈 전체 로드가 실패해서
//   아무 코드도 안 돌아감 (버튼 눌러도 반응 없던 진짜 원인일 가능성 높음).
//   → 확인된 것만 import하고, 설명 저장은 power_user 객체를 직접 수정.
import { power_user } from '../../../power-user.js';
import { getUserAvatars, setUserAvatar, user_avatar } from '../../../personas.js';
import { getThumbnailUrl, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const MODULE_NAME = 'simple-persona';

(function () {
    'use strict';

    // ─── 페르소나 데이터 접근 (ST 코어 모듈 직접 사용) ─────────────────────────

    /** 현재 선택된 페르소나 파일명 */
    function getCurrentPersona() {
        return user_avatar ?? null;
    }

    /** file(파일명) -> 표시 이름. power_user.personas는 { file: "이름" } 형태 */
    function getPersonaName(file) {
        return power_user.personas?.[file] ?? file;
    }

    /** file -> 서브텍스트. 마크다운 헤더/빈줄 건너뛰고 의미있는 첫 줄만 */
    function getPersonaSubtitle(file) {
        const desc = power_user.persona_descriptions?.[file]?.description ?? '';
        for (const line of desc.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            if (t.startsWith('#')) continue;
            if (t.startsWith('**') && t.endsWith('**')) continue;
            if (t.startsWith('---')) continue;
            return t.slice(0, 50);
        }
        return '';
    }

    /** 아바타 썸네일 URL — ST 코어 헬퍼 그대로 사용 (경로 하드코딩 안 함) */
    function getAvatarUrl(file) {
        if (!file) return 'img/user-default.png';
        return getThumbnailUrl('persona', file);
    }

    /** 전체 페르소나 목록: [{file, name, subtitle}] */
    async function listPersonas() {
        const avatars = await getUserAvatars(false);
        return avatars.map(file => ({
            file,
            name: getPersonaName(file),
            subtitle: getPersonaSubtitle(file),
        }));
    }

    // ─── 모달 HTML ──────────────────────────────────────────────────────────

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.innerHTML = `
        <div id="sp-modal" role="dialog" aria-modal="true" aria-label="페르소나">
            <div id="sp-header">
                <span id="sp-title">페르소나</span>
                <button id="sp-close" aria-label="닫기">✕</button>
            </div>

            <!-- 현재 페르소나 표시줄 -->
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

            <!-- 검색 + 불러오기 -->
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

            <!-- 그리드 -->
            <div id="sp-grid"></div>
        </div>`;
        return overlay;
    }

    // ─── 그리드 렌더링 ──────────────────────────────────────────────────────

    async function renderGrid(filter = '') {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;

        let entries = await listPersonas();
        const current = getCurrentPersona();

        const q = filter.trim().toLowerCase();
        if (q) {
            entries = entries.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.subtitle.toLowerCase().includes(q)
            );
        }

        grid.innerHTML = '';

        if (entries.length === 0) {
            grid.innerHTML = '<div id="sp-empty">표시할 페르소나가 없습니다.</div>';
            return;
        }

        for (const { file, name, subtitle } of entries) {
            const card = document.createElement('div');
            card.className = 'sp-card' + (file === current ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${escapeHtml(name)}" loading="lazy" />
                    ${file === current ? '<div class="sp-card-badge">✓</div>' : ''}
                </div>
                <div class="sp-card-name">${escapeHtml(name)}</div>
                ${subtitle ? `<div class="sp-card-sub">${escapeHtml(subtitle)}</div>` : ''}
                <div class="sp-card-actions">
                    <button class="sp-card-btn sp-card-select" data-file="${escapeAttr(file)}" title="선택">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="sp-card-btn sp-card-export" data-file="${escapeAttr(file)}" title="내보내기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                </div>`;
            grid.appendChild(card);
        }
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }
    function escapeAttr(str) {
        return escapeHtml(str);
    }

    // ─── 현재 페르소나 표시줄 갱신 ──────────────────────────────────────────

    function updateCurrentBanner() {
        const file = getCurrentPersona();
        const name = file ? getPersonaName(file) : '없음';
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(file);
        if (nameEl) nameEl.textContent = name;
    }

    // ─── 페르소나 선택 ──────────────────────────────────────────────────────

    async function selectPersona(file) {
        // DOM 클릭 시뮬레이션 대신 ST 코어 함수를 직접 호출 (훨씬 안정적)
        await setUserAvatar(file);
        updateCurrentBanner();
        await renderGrid(document.getElementById('sp-search')?.value ?? '');
    }

    // ─── 내보내기 ───────────────────────────────────────────────────────────

    async function exportPersona(file) {
        try {
            const name = getPersonaName(file);

            // PNG
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

            // JSON (메타데이터)
            const description = power_user.persona_descriptions?.[file]?.description ?? '';
            const position = power_user.persona_descriptions?.[file]?.position ?? 0;
            const data = { file, name, description, position };

            const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a2 = document.createElement('a');
            a2.href = URL.createObjectURL(jsonBlob);
            a2.download = `${name || file}.json`;
            a2.click();
            URL.revokeObjectURL(a2.href);

            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) {
            console.error('[Simple Persona] Export failed:', e);
            showToast('내보내기 실패: ' + e.message, true);
        }
    }

    // ─── 불러오기 ───────────────────────────────────────────────────────────
    //
    // PNG 업로드는 엔드포인트를 직접 추측하지 않고,
    // ST가 이미 갖고 있는 숨겨진 업로드 폼(#form_upload_avatar)의
    // <input type="file">에 파일을 넣고 change 이벤트를 발생시켜서
    // ST 자체 업로드 로직이 그대로 처리하게 함 (가장 안전한 방법).

    async function importPersonaFiles(files) {
        let jsonData = null;
        let pngFile = null;

        for (const f of files) {
            if (f.name.endsWith('.json')) {
                try { jsonData = JSON.parse(await f.text()); } catch { /* 무시 */ }
            } else if (f.name.endsWith('.png')) {
                pngFile = f;
            }
        }

        if (!pngFile && !jsonData) {
            showToast('JSON 또는 PNG 파일을 선택해주세요.', true);
            return;
        }

        if (pngFile) {
            const nativeInput = document.querySelector('#form_upload_avatar input[type="file"]');
            if (!nativeInput) {
                showToast('업로드 폼을 찾을 수 없습니다.', true);
                return;
            }
            const dt = new DataTransfer();
            dt.items.add(pngFile);
            nativeInput.files = dt.files;
            nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
            showToast(`"${pngFile.name}" 불러오는 중...`);
        }

        // JSON 메타데이터(이름/설명) 적용 — 업로드가 파일명을 등록할 시간을 약간 줌
        if (jsonData) {
            setTimeout(async () => {
                const file = jsonData.file ?? pngFile?.name ?? '';
                if (!file) return;

                if (jsonData.name) {
                    power_user.personas[file] = jsonData.name;
                }
                if (jsonData.description !== undefined) {
                    if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
                    power_user.persona_descriptions[file] = {
                        description: jsonData.description ?? '',
                        position: jsonData.position ?? 0,
                    };
                }
                saveSettingsDebounced();
                await renderGrid(document.getElementById('sp-search')?.value ?? '');
            }, 800);
        } else {
            setTimeout(() => renderGrid(document.getElementById('sp-search')?.value ?? ''), 800);
        }
    }

    // ─── 토스트 알림 ────────────────────────────────────────────────────────

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

    // ─── 열기 / 닫기 ────────────────────────────────────────────────────────

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
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);

        overlay.querySelector('#sp-search')?.addEventListener('input', e => {
            renderGrid(e.target.value);
        });

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

        overlay.querySelector('#sp-export-current')?.addEventListener('click', () => {
            const file = getCurrentPersona();
            if (file) exportPersona(file);
            else showToast('선택된 페르소나가 없습니다.', true);
        });

        overlay.querySelector('#sp-import-btn')?.addEventListener('click', () => {
            overlay.querySelector('#sp-import-file')?.click();
        });
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.classList.contains('sp-visible')) {
                closeModal();
            }
        });
    }

    // ─── 기본 페르소나 창 가로채기 ──────────────────────────────────────────
    //
    // ★ 핵심 변경 ★
    // 예전엔 6개 셀렉터를 추측해서 클릭을 capture+stopPropagation으로
    // 막으려 했는데, 실제 DOM엔 그 어떤 셀렉터도 존재하지 않았음(다 틀림).
    //
    // 실제 존재하는 확실한 셀렉터는 data-i18n="[title]Persona Management"
    // (ST가 다국어 처리에 쓰는 속성이라 버전이 바뀌어도 잘 안 바뀜).
    //
    // 그리고 클릭을 막으려고 애쓰는 대신, 기본 페르소나 패널(#PersonaManagement)을
    // CSS로 아예 숨겨버리고, 아이콘 클릭 시 우리 모달을 "추가로" 여는 방식으로
    // 바꿈 — 이러면 ST 내부 클릭 핸들러랑 경쟁할 필요가 없어서 훨씬 안정적임.

    function findPersonaToggleIcon() {
        return document.querySelector('[data-i18n="[title]Persona Management"]')
            ?? document.querySelector('[title="Persona Management"]')
            ?? document.querySelector('[title="페르소나 관리"]');
    }

    function hookPersonaButton() {
        const icon = findPersonaToggleIcon();
        if (!icon || icon.dataset.spHooked) return false;

        icon.dataset.spHooked = '1';
        icon.addEventListener('click', () => {
            if (!isEnabled()) return; // 비활성화 상태면 기본 동작에 맡김(패널은 숨겨져 있지만 개입 안 함)
            openModal();
        });
        console.log('[Simple Persona] 페르소나 버튼 후킹 완료:', icon);
        return true;
    }

    // ─── 활성화/비활성화 설정 ───────────────────────────────────────────────

    const defaultSettings = { enabled: true };

    function getSettings() {
        if (!extension_settings[MODULE_NAME]) {
            extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
        }
        // 이전 버전에서 없던 값이면 채워넣기
        for (const key in defaultSettings) {
            if (extension_settings[MODULE_NAME][key] === undefined) {
                extension_settings[MODULE_NAME][key] = defaultSettings[key];
            }
        }
        return extension_settings[MODULE_NAME];
    }

    function isEnabled() {
        return getSettings().enabled;
    }

    /** body에 sp-active 클래스를 붙였다 뗐다 하면서 기본 패널 숨김을 제어 */
    function applyEnabledState() {
        document.body.classList.toggle('sp-active', isEnabled());
    }

    /** settings.html의 체크박스와 연결 */
    function bindSettingsUI() {
        const toggle = document.getElementById('sp-enabled-toggle');
        if (!toggle || toggle.dataset.spBound) return;
        toggle.dataset.spBound = '1';
        toggle.checked = isEnabled();
        toggle.addEventListener('change', e => {
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

        // settings.html이 로드된 후 체크박스 바인딩
        const bindOnce = () => { bindSettingsUI(); };
        bindOnce();
        const settingsObserver = new MutationObserver(bindOnce);
        settingsObserver.observe(document.body, { childList: true, subtree: true });

        if (!hookPersonaButton()) {
            const observer = new MutationObserver(() => {
                if (hookPersonaButton()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        console.log('[Simple Persona] 확장 로드 완료 ✓');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
