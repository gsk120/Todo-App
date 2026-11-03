/**
 * app.js
 * 애플리케이션 초기화, DOM 이벤트 연결, 사용자 입력 처리 및 UI 업데이트 관리 모듈
 */
const TodoApp = (() => {
    /** @type {"personal"|"work"} 신규 등록 시 선택된 카테고리 */
    let selectedCategory = TodoManager.CATEGORIES.PERSONAL;

    /** @type {boolean} 사용자가 직접 카테고리 버튼을 클릭해 수동 지정했는지 여부 */
    let isCategoryManuallySelected = false;

    /** 캐싱된 주요 DOM 요소 */
    const dom = {};

    /**
     * 필수 DOM 요소를 조회하여 캐싱합니다.
     */
    function cacheDomElements() {
        dom.todoForm = document.getElementById('todo-form');
        dom.todoTitleInput = document.getElementById('todo-title-input');
        dom.categorySelector = document.getElementById('category-selector');
        dom.personalCategoryBtn = document.getElementById('category-btn-personal');
        dom.workCategoryBtn = document.getElementById('category-btn-work');
        dom.addTodoBtn = document.getElementById('add-todo-btn');

        dom.todoList = document.getElementById('todo-list');
        dom.emptyState = document.getElementById('empty-state');

        dom.totalCount = document.getElementById('total-count');
        dom.completedCount = document.getElementById('completed-count');
        dom.pendingCount = document.getElementById('pending-count');
        dom.progressPercentage = document.getElementById('progress-percentage');
        dom.progressBarTrack = document.getElementById('progress-bar-track');
        dom.progressBarFill = document.getElementById('progress-bar-fill');
    }

    /**
     * 3단계: Dashboard 통계(totalCount, completedCount, remainingCount)를 화면에 반영합니다.
     * @param {{ totalCount: number, completedCount: number, remainingCount: number }} stats
     */
    function updateDashboardStatsUI(stats) {
        if (dom.totalCount) {
            dom.totalCount.textContent = String(stats.totalCount);
        }
        if (dom.completedCount) {
            dom.completedCount.textContent = String(stats.completedCount);
        }
        if (dom.pendingCount) {
            dom.pendingCount.textContent = String(stats.remainingCount);
        }
    }

    /**
     * 4단계: Progress Bar 너비와 진행률 정수(%) 숫자를 항상 일치하도록 업데이트합니다.
     * @param {number} progressPercentage - 0 ~ 100 사이의 정수 진행률
     */
    function updateProgressBarUI(progressPercentage) {
        const safePercentage = Math.max(0, Math.min(100, Math.round(progressPercentage)));
        const percentageText = `${safePercentage}%`;

        if (dom.progressPercentage) {
            dom.progressPercentage.textContent = percentageText;
        }
        if (dom.progressBarTrack) {
            dom.progressBarTrack.setAttribute('aria-valuenow', String(safePercentage));
        }
        if (dom.progressBarFill) {
            dom.progressBarFill.style.width = percentageText;
        }
    }

    /**
     * 상단 입력 영역의 카테고리 선택 버튼 활성화 상태를 업데이트합니다.
     * @param {"personal"|"work"} category
     * @param {{ autoDetected?: boolean, keyword?: string|null }} [meta]
     */
    function updateCategorySelectorUI(category, meta = {}) {
        selectedCategory = TodoManager.normalizeCategory(category);
        const isPersonal = selectedCategory === TodoManager.CATEGORIES.PERSONAL;

        if (dom.personalCategoryBtn) {
            dom.personalCategoryBtn.classList.toggle('active', isPersonal);
            dom.personalCategoryBtn.setAttribute('aria-pressed', String(isPersonal));
            if (isPersonal && meta.autoDetected && meta.keyword) {
                dom.personalCategoryBtn.title = `'${meta.keyword}' 키워드로 자동 선택됨`;
            } else {
                dom.personalCategoryBtn.removeAttribute('title');
            }
        }
        if (dom.workCategoryBtn) {
            dom.workCategoryBtn.classList.toggle('active', !isPersonal);
            dom.workCategoryBtn.setAttribute('aria-pressed', String(!isPersonal));
            if (!isPersonal && meta.autoDetected && meta.keyword) {
                dom.workCategoryBtn.title = `'${meta.keyword}' 키워드로 자동 선택됨`;
            } else {
                dom.workCategoryBtn.removeAttribute('title');
            }
        }
    }

    /**
     * 제목 입력값의 키워드를 분석해 카테고리를 실시간으로 자동 선택합니다.
     * - 사용자가 직접 카테고리 버튼을 클릭해 수동 고정한 경우에는 덮어쓰지 않습니다.
     * - 입력창이 모두 비워지면 수동 선택 잠금을 해제합니다.
     * @param {string} rawTitle
     */
    function handleTitleInputAutoCategory(rawTitle) {
        if (typeof rawTitle !== 'string' || rawTitle.trim().length === 0) {
            isCategoryManuallySelected = false;
            return;
        }

        if (isCategoryManuallySelected) {
            return;
        }

        const detection = TodoManager.detectCategoryByTitle(rawTitle);
        if (detection.matched && detection.category) {
            updateCategorySelectorUI(detection.category, {
                autoDetected: true,
                keyword: detection.keyword
            });
        }
    }

    /**
     * 일관된 화면 갱신 흐름 (데이터 변경 및 LocalStorage 저장 직후 호출)
     * - 3. Dashboard 통계 재계산 및 반영
     * - 4. Progress Bar 업데이트
     * - 5. Todo 목록 다시 렌더링
     */
    function refreshUI() {
        const stats = TodoManager.getStats();
        updateDashboardStatsUI(stats);
        updateProgressBarUI(stats.progressPercentage);
        TodoManager.renderTodoList(dom.todoList, dom.emptyState);
    }

    /**
     * 할 일 추가(Create) 사용자 입력을 처리합니다.
     */
    function handleCreateTodo() {
        if (!dom.todoTitleInput) {
            return;
        }

        const rawTitle = dom.todoTitleInput.value;
        const { valid, title } = TodoManager.validateTitle(rawTitle);

        if (!valid) {
            alert('할 일 제목을 입력해 주세요. (공백만 입력할 수 없습니다)');
            dom.todoTitleInput.value = '';
            dom.todoTitleInput.focus();
            return;
        }

        // 사용자가 수동으로 카테고리를 지정하지 않은 경우, 등록 시점에도 키워드 자동 분류 적용
        if (!isCategoryManuallySelected) {
            const detection = TodoManager.detectCategoryByTitle(title);
            if (detection.matched && detection.category) {
                updateCategorySelectorUI(detection.category, {
                    autoDetected: true,
                    keyword: detection.keyword
                });
            }
        }

        const created = TodoManager.addTodo(title, selectedCategory);
        if (created) {
            dom.todoTitleInput.value = '';
            isCategoryManuallySelected = false;
            refreshUI();
            dom.todoTitleInput.focus();
        }
    }

    /**
     * 수정 중인 할 일의 변경 내용을 저장(Update)합니다.
     * @param {HTMLElement} todoItemEl - 수정 중인 <li> 요소
     */
    function handleSaveTodoEdit(todoItemEl) {
        const editingId = TodoManager.getEditingTodoId();
        if (!todoItemEl || !editingId) {
            return;
        }

        const editInput = todoItemEl.querySelector('.edit-todo-input');
        const activeCategoryBtn = todoItemEl.querySelector('.category-btn.active');

        const rawTitle = editInput ? editInput.value : '';
        const { valid, title } = TodoManager.validateTitle(rawTitle);

        if (!valid) {
            alert('수정할 할 일 제목을 입력해 주세요. (공백만 입력할 수 없습니다)');
            if (editInput) {
                editInput.focus();
            }
            return;
        }

        const selectedEditCategory = activeCategoryBtn
            ? activeCategoryBtn.dataset.category
            : TodoManager.CATEGORIES.PERSONAL;

        const updated = TodoManager.updateTodo(editingId, {
            title,
            category: selectedEditCategory
        });

        if (updated) {
            refreshUI();
        }
    }

    /**
     * 할 일 삭제(Delete) 확인 절차 및 삭제 처리를 수행합니다.
     * @param {string} id - 삭제할 Todo의 ID
     */
    function handleDeleteTodo(id) {
        const targetTodo = TodoManager.getTodoById(id);
        if (!targetTodo) {
            return;
        }

        const isConfirmed = window.confirm(`"${targetTodo.title}" 할 일을 삭제하시겠습니까?`);
        if (!isConfirmed) {
            return;
        }

        const deleted = TodoManager.deleteTodo(id);
        if (deleted) {
            refreshUI();
        }
    }

    /** @type {boolean} 이벤트 중복 바인딩 방지 플래그 */
    let isInitialized = false;

    /**
     * DOM 이벤트를 바인딩합니다.
     */
    function bindEvents() {
        // 1. 폼 기본 제출 새로고침 방지
        if (dom.todoForm) {
            dom.todoForm.addEventListener('submit', (event) => {
                event.preventDefault();
            });
        }

        // 2. 입력창 실시간 키워드 분석(자동 카테고리 전환) 및 Enter 키 할 일 추가
        if (dom.todoTitleInput) {
            dom.todoTitleInput.addEventListener('input', (event) => {
                handleTitleInputAutoCategory(event.target.value);
            });

            dom.todoTitleInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.isComposing) {
                    event.preventDefault();
                    handleCreateTodo();
                }
            });
        }

        // 3. 추가 버튼 클릭 시 할 일 추가
        if (dom.addTodoBtn) {
            dom.addTodoBtn.addEventListener('click', () => {
                handleCreateTodo();
            });
        }

        // 4. 입력 영역 카테고리 선택 버튼 (수동 선택 시 우선순위 고정)
        if (dom.categorySelector) {
            dom.categorySelector.addEventListener('click', (event) => {
                const categoryBtn = event.target.closest('.category-btn');
                if (!categoryBtn) {
                    return;
                }
                isCategoryManuallySelected = true;
                const rawCategory = categoryBtn.dataset.category;
                updateCategorySelectorUI(rawCategory, { autoDetected: false });
            });
        }

        // 5. Todo 목록 내 체크박스 완료/미완료 상태 변경 (이벤트 위임)
        if (dom.todoList) {
            dom.todoList.addEventListener('change', (event) => {
                const checkbox = event.target.closest('.todo-checkbox');
                if (!checkbox) {
                    return;
                }

                const todoItem = checkbox.closest('.todo-item');
                if (!todoItem || !todoItem.dataset.id) {
                    return;
                }

                TodoManager.toggleTodo(todoItem.dataset.id, Boolean(checkbox.checked));
                refreshUI();
            });

            // 6. Todo 목록 내 수정 / 저장 / 취소 / 삭제 / 카테고리 변경 버튼 클릭 (이벤트 위임)
            dom.todoList.addEventListener('click', (event) => {
                const actionBtn = event.target.closest('button[data-action]');
                if (!actionBtn) {
                    return;
                }

                const todoItem = actionBtn.closest('.todo-item');
                if (!todoItem || !todoItem.dataset.id) {
                    return;
                }

                const todoId = todoItem.dataset.id;
                const action = actionBtn.dataset.action;

                switch (action) {
                    case 'edit':
                        TodoManager.setEditingTodoId(todoId);
                        refreshUI();
                        break;

                    case 'select-edit-category': {
                        todoItem.dataset.manualCategory = 'true';
                        const categoryButtons = todoItem.querySelectorAll('.category-btn');
                        categoryButtons.forEach((btn) => {
                            const isSelected = btn === actionBtn;
                            btn.classList.toggle('active', isSelected);
                            btn.setAttribute('aria-pressed', String(isSelected));
                        });
                        break;
                    }

                    case 'save':
                        handleSaveTodoEdit(todoItem);
                        break;

                    case 'cancel':
                        TodoManager.setEditingTodoId(null);
                        refreshUI();
                        break;

                    case 'delete':
                        handleDeleteTodo(todoId);
                        break;

                    default:
                        break;
                }
            });

            // 7. 수정 입력창 실시간 키워드 기반 카테고리 자동 전환 (수동 클릭 전까지 동작)
            dom.todoList.addEventListener('input', (event) => {
                const editInput = event.target.closest('.edit-todo-input');
                if (!editInput) {
                    return;
                }

                const todoItem = editInput.closest('.todo-item');
                if (!todoItem || todoItem.dataset.manualCategory === 'true') {
                    return;
                }

                const detection = TodoManager.detectCategoryByTitle(editInput.value);
                if (detection.matched && detection.category) {
                    const categoryButtons = todoItem.querySelectorAll('.category-btn');
                    categoryButtons.forEach((btn) => {
                        const isSelected = btn.dataset.category === detection.category;
                        btn.classList.toggle('active', isSelected);
                        btn.setAttribute('aria-pressed', String(isSelected));
                    });
                }
            });

            // 8. 수정 입력창 내부 키보드 제어 (Enter: 저장, Escape: 취소)
            dom.todoList.addEventListener('keydown', (event) => {
                const editInput = event.target.closest('.edit-todo-input');
                if (!editInput) {
                    return;
                }

                const todoItem = editInput.closest('.todo-item');
                if (!todoItem) {
                    return;
                }

                if (event.key === 'Enter' && !event.isComposing) {
                    event.preventDefault();
                    handleSaveTodoEdit(todoItem);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    TodoManager.setEditingTodoId(null);
                    refreshUI();
                }
            });
        }
    }

    /**
     * 애플리케이션 초기화 진입점
     */
    function init() {
        cacheDomElements();

        // LocalStorage에서 초기 데이터 로드
        if (typeof TodoStorage !== 'undefined' && typeof TodoStorage.loadTodos === 'function') {
            const savedTodos = TodoStorage.loadTodos();
            TodoManager.setTodos(savedTodos);
        }

        updateCategorySelectorUI(TodoManager.CATEGORIES.PERSONAL);

        if (!isInitialized) {
            bindEvents();
            isInitialized = true;
        }

        refreshUI();
    }

    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    TodoApp.init();
});
