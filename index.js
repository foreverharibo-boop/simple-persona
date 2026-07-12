// Simple Persona
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

    // ─── 데이터 ──────────────────────────────────────────────────────────────

    function getCurrentPersona() { return user_avatar ?? null; }
    function getPersonaName(f) { return power_user.personas?.[f] ?? f; }
    function getPersonaMemo(f) {
        return document.querySelector(`#user_avatar_block [data-avatar-id="${CSS.escape(f)}"] .ch_additional_info`)?.textContent?.trim() ?? '';
    }
    function getAvatarUrl(f) {
        if (!f) return 'img/user-default.png';
        try { return getThumbnailUrl('persona', f); }
        catch { return `/thumbnail?type=persona&file=${encodeURIComponent(f)}`; }
    }
    async function listPersonas() {
        try {
            return (await getUserAvatars(false)).map(f => ({ file: f, name: getPersonaName(f), memo: getPersonaMemo(f) }));
        } catch {
            const r = [];
            document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
                const f = el.dataset.avatarId ?? el.getAttribute('data-avatar-id') ?? '';
                if (f) r.push({ file: f, name: el.querySelector('.ch_name')?.textContent?.trim() ?? f, memo: el.querySelector('.ch_additional_info')?.textContent?.trim() ?? '' });
            });
            return r;
        }
    }

    // ─── 모달 HTML ───────────────────────────────────────────────────────────

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';

        // ★ CSS 클래스에만 의존하지 않고 인라인 스타일로 강제 고정
        //   (MovingUI 등 다른 확장의 transform/z-index 영향 완전 차단)
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            right: 0 !important; bottom: 0 !important;
            width: 100vw !important; height: 100vh !important;
            z-index: 2147483647 !important;
            background: transparent !important;
            display: none;
            align-items: center !important;
            justify-content: center !important;
        `;

        overlay.innerHTML = `
        <div id="sp-modal">
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

    function h(s) {
        return String(s ?? '').replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
        );
    }

    async function renderGrid(filter = '') {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;
        let entries = await listPersonas();
        const cur = getCurrentPersona();
        const q = filter.trim().toLowerCase();
        if (q) entries = entries.filter(e => e.name.toLowerCase().includes(q) || e.memo.toLowerCase().includes(q));
        grid.innerHTML = '';
        if (!entries.length) { grid.innerHTML = '<div id="sp-empty">표시할 페르소나가 없습니다.</div>'; return; }
        for (const { file, name, memo } of entries) {
            const card = document.createElement('div');
            card.className = 'sp-card' + (file === cur ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${h(name)}" loading="lazy" />
                    ${file === cur ? '<div class="sp-card-badge">✓</div>' : ''}
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

    // ─── 배너 / 열기 / 닫기 ─────────────────────────────────────────────────

    function updateCurrentBanner() {
        const f = getCurrentPersona();
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(f);
        if (nameEl) nameEl.textContent = f ? getPersonaName(f) : '없음';
    }

    let _openedAt = 0;

    function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            // ★ <html>에 붙여서 body의 MovingUI transform 영향 완전 차단
            document.documentElement.appendChild(overlay);
            bindModalEvents(overlay);
        }
        // ★ CSS 클래스 + 인라인 스타일 둘 다 설정 (어느 쪽이든 확실히 보이게)
        overlay.classList.add('sp-visible');
        overlay.style.display = 'flex';
        _openedAt = Date.now();
        updateCurrentBanner();
        renderGrid();
    }

    function closeModal() {
        const overlay = document.getElementById('sp-overlay');
        if (!overlay) return;
        overlay.classList.remove('sp-visible');
        overlay.style.display = 'none';
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        // 400ms 쿨다운: 터치로 열자마자 synthesized click으로 닫히는 것 방지
        overlay.addEventListener('click', e => {
            if (e.target === overlay && Date.now() - _openedAt > 400) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        overlay.querySelector('#sp-grid')?.addEventListener('click', async e => {
            const exp = e.target.closest('.sp-card-export');
            const card = e.target.closest('.sp-card');
            const file = exp ? null : card?.dataset.file;
            if (exp) exportPersona(exp.dataset.file);
            else if (file) { await setUserAvatar(file); updateCurrentBanner(); renderGrid(document.getElementById('sp-search')?.value ?? ''); }
        });

        overlay.querySelector('#sp-export-current')?.addEventListener('click', () => {
            const f = getCurrentPersona();
            if (f) exportPersona(f); else showToast('선택된 페르소나가 없습니다.', true);
        });
        overlay.querySelector('#sp-import-btn')?.addEventListener('click', () => overlay.querySelector('#sp-import-file')?.click());
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.style.display === 'flex') closeModal();
        });
    }

    // ─── 내보내기/불러오기 ───────────────────────────────────────────────────

    async function exportPersona(file) {
        try {
            const name = getPersonaName(file);
            const res = await fetch(getAvatarUrl(file));
            if (res.ok) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(await res.blob());
                a.download = file.includes('.') ? file : `${file}.png`;
                a.click(); URL.revokeObjectURL(a.href);
            }
            const desc = power_user.persona_descriptions?.[file];
            const a2 = document.createElement('a');
            a2.href = URL.createObjectURL(new Blob([JSON.stringify({ file, name, description: desc?.description ?? '', position: desc?.position ?? 0 }, null, 2)], { type: 'application/json' }));
            a2.download = `${name || file}.json`; a2.click(); URL.revokeObjectURL(a2.href);
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
                const dt = new DataTransfer(); dt.items.add(pngFile);
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
        if (!t) { t = document.createElement('div'); t.id = 'sp-toast'; document.documentElement.appendChild(t); }
        t.textContent = msg;
        t.className = isError ? 'sp-toast-error' : '';
        t.classList.add('sp-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('sp-toast-show'), 2800);
    }

    // ─── 페르소나 버튼 감지 ──────────────────────────────────────────────────
    //
    // ★ 방법 1: touchstart (passive:false) — 모바일에서 가장 먼저 발생
    // ★ 방법 2: click — 데스크톱 및 일부 모바일 브라우저 백업
    // ★ 방법 3: MutationObserver — #PersonaManagement가 openDrawer 클래스를
    //   얻으면 즉시 제거 (이벤트 차단이 실패해도 패널이 보이지 않게 함)

    function isPersonaTarget(el) {
        return !!el?.closest('[data-i18n="[title]Persona Management"], [title="Persona Management"], [title="페르소나 관리"]');
    }

    // touchstart: passive:false 필수 (이래야 preventDefault가 실제로 작동함)
    window.addEventListener('touchstart', e => {
        if (!isPersonaTarget(e.target) || !isEnabled()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        openModal();
    }, { capture: true, passive: false });

    // click 백업
    window.addEventListener('click', e => {
        if (!isPersonaTarget(e.target) || !isEnabled()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        openModal();
    }, { capture: true });

    // MutationObserver 백업: 이벤트 차단이 실패해도 패널 열림 자체를 막음
    function watchPersonaPanel() {
        const panel = document.getElementById('PersonaManagement');
        if (!panel || panel.dataset.spWatch) return;
        panel.dataset.spWatch = '1';
        new MutationObserver(() => {
            if (panel.classList.contains('openDrawer') && isEnabled()) {
                panel.classList.remove('openDrawer');
                if (document.getElementById('sp-overlay')?.style.display !== 'flex') openModal();
            }
        }).observe(panel, { attributes: true, attributeFilter: ['class'] });
    }

    // ─── 설정 UI 주입 ────────────────────────────────────────────────────────

    function injectSettings() {
        if (document.getElementById('sp-settings-block')) return true;
        const container = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
        if (!container) return false;

        const block = document.createElement('div');
        block.id = 'sp-settings-block';
        block.innerHTML = `
            <div class="sp-drawer-toggle">
                <b>Simple Persona</b>
                <i class="fa-solid fa-circle-chevron-down sp-drawer-icon"></i>
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
            icon.className = `fa-solid ${opening ? 'fa-circle-chevron-up' : 'fa-circle-chevron-down'} sp-drawer-icon`;
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
        watchPersonaPanel();

        // PersonaManagement 패널이 아직 없으면 생길 때 감시
        if (!document.getElementById('PersonaManagement')) {
            const obs = new MutationObserver(() => {
                if (document.getElementById('PersonaManagement')) { watchPersonaPanel(); obs.disconnect(); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

        // 설정 UI: 1초마다 최대 30회 시도
        let tries = 0;
        const t = setInterval(() => { if (injectSettings() || ++tries > 30) clearInterval(t); }, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
