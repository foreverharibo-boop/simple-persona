// Simple Persona — ST 기본 페르소나 창 대체 모달
//
// ★ v8 ★
// - 클릭을 capture 단계에서 완전 차단 → ST 기본 패널이 "슉" 열렸다 닫히는 현상 해결
// - settings.html 미사용 (manifest에도 없음). 설정 UI는 JS로 직접 주입.

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

    // 모바일 터치 버그 방지:
    // 손가락 뗄 때 synthesized click이 발생하는데,
    // 그 시점엔 이미 오버레이가 화면을 덮고 있어서
    // backdrop click 핸들러가 즉시 발동 → 열리자마자 닫힘.
    // 400ms 동안 backdrop 닫기를 무시하면 해결됨.
    let _modalOpenedAt = 0;

    function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.body.appendChild(overlay);
            bindModalEvents(overlay);
        }
        updateCurrentBanner();
        overlay.classList.add('sp-visible');
        _modalOpenedAt = Date.now();
        renderGrid();
    }

    function closeModal() {
        document.getElementById('sp-overlay')?.classList.remove('sp-visible');
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        // 400ms 쿨다운: 열리자마자 synthesized click으로 닫히는 것 방지
        overlay.addEventListener('click', e => {
            if (e.target === overlay && Date.now() - _modalOpenedAt > 400) closeModal();
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
        setTimeout(() => {
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

    // ─── ② 페르소나 버튼 후킹 — document 전역 위임 방식 ──────────────────────
    //
    // 특정 요소에 직접 addEventListener를 거는 대신,
    // document 전체에서 클릭을 감시하다가 대상이 페르소나 버튼이면 처리.
    // → 버튼이 언제 생기든, ST가 DOM을 다시 그리든 상관없이 항상 작동함.
    // (v6까지는 요소가 아직 없으면 후킹 실패할 수 있었음)

    // ★ v8 핵심 수정 ★
    // v7에서는 클릭을 감지만 하고 ST 기본 동작을 막지 않아서,
    // ST가 자기 패널을 여는 애니메이션을 그대로 실행 → "슉" 올라가는 현상 발생.
    // 이제 capture 단계에서 이벤트를 완전히 가로채서
    // ST의 클릭 핸들러가 아예 실행되지 않도록 차단함.
    document.addEventListener('click', e => {
        const target = e.target.closest(
            '[data-i18n="[title]Persona Management"], ' +
            '[title="Persona Management"], ' +
            '[title="페르소나 관리"]'
        );
        if (!target) return;
        if (!isEnabled()) return;

        // ST의 기본 서랍 열기 동작을 완전히 차단
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        openModal();
    }, true); // capture: true → ST 핸들러보다 먼저 실행됨

    // ─── ③ 확장 탭 설정 UI — 반복 시도 주입 ──────────────────────────────────

    function injectSettings() {
        if (document.getElementById('sp-settings-block')) return true;

        const container =
            document.getElementById('extensions_settings2') ??
            document.getElementById('extensions_settings');
        if (!container) return false;

        // ★ ST가 .inline-drawer-toggle 에 전역 클릭 핸들러를 걸어두기 때문에
        //   같은 클래스를 쓰면 내 핸들러와 ST 핸들러가 둘 다 실행되어
        //   열렸다 바로 닫히는 충돌이 생김.
        //   → 독자적인 클래스명(sp-drawer-*)을 사용해 완전히 분리.
        const block = document.createElement('div');
        block.id = 'sp-settings-block';
        block.innerHTML = `
            <div class="sp-drawer-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:6px 0;">
                <b>Simple Persona</b>
                <span class="sp-drawer-icon" style="transition:transform 0.2s;">▼</span>
            </div>
            <div class="sp-drawer-content" style="display:none;padding:8px 4px 12px;">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                    <input id="sp-enabled-toggle" type="checkbox" ${isEnabled() ? 'checked' : ''} />
                    <span>활성화 — 페르소나 버튼 클릭 시 Simple Persona 열기</span>
                </label>
                <small style="display:block;margin-top:6px;opacity:0.55;font-size:0.74rem;padding-left:24px;">
                    끄면 기본 페르소나 창이 열립니다.
                </small>
            </div>`;
        container.appendChild(block);

        const toggle = block.querySelector('.sp-drawer-toggle');
        const content = block.querySelector('.sp-drawer-content');
        const icon = block.querySelector('.sp-drawer-icon');

        toggle.addEventListener('click', () => {
            const opening = content.style.display === 'none';
            content.style.display = opening ? 'block' : 'none';
            icon.style.transform = opening ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        block.querySelector('#sp-enabled-toggle').addEventListener('change', e => {
            getSettings().enabled = e.target.checked;
            saveSettingsDebounced();
            applyEnabledState();
            if (!e.target.checked) closeModal();
        });

        return true;
    }

    // ─── 초기화 ──────────────────────────────────────────────────────────────

    function init() {
        getSettings();
        applyEnabledState();

        // 설정 UI: 컨테이너가 생길 때까지 1초마다 최대 30번 재시도
        let tries = 0;
        const timer = setInterval(() => {
            if (injectSettings() || ++tries > 30) clearInterval(timer);
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
