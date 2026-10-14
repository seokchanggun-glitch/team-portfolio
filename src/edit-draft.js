// 프로젝트 편집 임시 저장 + 충돌 시 3-way 병합.
// - 편집 중 입력값을 localStorage에 임시 저장해, 새로고침 후에도 복구할 수 있게 한다.
// - 저장 충돌이 나면 최신 서버 데이터 위에 "내가 바꾼 칸"만 다시 적용한다.
//   같은 칸을 상대도 바꿨다면 conflicts로 돌려줘 사용자가 고르게 한다.
// 파일(File/Blob) 값은 localStorage에 넣을 수 없어 임시 저장에서 제외한다.

const PREFIX = 'project-edit-draft:';

function key(projectId) {
  return PREFIX + projectId;
}

function isSerializable(value) {
  return !(typeof Blob !== 'undefined' && value instanceof Blob);
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// 편집 시작 시점의 원본(base)과 현재 입력값(fields)을 저장한다.
export function saveDraft(projectId, base, fields) {
  const clean = {};
  for (const [name, value] of Object.entries(fields)) {
    if (isSerializable(value)) clean[name] = value;
  }
  try {
    localStorage.setItem(key(projectId), JSON.stringify({ base, fields: clean, savedAt: Date.now() }));
  } catch {
    // 저장 공간 부족·사생활 보호 모드 등: 임시 저장만 건너뛴다.
  }
}

// 저장된 편집이 있으면 { base, fields, savedAt }, 없으면 null.
export function loadDraft(projectId) {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(projectId) {
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    // 무시
  }
}

// base에 비해 내가 바꾼 칸만 뽑는다.
export function changedFields(base, mine) {
  const changes = {};
  for (const name of Object.keys(mine)) {
    if (!same(base?.[name], mine[name])) changes[name] = mine[name];
  }
  return changes;
}

// 3-way 병합.
// base: 편집 시작 시점 값, mine: 내 입력값, latest: 지금 서버 값.
// 반환: { merged, conflicts: [{ field, mine, theirs }] }
// conflicts가 비어 있으면 merged를 그대로 저장하면 된다.
export function mergeEdits(base, mine, latest) {
  const merged = { ...latest };
  const conflicts = [];
  for (const [field, value] of Object.entries(changedFields(base, mine))) {
    const theirsChanged = !same(base?.[field], latest?.[field]);
    if (theirsChanged && !same(latest?.[field], value)) {
      conflicts.push({ field, mine: value, theirs: latest?.[field] });
    } else {
      merged[field] = value;
    }
  }
  return { merged, conflicts };
}

// conflicts에 대한 사용자 선택({ [field]: 'mine' | 'theirs' })을 반영한다.
export function resolveConflicts(merged, conflicts, choices) {
  const result = { ...merged };
  for (const c of conflicts) {
    result[c.field] = choices[c.field] === 'mine' ? c.mine : c.theirs;
  }
  return result;
}
