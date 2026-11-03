/**
 * storage.js
 * 브라우저 LocalStorage 기반 Todo 데이터 영속성 관리 모듈
 * - Storage Key: "dailyTodoList"
 * - JSON 직렬화/역직렬화 및 LocalStorage 접근/용량 오류 예외 처리 포함
 */
const TodoStorage = (() => {
    const STORAGE_KEY = 'dailyTodoList';

    /**
     * LocalStorage에서 저장된 Todo 배열을 조회합니다.
     * - 저장된 데이터가 없으면 빈 배열([])을 반환합니다.
     * - JSON 파싱 오류나 접근 오류 발생 시 기존 저장소 데이터를 빈 배열로 덮어쓰지 않고 보존합니다.
     * @returns {Array<Object>} 조회된 Todo 배열
     */
    function loadTodos() {
        try {
            const rawData = window.localStorage.getItem(STORAGE_KEY);

            // 최초 접속 등 저장된 데이터가 없는 경우 빈 배열로 초기화
            if (rawData === null) {
                return [];
            }

            const parsedData = JSON.parse(rawData);

            if (!Array.isArray(parsedData)) {
                console.warn('[TodoStorage] 저장된 데이터 형식이 배열이 아닙니다. 기존 데이터를 덮어쓰지 않고 보존합니다.');
                alert('저장된 할 일 데이터 형식이 올바르지 않아 불러올 수 없습니다.');
                return [];
            }

            return parsedData;
        } catch (error) {
            console.error('[TodoStorage] LocalStorage 데이터 조회 또는 JSON 파싱 오류:', error);
            alert('저장된 할 일 데이터를 불러오는 중 오류가 발생했습니다. 브라우저 저장소 설정을 확인해 주세요.');
            // 오류 발생 시에도 LocalStorage의 기존 데이터를 덮어쓰지 않음
            return [];
        }
    }

    /**
     * Todo 배열 전체를 JSON 문자열로 변환하여 LocalStorage에 저장합니다.
     * - 저장 실패 시 사용자에게 오류를 안내하며, 잘못된 값으로 기존 데이터를 덮어쓰지 않습니다.
     * @param {Array<Object>} todos - 저장할 Todo 배열
     * @returns {boolean} 저장 성공 여부
     */
    function saveTodos(todos) {
        if (!Array.isArray(todos)) {
            console.error('[TodoStorage] 유효하지 않은 Todo 배열입니다. 기존 데이터를 보호하기 위해 저장을 중단합니다.');
            alert('할 일 데이터 형식이 올바르지 않아 저장에 실패했습니다.');
            return false;
        }

        try {
            const serialized = JSON.stringify(todos);
            window.localStorage.setItem(STORAGE_KEY, serialized);
            return true;
        } catch (error) {
            console.error('[TodoStorage] LocalStorage 저장 실패:', error);
            alert('할 일 데이터를 저장하는 중 오류가 발생했습니다. 브라우저 저장 공간이 부족하거나 저장소 접근이 제한되어 있을 수 있습니다.');
            return false;
        }
    }

    /**
     * LocalStorage에 저장된 Todo 데이터를 초기화(삭제)합니다.
     * @returns {boolean} 초기화 성공 여부
     */
    function clearTodos() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('[TodoStorage] LocalStorage 초기화 실패:', error);
            alert('저장된 데이터를 초기화하는 중 오류가 발생했습니다.');
            return false;
        }
    }

    return {
        STORAGE_KEY,
        loadTodos,
        saveTodos,
        clearTodos
    };
})();
