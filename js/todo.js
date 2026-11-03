/**
 * todo.js
 * 할 일(Todo) 데이터 상태 관리, 비즈니스 로직 및 목록 렌더링 담당 모듈
 *
 * Todo 데이터 구조:
 * {
 *   id: String,
 *   title: String,
 *   category: "personal" | "work",
 *   completed: Boolean,
 *   createdAt: Number
 * }
 */
const TodoManager = (() => {
    const CATEGORIES = {
        PERSONAL: 'personal',
        WORK: 'work'
    };

    const CATEGORY_LABELS = {
        personal: '개인',
        work: '업무'
    };

    /**
     * 키워드 기반 자동 카테고리 분류 사전
     * - 업무(work): 회의, 보고서, 기획, 메일, 개발, 프로젝트 등 업무 관련 키워드
     * - 개인(personal): 운동, 병원, 쇼핑, 청소, 약속, 가족, 취미 등 일상/개인 관련 키워드
     */
    const CATEGORY_KEYWORDS = {
        work: [
            '회의', '미팅', '보고서', '보고', '기획', '기획서', '발표', '프레젠테이션',
            '출장', '결재', '품의', '메일', '이메일', '업무', '프로젝트', '개발', '코딩',
            '배포', '테스트', '리뷰', '코드리뷰', '문서', '제안서', '견적', '견적서',
            '거래처', '클라이언트', '고객', '마감', '데드라인', '야근', '근무', '출근',
            '인수인계', '세미나', '워크숍', '면접', '채용', '회계', '정산', '예산', '계약',
            '회의록', '슬랙', '지라', '노션', '스크럼', '스프린트', '버그', '패치', '데이터',
            'meeting', 'report', 'project', 'work', 'email', 'mail', 'client',
            'deadline', 'review', 'deploy', 'sprint', 'scrum', 'issue', 'bug'
        ],
        personal: [
            '운동', '헬스', '요가', '필라테스', '러닝', '산책', '병원', '치과', '약국',
            '진료', '건강검진', '쇼핑', '장보기', '마트', '택배', '청소', '빨래', '설거지',
            '집안일', '요리', '식사', '점심', '저녁', '아침', '약속', '모임', '친구',
            '가족', '부모님', '생일', '선물', '여행', '휴가', '영화', '독서', '책',
            '공부', '영어', '강의', '취미', '은행', '적금', '세금', '공과금', '미용실',
            '머리', '카페', '데이트', '강아지', '고양이', '반려동물', '산책하기', '비타민',
            'gym', 'workout', 'shopping', 'doctor', 'hospital', 'family',
            'friend', 'movie', 'book', 'study', 'clean', 'travel'
        ]
    };

    /** @type {Array<{id: string, title: string, category: "personal"|"work", completed: boolean, createdAt: number}>} */
    let todos = [];

    /** @type {string|null} 현재 수정 중인 Todo의 고유 ID */
    let editingTodoId = null;

    /**
     * 고유한 문자열 ID를 생성합니다.
     * @returns {string}
     */
    function generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'todo-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * 카테고리 입력값을 표준 코드("personal" | "work")로 정규화합니다.
     * @param {string} rawCategory
     * @returns {"personal"|"work"}
     */
    function normalizeCategory(rawCategory) {
        if (rawCategory === CATEGORIES.WORK || rawCategory === '업무') {
            return CATEGORIES.WORK;
        }
        return CATEGORIES.PERSONAL;
    }

    /**
     * 할 일 제목에 포함된 키워드를 분석하여 카테고리를 자동 분류합니다.
     * - 제목에서 가장 마지막에 등장한 키워드(또는 매칭 개수가 많은 카테고리)를 우선 판단합니다.
     * @param {string} rawTitle
     * @returns {{ matched: boolean, category: "personal"|"work"|null, keyword: string|null }}
     */
    function detectCategoryByTitle(rawTitle) {
        if (typeof rawTitle !== 'string' || rawTitle.trim().length === 0) {
            return { matched: false, category: null, keyword: null };
        }

        const normalizedText = rawTitle.toLowerCase().trim();

        let lastWorkIndex = -1;
        let lastWorkKeyword = null;
        let workMatchCount = 0;

        CATEGORY_KEYWORDS.work.forEach((kw) => {
            const idx = normalizedText.lastIndexOf(kw.toLowerCase());
            if (idx !== -1) {
                workMatchCount += 1;
                if (idx >= lastWorkIndex) {
                    lastWorkIndex = idx;
                    lastWorkKeyword = kw;
                }
            }
        });

        let lastPersonalIndex = -1;
        let lastPersonalKeyword = null;
        let personalMatchCount = 0;

        CATEGORY_KEYWORDS.personal.forEach((kw) => {
            const idx = normalizedText.lastIndexOf(kw.toLowerCase());
            if (idx !== -1) {
                personalMatchCount += 1;
                if (idx >= lastPersonalIndex) {
                    lastPersonalIndex = idx;
                    lastPersonalKeyword = kw;
                }
            }
        });

        if (workMatchCount === 0 && personalMatchCount === 0) {
            return { matched: false, category: null, keyword: null };
        }

        if (workMatchCount > 0 && personalMatchCount === 0) {
            return { matched: true, category: CATEGORIES.WORK, keyword: lastWorkKeyword };
        }

        if (personalMatchCount > 0 && workMatchCount === 0) {
            return { matched: true, category: CATEGORIES.PERSONAL, keyword: lastPersonalKeyword };
        }

        // 두 카테고리 키워드가 모두 포함된 경우: 가장 최근(뒤쪽)에 입력한 키워드 우선
        if (lastWorkIndex >= lastPersonalIndex) {
            return { matched: true, category: CATEGORIES.WORK, keyword: lastWorkKeyword };
        }
        return { matched: true, category: CATEGORIES.PERSONAL, keyword: lastPersonalKeyword };
    }

    /**
     * 카테고리 코드에 해당하는 한글 라벨을 반환합니다.
     * @param {"personal"|"work"} category
     * @returns {string}
     */
    function getCategoryLabel(category) {
        const normalized = normalizeCategory(category);
        return CATEGORY_LABELS[normalized];
    }

    /**
     * 제목 입력값을 검증하고 앞뒤 공백을 제거합니다.
     * @param {string} rawTitle
     * @returns {{ valid: boolean, title: string }}
     */
    function validateTitle(rawTitle) {
        if (typeof rawTitle !== 'string') {
            return { valid: false, title: '' };
        }
        const trimmed = rawTitle.trim();
        return {
            valid: trimmed.length > 0,
            title: trimmed
        };
    }

    /**
     * 변경된 Todo 상태를 LocalStorage에 동기화합니다.
     * @returns {boolean} 저장 성공 여부
     */
    function syncStorage() {
        if (typeof TodoStorage !== 'undefined' && typeof TodoStorage.saveTodos === 'function') {
            return TodoStorage.saveTodos(todos);
        }
        return false;
    }

    /**
     * 초기 Todo 목록 데이터를 설정합니다.
     * @param {Array<Object>} initialTodos
     */
    function setTodos(initialTodos) {
        if (!Array.isArray(initialTodos)) {
            todos = [];
            return;
        }
        todos = initialTodos
            .filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string')
            .map((item) => ({
                id: String(item.id),
                title: item.title.trim(),
                category: normalizeCategory(item.category),
                completed: Boolean(item.completed),
                createdAt: Number(item.createdAt) || Date.now()
            }))
            .filter((item) => item.title.length > 0);
    }

    /**
     * 전체 Todo 목록의 복사본을 반환합니다.
     * @returns {Array<Object>}
     */
    function getTodos() {
        return todos.map((todo) => ({ ...todo }));
    }

    /**
     * 특정 ID의 Todo 항목을 조회합니다.
     * @param {string} id
     * @returns {Object|null}
     */
    function getTodoById(id) {
        const found = todos.find((todo) => todo.id === id);
        return found ? { ...found } : null;
    }

    /**
     * 현재 수정 중인 Todo의 ID를 설정합니다.
     * @param {string|null} id
     */
    function setEditingTodoId(id) {
        editingTodoId = id ? String(id) : null;
    }

    /**
     * 현재 수정 중인 Todo의 ID를 반환합니다.
     * @returns {string|null}
     */
    function getEditingTodoId() {
        return editingTodoId;
    }

    /**
     * 1. Todo 추가 함수 (Create)
     * - 1단계: Todo 데이터 변경 -> 2단계: LocalStorage 자동 저장
     * @param {string} rawTitle - 할 일 제목
     * @param {string} rawCategory - 카테고리 ("personal" | "work" | "개인" | "업무")
     * @returns {Object|null} 생성된 Todo 객체 또는 실패 시 null
     */
    function addTodo(rawTitle, rawCategory) {
        const { valid, title } = validateTitle(rawTitle);
        if (!valid) {
            return null;
        }

        const resolvedCategory = rawCategory !== undefined && rawCategory !== null && rawCategory !== ''
            ? normalizeCategory(rawCategory)
            : (detectCategoryByTitle(title).category || CATEGORIES.PERSONAL);

        const newTodo = {
            id: generateId(),
            title,
            category: resolvedCategory,
            completed: false,
            createdAt: Date.now()
        };

        todos.push(newTodo);
        syncStorage();
        return { ...newTodo };
    }

    /**
     * 2. Todo 수정 함수 (Update)
     * - 1단계: Todo 데이터 변경 -> 2단계: LocalStorage 자동 저장
     * @param {string} id - 수정할 Todo의 ID
     * @param {{ title: string, category: string }} updates - 변경할 제목 및 카테고리
     * @returns {Object|null} 수정된 Todo 객체 또는 실패 시 null
     */
    function updateTodo(id, updates) {
        if (!id || !updates) {
            return null;
        }

        const index = todos.findIndex((todo) => todo.id === id);
        if (index === -1) {
            return null;
        }

        const { valid, title } = validateTitle(updates.title);
        if (!valid) {
            return null;
        }

        const updatedCategory = updates.category !== undefined
            ? normalizeCategory(updates.category)
            : todos[index].category;

        todos[index] = {
            ...todos[index],
            title,
            category: updatedCategory
        };

        if (editingTodoId === id) {
            editingTodoId = null;
        }

        syncStorage();
        return { ...todos[index] };
    }

    /**
     * 3. Todo 삭제 함수 (Delete)
     * - 1단계: Todo 데이터 변경 -> 2단계: LocalStorage 자동 저장
     * @param {string} id - 삭제할 Todo의 ID
     * @returns {boolean} 삭제 성공 여부
     */
    function deleteTodo(id) {
        const initialLength = todos.length;
        todos = todos.filter((todo) => todo.id !== id);

        if (todos.length === initialLength) {
            return false;
        }

        if (editingTodoId === id) {
            editingTodoId = null;
        }

        syncStorage();
        return true;
    }

    /**
     * 4. 완료 상태 변경 함수 (Toggle Completed)
     * - 1단계: Todo 데이터 변경 -> 2단계: LocalStorage 자동 저장
     * @param {string} id - 상태를 변경할 Todo의 ID
     * @param {boolean} [forceCompleted] - 명시적 완료 여부 (생략 시 현재 상태 반전)
     * @returns {Object|null} 변경된 Todo 객체 또는 실패 시 null
     */
    function toggleTodo(id, forceCompleted) {
        const index = todos.findIndex((todo) => todo.id === id);
        if (index === -1) {
            return null;
        }

        const nextCompleted = typeof forceCompleted === 'boolean'
            ? forceCompleted
            : !todos[index].completed;

        todos[index] = {
            ...todos[index],
            completed: Boolean(nextCompleted)
        };

        syncStorage();
        return { ...todos[index] };
    }

    /**
     * 대시보드 통계 및 진행률 데이터를 계산합니다.
     * - 진행률 = (완료된 Todo 개수 / 전체 Todo 개수) * 100 (정수 반올림)
     * - 예외 처리: 전체 0개면 0%, 모두 완료되면 100%
     * @returns {{
     *   totalCount: number,
     *   completedCount: number,
     *   remainingCount: number,
     *   progressPercentage: number
     * }}
     */
    function getStats() {
        const totalCount = todos.length;
        const completedCount = todos.filter((todo) => todo.completed === true).length;
        const remainingCount = totalCount - completedCount;

        let progressPercentage = 0;
        if (totalCount === 0) {
            progressPercentage = 0;
        } else if (completedCount === totalCount) {
            progressPercentage = 100;
        } else {
            progressPercentage = Math.round((completedCount / totalCount) * 100);
        }

        return {
            totalCount,
            completedCount,
            remainingCount,
            progressPercentage
        };
    }

    /**
     * 개별 Todo DOM 요소(<li>)를 생성합니다. (XSS 방지를 위해 DOM API 및 textContent 사용)
     * @param {Object} todo
     * @returns {HTMLLIElement}
     */
    function createTodoItemElement(todo) {
        const isEditing = editingTodoId === todo.id;
        const categoryLabel = getCategoryLabel(todo.category);
        const isWork = todo.category === CATEGORIES.WORK;

        const li = document.createElement('li');
        li.className = 'todo-item' + (todo.completed ? ' completed' : '');
        li.dataset.id = todo.id;
        li.dataset.category = categoryLabel;

        // 좌측 영역 (체크박스 + 제목/수정입력창 + 배지/카테고리선택)
        const leftDiv = document.createElement('div');
        leftDiv.className = 'todo-item-left';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.id = `todo-check-${todo.id}`;
        checkbox.checked = Boolean(todo.completed);
        checkbox.setAttribute('aria-label', `${todo.title} 완료 여부 선택`);
        leftDiv.appendChild(checkbox);

        if (isEditing) {
            // 수정 모드: 기존 제목을 입력창에 표시 + 카테고리 선택 버튼 제공
            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'edit-todo-input';
            editInput.value = todo.title;
            editInput.setAttribute('aria-label', '할 일 제목 수정');
            editInput.autocomplete = 'off';

            const categorySelector = document.createElement('div');
            categorySelector.className = 'category-selector';
            categorySelector.setAttribute('role', 'group');
            categorySelector.setAttribute('aria-label', '수정할 카테고리 선택');

            const personalBtn = document.createElement('button');
            personalBtn.type = 'button';
            personalBtn.className = 'category-btn' + (!isWork ? ' active' : '');
            personalBtn.dataset.action = 'select-edit-category';
            personalBtn.dataset.category = CATEGORIES.PERSONAL;
            personalBtn.setAttribute('aria-pressed', String(!isWork));
            personalBtn.textContent = '개인';

            const workBtn = document.createElement('button');
            workBtn.type = 'button';
            workBtn.className = 'category-btn' + (isWork ? ' active' : '');
            workBtn.dataset.action = 'select-edit-category';
            workBtn.dataset.category = CATEGORIES.WORK;
            workBtn.setAttribute('aria-pressed', String(isWork));
            workBtn.textContent = '업무';

            categorySelector.appendChild(personalBtn);
            categorySelector.appendChild(workBtn);

            leftDiv.appendChild(editInput);
            leftDiv.appendChild(categorySelector);
        } else {
            // 일반 조회 모드: 제목 라벨 + 카테고리 배지
            const titleLabel = document.createElement('label');
            titleLabel.htmlFor = `todo-check-${todo.id}`;
            titleLabel.className = 'todo-title';
            titleLabel.textContent = todo.title;

            const badgeSpan = document.createElement('span');
            badgeSpan.className = `category-badge ${isWork ? 'badge-work' : 'badge-personal'}`;
            badgeSpan.dataset.category = categoryLabel;
            badgeSpan.textContent = categoryLabel;

            leftDiv.appendChild(titleLabel);
            leftDiv.appendChild(badgeSpan);
        }

        // 우측 액션 버튼 영역
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'todo-item-actions';

        if (isEditing) {
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'edit-todo-btn';
            saveBtn.dataset.action = 'save';
            saveBtn.setAttribute('aria-label', '수정 내용 저장');
            saveBtn.textContent = '저장';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'delete-todo-btn';
            cancelBtn.dataset.action = 'cancel';
            cancelBtn.setAttribute('aria-label', '수정 취소');
            cancelBtn.textContent = '취소';

            actionsDiv.appendChild(saveBtn);
            actionsDiv.appendChild(cancelBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'edit-todo-btn';
            editBtn.dataset.action = 'edit';
            editBtn.setAttribute('aria-label', '할 일 수정');
            editBtn.textContent = '수정';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-todo-btn';
            deleteBtn.dataset.action = 'delete';
            deleteBtn.setAttribute('aria-label', '할 일 삭제');
            deleteBtn.textContent = '삭제';

            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(deleteBtn);
        }

        li.appendChild(leftDiv);
        li.appendChild(actionsDiv);

        return li;
    }

    /**
     * 5. Todo 목록 렌더링 함수
     * @param {HTMLElement} listElement - Todo 항목들이 렌더링될 <ul> 요소
     * @param {HTMLElement} emptyStateElement - 할 일이 없을 때 표시할 Empty State 요소
     */
    function renderTodoList(listElement, emptyStateElement) {
        if (!listElement) {
            return;
        }

        // 기존 목록 비우기
        listElement.replaceChildren();

        if (todos.length === 0) {
            listElement.hidden = true;
            if (emptyStateElement) {
                emptyStateElement.hidden = false;
            }
            return;
        }

        listElement.hidden = false;
        if (emptyStateElement) {
            emptyStateElement.hidden = true;
        }

        const fragment = document.createDocumentFragment();
        todos.forEach((todo) => {
            const itemElement = createTodoItemElement(todo);
            fragment.appendChild(itemElement);
        });

        listElement.appendChild(fragment);

        // 수정 모드인 항목이 있으면 해당 입력창에 포커스 및 커서를 끝으로 이동
        if (editingTodoId) {
            const activeEditInput = listElement.querySelector('.edit-todo-input');
            if (activeEditInput) {
                activeEditInput.focus();
                const len = activeEditInput.value.length;
                activeEditInput.setSelectionRange(len, len);
            }
        }
    }

    return {
        CATEGORIES,
        CATEGORY_LABELS,
        CATEGORY_KEYWORDS,
        normalizeCategory,
        detectCategoryByTitle,
        getCategoryLabel,
        validateTitle,
        setTodos,
        getTodos,
        getTodoById,
        setEditingTodoId,
        getEditingTodoId,
        addTodo,
        updateTodo,
        deleteTodo,
        toggleTodo,
        getStats,
        renderTodoList
    };
})();
