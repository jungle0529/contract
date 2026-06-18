// 시트 원본 행 → 화면에 쓸 프로젝트 모델로 변환한다.
// 화면에는 단계 체크와 진행율만 노출하므로, 금액/고객사 등 대외비 값은
// 여기서 의도적으로 추출/보관하지 않는다.

import { GROUPS, ALL_STAGES, META } from './config.js'
import { resolveIndex } from './sheet.js'

const norm = (s) => (s || '').toString().replace(/\s+/g, '').toLowerCase()

// 전역 판정 토큰 (시트 실제 표기 기준). 단계별 override 는 config 의 done/no.
const NA_TOKENS = ['-', '해당없음', '해당사항없음', 'n/a', 'na', '없음']
const NO_TOKENS = ['x', '미발행', '미확인', '미회수', '미진행', '미완료', '미입금', '대기']
const DONE_TOKENS = [
  'o', '완료', '발행완료', '회수완료', '청구완료', '날인완료', '입금완료',
  '확인', '진행중', '계약완료', 'y',
]

const has = (n, tokens) => tokens.some((t) => n.includes(norm(t)))

// 단일 셀 값 → 상태 판정. stage 는 { rule, done, no } 를 가질 수 있다.
export function classify(raw, stage = {}) {
  const v = (raw || '').toString().trim()
  if (v === '') return 'pending'

  const n = norm(v)
  if (NA_TOKENS.includes(n)) return 'na'

  // 단계별 override 우선
  if (stage.done && has(n, stage.done)) return 'done'
  if (stage.no && has(n, stage.no)) return 'no'

  if (stage.rule === 'fill') return 'done' // 날짜/링크 계열: 값이 있으면 완료

  // token 계열: 전역 토큰 해석
  if (has(n, NO_TOKENS)) return 'no'
  if (has(n, DONE_TOKENS)) return 'done'

  // 분류 불가한 비어있지 않은 값(날짜/링크 등)은 완료로 본다
  return 'done'
}

// 스프레드시트 컬럼 문자(A, B, ... W, AA ...)를 0-based 인덱스로 변환
function colLetterToIndex(letter) {
  let n = 0
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

// 헤더 기준으로 META/스테이지 컬럼 인덱스를 1회 해석해 둔다.
// META 정의에 col(컬럼 문자)이 있으면 위치로, 없으면 헤더명으로 찾는다.
export function buildColumnMap(header) {
  const meta = {}
  for (const [k, def] of Object.entries(META)) {
    meta[k] = def.col ? colLetterToIndex(def.col) : resolveIndex(header, def.match)
  }
  const stages = {}
  for (const st of ALL_STAGES) {
    stages[st.key] = resolveIndex(header, st.match)
  }
  return { meta, stages }
}

function cell(row, idx) {
  return idx >= 0 && idx < row.length ? (row[idx] || '').trim() : ''
}

// 통화 문자열 → 숫자 ("", "-" 는 0)
function money(raw) {
  const v = (raw || '').trim()
  if (v === '' || v === '-') return 0
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}

// 한 행 → 프로젝트 객체
export function toProject(row, colMap) {
  const stages = {}
  let done = 0
  let applicable = 0

  for (const st of ALL_STAGES) {
    const status = classify(cell(row, colMap.stages[st.key]), st)
    stages[st.key] = status
    if (status !== 'na') applicable += 1
    if (status === 'done') done += 1
  }

  const progress = applicable > 0 ? Math.round((done / applicable) * 1000) / 10 : 0

  // 매출금액 회수율 = 회수액 / (회수액 + 미발행 + 미수채권)
  const collected = money(cell(row, colMap.meta.recvCollected))
  const notIssued = money(cell(row, colMap.meta.recvNotIssued))
  const unpaid = money(cell(row, colMap.meta.recvUnpaid))
  const denom = collected + notIssued + unpaid
  const recoveryRate = denom > 0 ? Math.round((collected / denom) * 1000) / 10 : null

  return {
    code: cell(row, colMap.meta.code),
    name: cell(row, colMap.meta.name),
    status: cell(row, colMap.meta.status),
    owner: cell(row, colMap.meta.owner),
    category: cell(row, colMap.meta.category),
    year: cell(row, colMap.meta.year),
    amount: cell(row, colMap.meta.amount),
    draft: cell(row, colMap.meta.draft),
    recoveryRate,
    stages,
    progress,
    done,
    applicable,
  }
}

// 전체 변환: 견적코드를 식별자로 보고, 코드가 있는 행만 프로젝트로 취급한다.
// (코드 컬럼을 못 찾은 예외 상황에서는 프로젝트명으로 대체)
export function toProjects(header, rows) {
  const colMap = buildColumnMap(header)
  const hasCodeCol = colMap.meta.code >= 0
  return rows
    .map((r) => toProject(r, colMap))
    .filter((p) => (hasCodeCol ? p.code : p.name))
}

export { GROUPS }
