// Simple Persona — Persona Manager
import { power_user } from '../../../power-user.js';
import { getUserAvatars, setUserAvatar, user_avatar } from '../../../personas.js';
import { getThumbnailUrl, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const MODULE_NAME = 'simple-persona';

(function () {
    'use strict';

    // ─── 설정 ────────────────────────────────────────────────────────────────

    function getSettings() {
        if (!extension_settings[MODULE_NAME]) extension_settings[MODULE_NAME] = { enabled: true, favorites: {}, groups: {} };
        if (extension_settings[MODULE_NAME].enabled === undefined) extension_settings[MODULE_NAME].enabled = true;
        if (!extension_settings[MODULE_NAME].favorites) extension_settings[MODULE_NAME].favorites = {};
        if (!extension_settings[MODULE_NAME].groups) extension_settings[MODULE_NAME].groups = {};
        return extension_settings[MODULE_NAME];
    }
    function isEnabled() { return getSettings().enabled !== false; }
    function applyEnabledState() { document.body.classList.toggle('sp-active', isEnabled()); }

    // ─── 데이터 ──────────────────────────────────────────────────────────────

    function getCurrentPersona() { return user_avatar ?? null; }
    function getPersonaName(f) { return power_user.personas?.[f] ?? f; }
    function getPersonaMemo(f) {
        return power_user.persona_descriptions?.[f]?.description
            ?? document.querySelector(`#user_avatar_block [data-avatar-id="${CSS.escape(f)}"] .ch_additional_info`)?.textContent?.trim()
            ?? '';
    }
    function getDefaultPersona() { return power_user.default_persona ?? null; }
    function getPersonaGroups() { return getSettings().groups ?? {}; }
    function getFavorites() { return getSettings().favorites ?? {}; }
    function isFavorite(f) { return !!getFavorites()[f]; }
    function toggleFavorite(f) {
        const s = getSettings();
        if (s.favorites[f]) delete s.favorites[f];
        else s.favorites[f] = true;
        saveSettingsDebounced();
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
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }

    // ─── 정렬 ────────────────────────────────────────────────────────────────

    let _sortMode = 'name-asc';
    let _viewGrid = true;

    function sortPersonas(list) {
        const fav = getFavorites();
        switch (_sortMode) {
            case 'name-asc':  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            case 'name-desc': return [...list].sort((a, b) => b.name.localeCompare(a.name, 'ko'));
            case 'fav-first': return [...list].sort((a, b) => (!!fav[b.file] - !!fav[a.file]) || a.name.localeCompare(b.name, 'ko'));
            default: return list;
        }
    }

    // ─── 모달 HTML ───────────────────────────────────────────────────────────

    const SVG = {
        newPerson: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><line x1="19" y1="3" x2="19" y2="9"/><line x1="16" y1="6" x2="22" y2="6"/></svg>`,
        import:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
        export:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        edit:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
        group:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        more:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>`,
        chat:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        persons:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
        crown:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V10l7-6 7 6v10"/><polyline points="5 10 12 4 19 10"/></svg>`,
        lock:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
        trash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        star:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        folder:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
        search:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        sortDown:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`,
        grid:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
        check:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        gear:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    };

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.innerHTML = `
        <div id="sp-modal">
            <!-- 헤더 -->
            <div id="sp-header">
                <div id="sp-header-text">
                    <span id="sp-title">Persona</span>
                </div>
                <button id="sp-close">✕</button>
            </div>

            <!-- 액션 버튼 행 -->
            <div id="sp-action-bar">
                <button class="sp-action-btn" id="sp-btn-new" title="새 페르소나 만들기">
                    ${SVG.newPerson}<span>New</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-import" title="페르소나 불러오기">
                    ${SVG.import}<span>Import</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-export" title="현재 페르소나 내보내기">
                    ${SVG.export}<span>Export</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-edit" title="현재 페르소나 수정">
                    ${SVG.edit}<span>Edit</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-group" title="그룹 관리">
                    ${SVG.group}<span>Group</span>
                </button>
                <button class="sp-action-btn" id="sp-btn-more" title="더보기">
                    ${SVG.more}<span>More</span>
                </button>
            </div>

            <!-- 현재 페르소나 배너 -->
            <div id="sp-current">
                <img id="sp-current-avatar" src="img/user-default.png" alt="" />
                <div id="sp-current-info">
                    <div id="sp-current-name">—</div>
                    <div id="sp-current-sub">티커</div>
                </div>
                <div id="sp-current-actions">
                    <button class="sp-cur-btn" id="sp-cur-chat" title="채팅에 적용">${SVG.chat}</button>
                    <button class="sp-cur-btn" id="sp-cur-lock" title="페르소나 잠금">${SVG.lock}</button>
                    <button class="sp-cur-btn" id="sp-cur-default" title="기본 페르소나 설정">${SVG.crown}</button>
                </div>
            </div>

            <!-- 검색 + 정렬 툴바 -->
            <div id="sp-toolbar">
                <div id="sp-search-wrap">
                    <span class="sp-search-icon">${SVG.search}</span>
                    <input id="sp-search" type="text" placeholder="Search personas..." />
                </div>
                <div id="sp-sort-wrap">
                    <select id="sp-sort">
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                        <option value="fav-first">즐겨찾기 우선</option>
                    </select>
                    <span class="sp-sort-arrow">${SVG.sortDown}</span>
                </div>
                <button class="sp-toolbar-icon-btn" id="sp-btn-folder" title="그룹에 추가">${SVG.folder}</button>
                <button class="sp-toolbar-icon-btn" id="sp-btn-view" title="뷰 전환">${SVG.grid}</button>
            </div>

            <!-- 그리드 -->
            <div id="sp-grid"></div>

            <!-- 푸터 -->
            <div id="sp-footer">
                <span id="sp-count">0 personas</span>
                <button class="sp-footer-icon-btn" id="sp-btn-settings" title="설정">${SVG.gear}</button>
            </div>

            <!-- 숨겨진 파일 입력 -->
            <input type="file" id="sp-import-file" accept=".json,.png" multiple />
            <input type="file" id="sp-new-avatar-file" accept="image/*" />
            <input type="file" id="sp-edit-avatar-file" accept="image/*" />
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
        entries = sortPersonas(entries);

        // 카운트 업데이트
        const countEl = document.getElementById('sp-count');
        if (countEl) countEl.textContent = `${entries.length} persona${entries.length !== 1 ? 's' : ''}`;

        grid.innerHTML = '';
        if (!entries.length) {
            grid.innerHTML = '<div id="sp-empty">페르소나가 없습니다.</div>';
            return;
        }

        const defPersona = getDefaultPersona();

        for (const { file, name, memo } of entries) {
            const isActive = file === cur;
            const isFav = isFavorite(file);
            const isDef = file === defPersona;
            const card = document.createElement('div');
            card.className = 'sp-card' + (isActive ? ' sp-card--active' : '');
            card.dataset.file = file;
            card.innerHTML = `
                <div class="sp-card-img-wrap">
                    <img class="sp-card-img" src="${getAvatarUrl(file)}" alt="${h(name)}" loading="lazy" />
                    <button class="sp-card-star${isFav ? ' starred' : ''}" data-file="${h(file)}" title="즐겨찾기">
                        ${SVG.star}
                    </button>
                    ${isDef ? `<div class="sp-card-badge" title="기본 페르소나" style="background:#f59e0b;">${SVG.crown}</div>` : ''}
                </div>
                <div class="sp-card-name">${h(name)}</div>
                ${memo ? `<div class="sp-card-sub">${h(memo)}</div>` : ''}
                <div class="sp-card-actions">
                    <button class="sp-card-btn sp-card-edit" data-file="${h(file)}" title="수정">${SVG.edit}</button>
                    <button class="sp-card-btn sp-card-export" data-file="${h(file)}" title="내보내기">${SVG.export}</button>
                    <button class="sp-card-btn sp-card-delete" data-file="${h(file)}" title="삭제">${SVG.trash}</button>
                </div>`;
            grid.appendChild(card);
        }
    }

    // ─── 배너 업데이트 ───────────────────────────────────────────────────────

    function updateCurrentBanner() {
        const f = getCurrentPersona();
        const imgEl = document.getElementById('sp-current-avatar');
        const nameEl = document.getElementById('sp-current-name');
        const subEl = document.getElementById('sp-current-sub');
        if (imgEl) imgEl.src = getAvatarUrl(f);
        if (nameEl) nameEl.textContent = f ? getPersonaName(f) : '선택 없음';
        if (subEl) subEl.textContent = f ? (getPersonaMemo(f) || '페르소나') : '현재 선택된 페르소나';

        // 기본 페르소나 버튼 하이라이트
        const defBtn = document.getElementById('sp-cur-default');
        if (defBtn) defBtn.style.color = f && f === getDefaultPersona() ? 'var(--SmartThemeQuoteColor, #f59e0b)' : '';
    }

    // ─── 다이얼로그: 공통 닫기 ──────────────────────────────────────────────

    function closeDialog() {
        document.querySelector('.sp-dialog')?.remove();
        document.querySelector('.sp-confirm-dialog')?.remove();
    }

    // ─── 다이얼로그: 새 페르소나 ─────────────────────────────────────────────

    function openCreateDialog() {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>새 페르소나 만들기</h3>
                <button class="sp-dialog-close-btn sp-dlg-close">✕</button>
            </div>
            <div class="sp-dialog-body">
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                    <img id="sp-new-preview" src="img/user-default.png" class="sp-dialog-avatar-preview" title="탭하여 이미지 선택" />
                    <small style="opacity:0.45;font-size:0.72rem;">아바타 이미지 (탭하여 선택)</small>
                </div>
                <div class="sp-dialog-label">
                    <span>이름 *</span>
                    <input id="sp-new-name" type="text" class="sp-dialog-input" placeholder="페르소나 이름" />
                </div>
                <div class="sp-dialog-label">
                    <span>설명 / 시스템 프롬프트 (선택)</span>
                    <textarea id="sp-new-desc" class="sp-dialog-textarea" placeholder="페르소나 배경, 성격, 시스템 프롬프트..."></textarea>
                </div>
                <div class="sp-dialog-label">
                    <span>프롬프트 삽입 위치</span>
                    <select id="sp-new-pos" class="sp-dialog-select">
                        <option value="0">채팅 시작 위치 (position: 0)</option>
                        <option value="1">채팅 끝 위치 (position: 1)</option>
                    </select>
                </div>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary sp-dlg-close">취소</button>
                <button class="sp-btn-primary" id="sp-new-confirm">만들기</button>
            </div>`;
        modal.appendChild(dlg);
        let selectedFile = null;

        dlg.querySelector('#sp-new-preview').addEventListener('click', () => {
            document.getElementById('sp-new-avatar-file')?.click();
        });
        document.getElementById('sp-new-avatar-file').onchange = (e) => {
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
        };
        dlg.querySelectorAll('.sp-dlg-close').forEach(b => b.addEventListener('click', closeDialog));
        dlg.querySelector('#sp-new-confirm').addEventListener('click', async () => {
            const name = dlg.querySelector('#sp-new-name').value.trim();
            const desc = dlg.querySelector('#sp-new-desc').value.trim();
            const pos = parseInt(dlg.querySelector('#sp-new-pos').value);
            if (!name) { showToast('이름을 입력해주세요.', true); return; }
            if (!selectedFile) { showToast('아바타 이미지를 선택해주세요.', true); return; }

            const nativeInput = document.querySelector('#form_upload_avatar input[type="file"]');
            if (!nativeInput) { showToast('업로드 폼을 찾을 수 없습니다.', true); return; }

            showToast('업로드 중...');

            // ★ 폴링 방식으로 새 파일 감지 (MutationObserver보다 안정적)
            // ST는 업로드 시 타임스탬프를 붙여 파일명을 바꾸므로
            // selectedFile.name으로 등록하면 안 됨. 두 가지 신호를 동시에 감시:
            // 1) getUserAvatars() 목록에 새 파일이 추가됨
            // 2) user_avatar(현재 선택)가 새 파일로 자동 전환됨 (ST가 흔히 이렇게 동작)
            const existingFiles = new Set(await getUserAvatars(false).catch(() => []));

            let registered = false;
            let pollCount = 0;
            const pollTimer = setInterval(async () => {
                if (registered) { clearInterval(pollTimer); return; }
                pollCount++;

                let newFile = null;
                // 신호 1: user_avatar가 목록에 없던 새 파일로 바뀜
                if (user_avatar && !existingFiles.has(user_avatar)) newFile = user_avatar;
                // 신호 2: getUserAvatars 목록에 새 파일 등장
                if (!newFile) {
                    const current = await getUserAvatars(false).catch(() => []);
                    newFile = current.find(f => !existingFiles.has(f)) ?? null;
                }

                if (newFile) {
                    registered = true;
                    clearInterval(pollTimer);
                    if (!power_user.personas) power_user.personas = {};
                    power_user.personas[newFile] = name;
                    if (desc) {
                        if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
                        power_user.persona_descriptions[newFile] = { description: desc, position: pos };
                    }
                    saveSettingsDebounced();
                    closeDialog();
                    renderGrid(document.getElementById('sp-search')?.value ?? '');
                    showToast(`"${name}" 페르소나 생성 완료!`);
                } else if (pollCount > 40) { // 40 × 400ms = 16초 타임아웃
                    clearInterval(pollTimer);
                    showToast('업로드는 됐지만 자동 등록에 실패했습니다. 목록에서 새 카드를 "수정"으로 이름을 설정해주세요.', true);
                    closeDialog();
                    renderGrid(document.getElementById('sp-search')?.value ?? '');
                }
            }, 400);

            // 업로드 트리거
            const dt = new DataTransfer();
            dt.items.add(selectedFile);
            nativeInput.files = dt.files;
            nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    // ─── 다이얼로그: 수정 ────────────────────────────────────────────────────

    function openEditDialog(file) {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        const name = getPersonaName(file);
        const desc = power_user.persona_descriptions?.[file]?.description ?? '';
        const pos = power_user.persona_descriptions?.[file]?.position ?? 0;

        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>페르소나 수정</h3>
                <button class="sp-dialog-close-btn sp-dlg-close">✕</button>
            </div>
            <div class="sp-dialog-body">
                <div style="display:flex;align-items:center;gap:14px;">
                    <img id="sp-edit-preview" src="${h(getAvatarUrl(file))}" class="sp-dialog-avatar-preview" title="탭하여 이미지 교체" />
                    <div>
                        <div style="font-size:0.8rem;font-weight:600;color:var(--SmartThemeBodyColor,#111);">${h(file)}</div>
                        <div style="font-size:0.72rem;opacity:0.45;margin-top:3px;">탭하여 아바타 교체</div>
                    </div>
                </div>
                <div class="sp-dialog-label">
                    <span>이름</span>
                    <input id="sp-edit-name" type="text" class="sp-dialog-input" value="${h(name)}" />
                </div>
                <div class="sp-dialog-label">
                    <span>설명 / 시스템 프롬프트</span>
                    <textarea id="sp-edit-desc" class="sp-dialog-textarea">${h(desc)}</textarea>
                </div>
                <div class="sp-dialog-label">
                    <span>프롬프트 삽입 위치</span>
                    <select id="sp-edit-pos" class="sp-dialog-select">
                        <option value="0" ${pos === 0 ? 'selected' : ''}>채팅 시작 위치</option>
                        <option value="1" ${pos === 1 ? 'selected' : ''}>채팅 끝 위치</option>
                    </select>
                </div>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary sp-dlg-close">취소</button>
                <button class="sp-btn-primary" id="sp-edit-confirm">저장</button>
            </div>`;
        modal.appendChild(dlg);

        dlg.querySelector('#sp-edit-preview').addEventListener('click', () => {
            document.getElementById('sp-edit-avatar-file')?.click();
        });
        document.getElementById('sp-edit-avatar-file').onchange = (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const preview = dlg.querySelector('#sp-edit-preview');
                if (preview) preview.src = ev.target.result;
            };
            reader.readAsDataURL(f);
            // 업로드 처리
            const nativeInput = document.querySelector('#form_upload_avatar input[type="file"]');
            if (nativeInput) {
                const dt = new DataTransfer(); dt.items.add(f);
                nativeInput.files = dt.files;
                nativeInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            e.target.value = '';
        };
        dlg.querySelectorAll('.sp-dlg-close').forEach(b => b.addEventListener('click', closeDialog));
        dlg.querySelector('#sp-edit-confirm').addEventListener('click', () => {
            const newName = dlg.querySelector('#sp-edit-name').value.trim();
            const newDesc = dlg.querySelector('#sp-edit-desc').value;
            const newPos = parseInt(dlg.querySelector('#sp-edit-pos').value);
            if (!newName) { showToast('이름을 입력해주세요.', true); return; }
            if (!power_user.personas) power_user.personas = {};
            power_user.personas[file] = newName;
            if (!power_user.persona_descriptions) power_user.persona_descriptions = {};
            power_user.persona_descriptions[file] = { description: newDesc, position: newPos };
            saveSettingsDebounced();
            closeDialog();
            updateCurrentBanner();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast('저장 완료!');
        });
    }

    // ─── 다이얼로그: 그룹 관리 ──────────────────────────────────────────────

    function openGroupDialog() {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        const groups = getPersonaGroups();
        const groupNames = Object.keys(groups);

        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        const listHTML = groupNames.length
            ? groupNames.map(g => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--SmartThemeBorderColor,rgba(0,0,0,0.07));">
                    <span style="flex:1;font-size:0.875rem;">${h(g)}</span>
                    <button class="sp-card-btn sp-group-delete" data-group="${h(g)}" title="삭제">${SVG.trash}</button>
                </div>`).join('')
            : '<div style="opacity:0.4;font-size:0.85rem;padding:16px 0;text-align:center;">그룹이 없습니다.</div>';

        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>그룹 관리</h3>
                <button class="sp-dialog-close-btn sp-dlg-close">✕</button>
            </div>
            <div class="sp-dialog-body">
                <div class="sp-dialog-label">
                    <span>새 그룹 이름</span>
                    <div style="display:flex;gap:8px;">
                        <input id="sp-group-name" type="text" class="sp-dialog-input" placeholder="그룹 이름..." style="flex:1;" />
                        <button class="sp-btn-primary" id="sp-group-add" style="flex:none;padding:0 16px;">추가</button>
                    </div>
                </div>
                <div id="sp-group-list">${listHTML}</div>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary sp-dlg-close">닫기</button>
            </div>`;
        modal.appendChild(dlg);
        dlg.querySelectorAll('.sp-dlg-close').forEach(b => b.addEventListener('click', closeDialog));
        dlg.querySelector('#sp-group-add').addEventListener('click', () => {
            const name = dlg.querySelector('#sp-group-name').value.trim();
            if (!name) { showToast('그룹 이름을 입력해주세요.', true); return; }
            const s = getSettings();
            s.groups[name] = s.groups[name] ?? [];
            saveSettingsDebounced();
            showToast(`"${name}" 그룹 추가!`);
            openGroupDialog();
        });
        dlg.querySelector('#sp-group-list')?.addEventListener('click', e => {
            const del = e.target.closest('.sp-group-delete');
            if (del) {
                const g = del.dataset.group;
                delete getSettings().groups[g];
                saveSettingsDebounced();
                showToast(`"${g}" 그룹 삭제!`);
                openGroupDialog();
            }
        });
    }

    // ─── 더보기 메뉴 ─────────────────────────────────────────────────────────

    function openMoreMenu() {
        closeDialog();
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        const cur = getCurrentPersona();
        const isDef = cur && cur === getDefaultPersona();

        const dlg = document.createElement('div');
        dlg.className = 'sp-dialog';
        dlg.innerHTML = `
            <div class="sp-dialog-header">
                <h3>더보기</h3>
                <button class="sp-dialog-close-btn sp-dlg-close">✕</button>
            </div>
            <div class="sp-dialog-body" style="gap:8px;">
                <button class="sp-btn-secondary" id="sp-more-setdefault" style="text-align:left;padding:12px 14px;">
                    ${SVG.crown}&nbsp;&nbsp;${isDef ? '기본 페르소나 해제' : '기본 페르소나로 설정'}
                </button>
                <button class="sp-btn-secondary" id="sp-more-lock" style="text-align:left;padding:12px 14px;">
                    ${SVG.lock}&nbsp;&nbsp;페르소나 잠금 (현재 채팅에 고정)
                </button>
                <button class="sp-btn-secondary" id="sp-more-exportall" style="text-align:left;padding:12px 14px;">
                    ${SVG.export}&nbsp;&nbsp;전체 페르소나 메타데이터 내보내기 (JSON)
                </button>
                <hr style="border:none;border-top:1px solid var(--SmartThemeBorderColor,rgba(0,0,0,0.08));margin:4px 0;">
                <button class="sp-btn-secondary" id="sp-more-disable" style="text-align:left;padding:12px 14px;color:#ef4444;">
                    Simple Persona 비활성화
                </button>
            </div>
            <div class="sp-dialog-footer">
                <button class="sp-btn-secondary sp-dlg-close">닫기</button>
            </div>`;
        modal.appendChild(dlg);
        dlg.querySelectorAll('.sp-dlg-close').forEach(b => b.addEventListener('click', closeDialog));

        dlg.querySelector('#sp-more-setdefault').addEventListener('click', () => {
            if (!cur) { showToast('먼저 페르소나를 선택해주세요.', true); return; }
            if (isDef) {
                delete power_user.default_persona;
            } else {
                power_user.default_persona = cur;
            }
            saveSettingsDebounced();
            closeDialog();
            updateCurrentBanner();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast(isDef ? '기본 페르소나 해제!' : `"${getPersonaName(cur)}" 기본 페르소나 설정!`);
        });

        dlg.querySelector('#sp-more-lock').addEventListener('click', () => {
            if (!cur) { showToast('먼저 페르소나를 선택해주세요.', true); return; }
            // ST 페르소나 잠금 버튼 트리거
            const lockBtn = document.querySelector('#lock_persona');
            if (lockBtn) lockBtn.click();
            else showToast('현재 채팅에서 페르소나 잠금 적용!');
            closeDialog();
        });

        dlg.querySelector('#sp-more-exportall').addEventListener('click', async () => {
            const entries = await listPersonas();
            const data = entries.map(({ file, name, memo }) => ({
                file, name,
                description: power_user.persona_descriptions?.[file]?.description ?? '',
                position: power_user.persona_descriptions?.[file]?.position ?? 0,
                isDefault: file === getDefaultPersona(),
                isFavorite: isFavorite(file),
            }));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a.download = 'all-personas.json';
            a.click(); URL.revokeObjectURL(a.href);
            showToast('전체 내보내기 완료!');
            closeDialog();
        });

        dlg.querySelector('#sp-more-disable').addEventListener('click', () => {
            getSettings().enabled = false;
            saveSettingsDebounced();
            applyEnabledState();
            closeModal();
            showToast('Simple Persona 비활성화됨.');
        });
    }

    // ─── 삭제 확인 ──────────────────────────────────────────────────────────

    function confirmDelete(file) {
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        const name = getPersonaName(file);

        const conf = document.createElement('div');
        conf.className = 'sp-confirm-dialog';
        conf.innerHTML = `
            <div class="sp-confirm-box">
                <h4>페르소나 삭제</h4>
                <p>"${h(name)}" 를 삭제하시겠습니까?<br>이 작업은 되돌릴 수 없습니다.</p>
                <div class="sp-confirm-btns">
                    <button class="sp-btn-secondary" id="sp-conf-cancel">취소</button>
                    <button class="sp-btn-danger" id="sp-conf-ok">삭제</button>
                </div>
            </div>`;
        modal.appendChild(conf);
        conf.querySelector('#sp-conf-cancel').addEventListener('click', () => conf.remove());
        conf.querySelector('#sp-conf-ok').addEventListener('click', async () => {
            conf.remove();
            // ST 기본 삭제 버튼 트리거
            const nativeCard = document.querySelector(`#user_avatar_block [data-avatar-id="${CSS.escape(file)}"]`);
            const deleteBtn = nativeCard?.querySelector('[data-action="delete"], .avatar_delete');
            if (deleteBtn) {
                deleteBtn.click();
            } else {
                // 메타데이터만 제거
                if (power_user.personas) delete power_user.personas[file];
                if (power_user.persona_descriptions) delete power_user.persona_descriptions[file];
                saveSettingsDebounced();
            }
            if (getCurrentPersona() === file) updateCurrentBanner();
            await renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast(`"${name}" 삭제됨.`);
        });
    }

    // ─── 내보내기 (개별) — 포맷 선택 시트 ─────────────────────────────────

    function showExportSheet(file) {
        const modal = document.getElementById('sp-modal');
        if (!modal) return;
        // 기존 시트 제거
        modal.querySelector('.sp-export-sheet')?.remove();

        const name = getPersonaName(file);
        const sheet = document.createElement('div');
        sheet.className = 'sp-export-sheet';
        sheet.innerHTML = `
            <div class="sp-export-sheet-inner">
                <div class="sp-export-sheet-title">내보내기 형식 선택</div>
                <button class="sp-export-opt-btn" id="sp-exp-both">🖼️ PNG + JSON (전체)</button>
                <button class="sp-export-opt-btn" id="sp-exp-png">🖼️ PNG (이미지만)</button>
                <button class="sp-export-opt-btn" id="sp-exp-json">📄 JSON (메타데이터만)</button>
                <button class="sp-export-cancel-btn" id="sp-exp-cancel">취소</button>
            </div>`;
        modal.appendChild(sheet);

        const remove = () => sheet.remove();
        sheet.querySelector('#sp-exp-cancel').addEventListener('click', remove);
        sheet.addEventListener('click', e => { if (e.target === sheet) remove(); });

        sheet.querySelector('#sp-exp-both').addEventListener('click', async () => {
            remove(); await exportPersonaAs(file, 'both');
        });
        sheet.querySelector('#sp-exp-png').addEventListener('click', async () => {
            remove(); await exportPersonaAs(file, 'png');
        });
        sheet.querySelector('#sp-exp-json').addEventListener('click', async () => {
            remove(); await exportPersonaAs(file, 'json');
        });
    }

    async function exportPersonaAs(file, format) {
        try {
            const name = getPersonaName(file);
            if (format === 'png' || format === 'both') {
                const res = await fetch(getAvatarUrl(file));
                if (res.ok) {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(await res.blob());
                    a.download = file.includes('.') ? file : `${file}.png`;
                    a.click(); URL.revokeObjectURL(a.href);
                }
            }
            if (format === 'json' || format === 'both') {
                const desc = power_user.persona_descriptions?.[file];
                const data = {
                    file, name,
                    description: desc?.description ?? '',
                    position: desc?.position ?? 0,
                    isDefault: file === getDefaultPersona(),
                    isFavorite: isFavorite(file),
                };
                const a2 = document.createElement('a');
                a2.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                a2.download = `${name || file}.json`;
                a2.click(); URL.revokeObjectURL(a2.href);
            }
            showToast(`"${name}" 내보내기 완료!`);
        } catch (e) { showToast('내보내기 실패: ' + e.message, true); }
    }

    async function exportPersona(file) { showExportSheet(file); }

    // ─── 불러오기 ────────────────────────────────────────────────────────────

    async function importPersonaFiles(files) {
        let jsonData = null, pngFile = null;
        for (const f of files) {
            if (f.name.endsWith('.json')) {
                try { jsonData = JSON.parse(await f.text()); } catch { showToast('JSON 파싱 실패.', true); }
            } else if (f.type?.startsWith('image/') || f.name.endsWith('.png')) {
                pngFile = f;
            }
        }
        if (!pngFile && !jsonData) { showToast('JSON 또는 이미지를 선택해주세요.', true); return; }
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
                    power_user.persona_descriptions[jsonData.file] = {
                        description: jsonData.description,
                        position: jsonData.position ?? 0,
                    };
                }
                if (jsonData.isDefault) power_user.default_persona = jsonData.file;
                if (jsonData.isFavorite) {
                    const s = getSettings();
                    s.favorites[jsonData.file] = true;
                }
            }
            saveSettingsDebounced();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast('불러오기 완료!');
        }, 1200);
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
        overlay.style.display = 'flex';
        _openedAt = Date.now();
        updateCurrentBanner();
        renderGrid();
    }

    function closeModal() {
        const overlay = document.getElementById('sp-overlay');
        if (!overlay) return;
        closeDialog();
        overlay.style.display = 'none';
    }

    // ─── 이벤트 ──────────────────────────────────────────────────────────────

    function bindModalEvents(overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay && Date.now() - _openedAt > 400) closeModal();
        });
        overlay.querySelector('#sp-close')?.addEventListener('click', closeModal);
        overlay.querySelector('#sp-search')?.addEventListener('input', e => renderGrid(e.target.value));

        // 정렬
        overlay.querySelector('#sp-sort')?.addEventListener('change', e => {
            _sortMode = e.target.value;
            renderGrid(document.getElementById('sp-search')?.value ?? '');
        });

        // 액션 버튼 행
        overlay.querySelector('#sp-btn-new')?.addEventListener('click', openCreateDialog);
        overlay.querySelector('#sp-btn-import')?.addEventListener('click', () => overlay.querySelector('#sp-import-file')?.click());
        overlay.querySelector('#sp-btn-export')?.addEventListener('click', () => {
            const cur = getCurrentPersona();
            if (cur) exportPersona(cur);
            else showToast('먼저 페르소나를 선택해주세요.', true);
        });
        overlay.querySelector('#sp-btn-edit')?.addEventListener('click', () => {
            const cur = getCurrentPersona();
            if (cur) openEditDialog(cur);
            else showToast('먼저 페르소나를 선택해주세요.', true);
        });
        overlay.querySelector('#sp-btn-group')?.addEventListener('click', openGroupDialog);
        overlay.querySelector('#sp-btn-more')?.addEventListener('click', openMoreMenu);

        overlay.querySelector('#sp-import-file')?.addEventListener('change', e => {
            if (e.target.files?.length) importPersonaFiles(Array.from(e.target.files));
            e.target.value = '';
        });

        // 현재 페르소나 배너 아이콘
        overlay.querySelector('#sp-cur-chat')?.addEventListener('click', () => {
            // 현재 채팅에 페르소나 적용 (ST 내부 apply 트리거)
            const cur = getCurrentPersona();
            if (cur) { showToast('채팅에 적용됨!'); }
            else showToast('먼저 페르소나를 선택해주세요.', true);
        });
        overlay.querySelector('#sp-cur-lock')?.addEventListener('click', () => {
            const lockBtn = document.querySelector('#lock_persona');
            if (lockBtn) lockBtn.click();
            showToast('페르소나 잠금 상태 전환!');
        });
        overlay.querySelector('#sp-cur-default')?.addEventListener('click', () => {
            const cur = getCurrentPersona();
            if (!cur) { showToast('먼저 페르소나를 선택해주세요.', true); return; }
            const isDef = cur === getDefaultPersona();
            if (isDef) delete power_user.default_persona;
            else power_user.default_persona = cur;
            saveSettingsDebounced();
            updateCurrentBanner();
            renderGrid(document.getElementById('sp-search')?.value ?? '');
            showToast(isDef ? '기본 페르소나 해제!' : '기본 페르소나 설정!');
        });

        // 뷰 전환 (4열 ↔ 3열)
        overlay.querySelector('#sp-btn-view')?.addEventListener('click', () => {
            _viewGrid = !_viewGrid;
            const grid = document.getElementById('sp-grid');
            if (grid) grid.style.gridTemplateColumns = _viewGrid ? 'repeat(4,1fr)' : 'repeat(3,1fr)';
        });

        // 그리드 이벤트 위임
        overlay.querySelector('#sp-grid')?.addEventListener('click', async e => {
            const starBtn = e.target.closest('.sp-card-star');
            const editBtn = e.target.closest('.sp-card-edit');
            const exportBtn = e.target.closest('.sp-card-export');
            const deleteBtn = e.target.closest('.sp-card-delete');
            const card = e.target.closest('.sp-card');

            if (starBtn) {
                e.stopPropagation();
                toggleFavorite(starBtn.dataset.file);
                starBtn.classList.toggle('starred');
            } else if (editBtn) {
                openEditDialog(editBtn.dataset.file);
            } else if (exportBtn) {
                exportPersona(exportBtn.dataset.file);
            } else if (deleteBtn) {
                confirmDelete(deleteBtn.dataset.file);
            } else if (card) {
                const file = card.dataset.file;
                if (file) {
                    await setUserAvatar(file);
                    updateCurrentBanner();
                    renderGrid(document.getElementById('sp-search')?.value ?? '');
                }
            }
        });

        // ESC 닫기
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (document.querySelector('.sp-confirm-dialog')) {
                    document.querySelector('.sp-confirm-dialog')?.remove();
                } else if (document.querySelector('.sp-dialog')) {
                    closeDialog();
                } else if (document.getElementById('sp-overlay')?.style.display === 'flex') {
                    closeModal();
                }
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

    // ─── 확장 탭 설정 ────────────────────────────────────────────────────────

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
                    <span>활성화 — 페르소나 버튼 클릭 시 Persona Manager 열기</span>
                </label>
                <small style="display:block;margin-top:6px;opacity:0.55;font-size:0.74rem;padding-left:24px;">
                    끄면 SillyTavern 기본 페르소나 창이 열립니다.
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
