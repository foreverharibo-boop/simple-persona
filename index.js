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
        if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = { enabled: true };
        if (extension_settings[MODULE_NAME].enabled === undefined) extension_settings[MODULE_NAME].enabled = true;
        return extension_settings[MODULE_NAME];
    }
    function isEnabled() { return getSettings().enabled !== false; }
    function applyEnabledState() { document.body.classList.toggle('sp-active', isEnabled()); }

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
            return (await getUserAvatars(false)).map(f => ({
                file: f, name: getPersonaName(f), memo: getPersonaMemo(f),
            }));
        } catch {
            const r = [];
            document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
                const f = el.dataset.avatarId ?? el.getAttribute('data-avatar-id') ?? '';
                if (f) r.push({ file: f, name: el.querySelector('.ch_name')?.textContent?.trim() ?? f, memo: el.querySelector('.ch_additional_info')?.textContent?.trim() ?? '' });
            });
            return r;
        }
    }

    function h(s) {
        return String(s ?? '').replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
        );
    }

    // ─── 모달 HTML ───────────────────────────────────────────────────────────

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.style.cssText = `
            position:fixed!important;top:0!important;left:0!important;
            right:0!important;bottom:0!important;
            width:100vw!important;height:100vh!important;
            z-index:2147483647!important;background:transparent!important;
            display:none;align-items:center!important;justify-content:center!important;
        `;
        overlay.innerHTML = `
        <div id="sp-modal">
            <!-- 헤더 -->
            <div id="sp-header">
                <span id="sp-title">페르소나</span>
                <button id="sp-close">✕</button>
            </div>

            <!-- 액션 버튼 행 (목업과 동일) -->
            <div id="sp-action-bar">
                <button class="sp-action-btn" id="sp-btn-new" title="새 페르소나 만들기">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><line x1="12" y1="3" x2="12" y2="13"/><line x1="9" y1="6" x2="15" y2="6"/></svg>
                    <span>만들기</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-import" title="불러오기">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>불러오기</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-export" title="현재 페르소나 내보내기">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>내보내기</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-edit" title="현재 페르소나 수정">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span>수정</span>
                </button>
            </div>

            <!-- 현재 페르소나 -->
            <div id="sp-current">
                <img id="sp-current-avatar" src="img/user-default.png" alt="" />
                <div id="sp-current-info">
                    <div id="sp-current-name">—</div>
                    <div id="sp-current-sub">현재 선택된 페르소나</div>
                </div>
            </div>

            <!-- 검색 -->
            <div id="sp-toolbar">
                <div id="sp-search-wrap">
                    <svg class="sp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input id="sp-search" type="text" placeholder="페르소나 검색..." />
                </div>
            </div>

            <!-- 그리드 -->
            <div id="sp-grid"></div>

            <!-- 숨겨진 파일 입력 -->
            <input type="file" id="sp-import-file" accept=".json,.png" style="display:none" multiple />
            <input type="file" id="sp-new-avatar-file" accept="image/*" style="display:none" />
        </div>`;
        return overlay;
    }

    // ─── 그리드 ──────────────────────────────────────────────────────────────

    async function renderGrid(filter = '') {
        const grid = document.getElementById('sp-grid');
        if (!grid) return;
        let entries = await listPersonas();
        const cur = getCurrentPersona();
        const q = filter.trim().toLowerCase();
        if (q) entries = entries.filter(e => e.name.toLowerCase().includes(q) || e.memo.toLowerCase().includes(q));
        grid.innerHTML = '';
        if (!entries.length) { grid.innerHTML = '<div id="sp-empty">페르소나가 없습니다.</div>'; return; }
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
                    <button class="sp-card-btn sp-card-edit" data-file="${h(file)}" title="수정">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
        const f = getCurrentPersona();
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        if (imgEl) imgEl.src = getAvatarUrl(f);
        if (nameEl) nameEl.textContent = f ? getPersonaName(f) : '없음';
    }

    // ─── 다이얼로그: 공통 ────────────────────────────────────────────────────

    function closeDialog() {
        document.querySelector('.sp-dialog')?.remove();
    }

    // ─── 다이얼로그: 새 페르소나 만들기 ─────────────────────────────────────

    function openCreateDialog() {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;

        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>새 페르소나 만들기</h3>
                <button id="sp-dlg-close" class="sp-btn-secondary" style="flex:none;width:30px;height:30px;padding:0;border-radius:50%;">✕</button>
            </div>
            <div class="sp-dialog-body">
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                    <img id="sp-new-preview" src="img/user-default.png"
                         class="sp-dialog-avatar-preview" title="클릭하여 이미지 선택" />
                    <small style="opacity:0.55;font-size:0.72rem;">아바타 이미지 (탭하여 선택)</small>
                </div>
                <div class="sp-dialog-label">
                    <span>이름 *</span>
                    <input id="sp-new-name" type="text" class="sp-dialog-input" placeholder="페르소나 이름" />
                </div>
                <div class="sp-dialog-label">
                    <span>설명 (선택사항)</span>
                    <textarea id="sp-new-desc" class="sp-dialog-textarea" placeholder="페르소나 설명 또는 시스템 프롬프트"></textarea>
                </div>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary" id="sp-new-cancel">취소</button>
                <button class="sp-btn-primary" id="sp-new-confirm">만들기</button>
            </div>`;
        modal.appendChild(dlg);

        let selectedFile = null;

        // 아바타 클릭 → 파일 선택
        dlg.querySelector('#sp-new-preview').addEventListener('click', () => {
            const input = document.getElementById('sp-new-avatar-file');
            if (input) input.click();
        });
        document.getElementById('sp-new-avatar-file')?.addEventListener('change', e => {
            const f = e.target.files?.[0];
            if (!f) return;
            selectedFile = f;
            const reader = new FileReader();
            reader.onload = ev => {
                const preview = dlg.querySelector('#sp-new-preview');
                if (preview) preview.src = ev.target.result;
            };
            reader.readAsDataURL(f);
            e.target.value = '';
        });

        dlg.querySelector('#sp-dlg-close').addEventListener('click', closeDialog);
        dlg.querySelector('#sp-new-cancel').addEventListener('click', closeDialog);

        dlg.querySelector('#sp-new-confirm').addEventListener('click', async () => {
            const name = dlg.querySelector('#sp-new-name').value.trim();
            const desc = dlg.querySelector('#sp-new-desc').value.trim();
            if (!name) { showToast('이름을 입력해주세요.', true); return; }
            if (!selectedFile) { showToast('아바타 이미지를 선택해주세요.', true); return; }

            // ST 업로드 폼 사용
            const nativeInput = document.querySelector('#form_upload_avatar input[type="file"]');
            if (!nativeInput) { showToast('업로드 폼을 찾을 수 없습니다.', true); return; }

            const dt = new DataTransfer();
            dt.items.add(selectedFile);
            nativeInput.files = dt.files;
            nativeInput.dispatchEvent(new Event('change', { bubbles: true }));

            showToast('업로드 중...');

            // 업로드 완료 대기 후 이름/설명 등록
            setTimeout(() => {
                const fileName = selectedFile.name;
                if (!power_user.personas) power_user.personas = {};
                power_user.personas[fileName] = name;
                if (desc) {
                    if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
                    power_user.persona_descriptions[fileName] = { description: desc, position: 0 };
                }
                saveSettingsDebounced();
                closeDialog();
                renderGrid(document.getElementById('sp-search')?.value ?? '');
                showToast(`"${name}" 페르소나 생성 완료!`);
            }, 1200);
        });
    }

    // ─── 다이얼로그: 페르소나 수정 ───────────────────────────────────────────

    function openEditDialog(file) {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;

        const name = getPersonaName(file);
        const desc = power_user.persona_descriptions?.[file]?.description ?? '';
        const position = power_user.persona_descriptions?.[file]?.position ?? 0;

        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>페르소나 수정</h3>
                <button id="sp-dlg-close" class="sp-btn-secondary" style="flex:none;width:30px;height:30px;padding:0;border-radius:50%;">✕</button>
            </div>
            <div class="sp-dialog-body">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
                    <img src="${getAvatarUrl(file)}" class="sp-dialog-avatar-preview" style="cursor:default;" />
                    <span style="font-size:0.85rem;opacity:0.6;">${h(file)}</span>
                </div>
                <div class="sp-dialog-label">
                    <span>이름</span>
                    <input id="sp-edit-name" type="text" class="sp-dialog-input" value="${h(name)}" />
                </div>
                <div class="sp-dialog-label">
                    <span>설명 / 시스템 프롬프트</span>
                    <textarea id="sp-edit-desc" class="sp-dialog-textarea">${h(desc)}</textarea>
                </div>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary" id="sp-edit-cancel">취소</button>
                <button class="sp-btn-primary" id="sp-edit-confirm">저장</button>
            </div>`;
        modal.appendChild(dlg);

        dlg.querySelector('#sp-dlg-close').addEventListener('click', closeDialog);
        dlg.querySelector('#sp-edit-cancel').addEventListener('click', closeDialog);
        dlg.querySelector('#sp-edit-confirm').addEventListener('click', () => {
            const newName = dlg.querySelector('#sp-edit-name').value.trim();
            const newDesc = dlg.querySelector('#sp-edit-desc').value;
            if (!newName) { showToast('이름을 입력해주세요.', true); return; }

            if (!power_user.personas) power_user.personas = {};
            power_user.personas[file] = newName;

            if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
            power_user.persona_descriptions[file] = { description: newDesc, position };

            saveSettingsDebounced();
            closeDialog();
            updateCurrentBanner();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast('저장 완료!');
        });
    }

    // ─── 내보내기 ────────────────────────────────────────────────────────────

    async function exportPersona(file) {
        try {
            const name = getPersonaName(file);
            // PNG 다운로드
            const res = await fetch(getAvatarUrl(file));
            if (res.ok) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(await res.blob());
                a.download = file.includes('.') ? file : `${file}.png`;
                a.click(); URL.revokeObjectURL(a.href);
            }
            // JSON 메타데이터 다운로드
            const desc = power_user.persona_descriptions?.[file];
            const data = { file, name, description: desc?.description ?? '', position: desc?.position ?? 0 };
            const a2 = document.createElement('a');
            a2.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a2.download = `${name || file}.json`;
            a2.click(); URL.revokeObjectURL(a2.href);
            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) { showToast('내보내기 실패: ' + e.message, true); }
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
            const input = document.querySelector('#form_upload_avatar input[type="file"]');
            if (input) {
                const dt = new DataTransfer(); dt.items.add(pngFile);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                showToast(`"${pngFile.name}" 불러오는 중...`);
            }
        }
        setTimeout(() => {
            if (jsonData?.file) {
                if (jsonData.name) {
                    if (!power_user.personas) power_user.personas = {};
                    power_user.personas[jsonData.file] = jsonData.name;
                }
                if (jsonData.description !== undefined) {
                    if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
                    power_user.persona_descriptions[jsonData.file] = { description: jsonData.description, position: jsonData.position ?? 0 };
                }
            }
            saveSettingsDebounced();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast('불러오기 완료!');
        }, 1000);
    }

    // ─── 토스트 ──────────────────────────────────────────────────────────────

    function showToast(msg, isError = false) {
        let t = document.getElementById('sp-toast');
        if (!t) { t = document.createElement('div'); t.id = 'sp-toast'; document.documentElement.appendChild(t); }
        t.textContent = msg;
        t.className = isError ? 'sp-toast-error' : '';
        t.classList.add('sp-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('sp-toast-show'), 2800);
    }

    // ─── 열기 / 닫기 ─────────────────────────────────────────────────────────

    let _openedAt = 0;

    function openModal() {
        let overlay = document.getElementById('sp-overlay');
        if (!overlay) {
            overlay = buildModal();
            document.documentElement.appendChild(overlay);
            bindModalEvents(overlay);
        }
        overlay.classList.add('sp-visible');
        overlay.style.display = 'flex';
        _openedAt = Date.now();
        updateCurrentBanner();
        renderGrid();
    }

    function closeModal() {
        const overlay = document.getElementById('sp-overlay');
        if (!overlay) return;
        closeDialog();
        overlay.classList.remove('sp-visible');
        overlay.style.display = 'none';
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay && Date.now() - _openedAt > 400) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        // 액션 버튼 행
        overlay.querySelector('#sp-btn-new')?.addEventListener('click', openCreateDialog);
        overlay.querySelector('#sp-btn-edit')?.addEventListener('click', () => {
            const cur = getCurrentPersona();
            if (cur) openEditDialog(cur);
            else showToast('먼저 페르소나를 선택해주세요.', true);
        });
        overlay.querySelector('#sp-btn-export')?.addEventListener('click', () => {
            const cur = getCurrentPersona();
            if (cur) exportPersona(cur);
            else showToast('먼저 페르소나를 선택해주세요.', true);
        });
        overlay.querySelector('#sp-btn-import')?.addEventListener('click', () => {
            overlay.querySelector('#sp-import-file')?.click();
        });
        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        // 그리드 카드 클릭
        overlay.querySelector('#sp-grid')?.addEventListener('click', async e => {
            const editBtn = e.target.closest('.sp-card-edit');
            const exportBtn = e.target.closest('.sp-card-export');
            const selectBtn = e.target.closest('.sp-card-select');
            const card = e.target.closest('.sp-card');

            if (editBtn) {
                openEditDialog(editBtn.dataset.file);
            } else if (exportBtn) {
                exportPersona(exportBtn.dataset.file);
            } else if (selectBtn || card) {
                const file = selectBtn?.dataset.file ?? card?.dataset.file;
                if (file) {
                    await setUserAvatar(file);
                    updateCurrentBanner();
                    renderGrid(document.getElementById('sp-search')?.value ?? '');
                }
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && document.getElementById('sp-overlay')?.style.display === 'flex') {
                if (document.querySelector('.sp-dialog')) closeDialog();
                else closeModal();
            }
        });
    }

    // ─── 페르소나 버튼 감지 ──────────────────────────────────────────────────

    function isPersonaTarget(el) {
        return !!el?.closest('[data-i18n="[title]Persona Management"], [title="Persona Management"], [title="페르소나 관리"]');
    }

    window.addEventListener('touchstart', e => {
        if (!isPersonaTarget(e.target) || !isEnabled()) return;
        e.preventDefault(); e.stopImmediatePropagation(); openModal();
    }, { capture: true, passive: false });

    window.addEventListener('click', e => {
        if (!isPersonaTarget(e.target) || !isEnabled()) return;
        e.preventDefault(); e.stopImmediatePropagation(); openModal();
    }, { capture: true });

    // MutationObserver 백업
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

    // ─── 확장 탭 설정 UI ─────────────────────────────────────────────────────

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
        getSettings(); applyEnabledState();
        watchPersonaPanel();
        if (!document.getElementById('PersonaManagement')) {
            const obs = new MutationObserver(() => {
                if (document.getElementById('PersonaManagement')) { watchPersonaPanel(); obs.disconnect(); }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
        let tries = 0;
        const t = setInterval(() => { if (injectSettings() || ++tries > 30) clearInterval(t); }, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
