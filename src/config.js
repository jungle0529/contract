// ─────────────────────────────────────────────────────────────
// 시트 연결 설정 + 단계(스테이지) 매핑
//
// 데이터는 브라우저에서 실시간으로 읽습니다(서버 없음).
// 시트는 "링크가 있는 모든 사용자 - 보기 가능" 이상으로 공유돼 있어야
// 브라우저에서 읽을 수 있습니다. (비공개면 CORS/권한 오류가 납니다)
//
// 보안: 화면에는 단계 체크(O/X/-)와 진행율만 표시합니다.
//       금액·고객사 등 대외비 값은 렌더링하지 않으며, 어떤 데이터도
//       저장소에 커밋하지 않습니다(.gitignore 참고).
// ─────────────────────────────────────────────────────────────

// 시트 ID / gid 는 URL 파라미터(?sheetId=..., ?gid=...)로도 덮어쓸 수 있습니다.
export const SHEET_ID = '1AHtE3d2-2eAy7sq2g6-L1VyoU7kt-h68Qgtv3cNDcLk'
export const GID = '0'

// Apps Script 웹앱 URL(.../exec). 설정하면 데이터와 함께 계약기안 링크 URL을 읽어온다.
// 비워두면 gviz CSV 로 읽고 계약링크는 텍스트만 표시.
// 페이지 URL ?api=<웹앱URL> 로도 덮어쓸 수 있다.
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwMTPEG-T1-em0FOPURu3iQhFHMKq_DJ9bapAGwTPie6pf1tEut7qPU_JZ2ZCrc-nKrrA/exec'

// 프로젝트 식별/메타 컬럼. match 는 시트 헤더명에 대한 후보(부분일치) 목록.
export const META = {
  code: { label: '코드', match: ['견적코드'] },
  name: { label: '프로젝트명', match: ['프로젝트명'] },
  status: { label: '진행상황', match: ['계약상태'] },
  owner: { label: '담당자', match: ['사업부 담당자', '사업부담당자', '담당자'] },
  // 대분류: 건설 / 비건설 / 공공
  category: { label: '구분', match: ['대분류'] },
  // 매출 탭 W열의 연도. 헤더가 비어 있어 컬럼 위치(letter)로 지정한다.
  year: { label: '연도', col: 'W' },

  // 계약금(AD열, 총 계약금). 대외비 금액이라 화면 노출은 SHOW_AMOUNTS 플래그로 제어.
  amount: { label: '계약금', col: 'AD' },
  // 계약링크: 계약기안 셀의 표시텍스트(실제 URL 아님)
  draft: { label: '계약링크', match: ['계약기안'] },

  // 매출금액 회수율 산정용 (CB=회수액, CC=세금계산서 미발행, CD=미수채권)
  recvCollected: { label: '회수액', col: 'CB' },
  recvNotIssued: { label: '미발행', col: 'CC' },
  recvUnpaid: { label: '미수채권', col: 'CD' },
}

// ─────────────────────────────────────────────────────────────
// 단계 정의 (매출)
//
// 각 stage 의 status 는 시트의 source 컬럼 값으로부터 derive.js 가 판정합니다.
//  - 'done' : O (초록)   완료/발행/회수/날짜·링크 채워짐
//  - 'no'   : X (빨강)   미발행/미확인/미회수 등 명시적 미완료
//  - 'na'   : - (회색)   해당없음("-")
//  - 'pending'          빈 값(아직 안 함)
//
// rule:
//  - 'fill'   : 값이 채워져 있으면 done (날짜/링크 계열)
//  - 'token'  : 값의 토큰을 해석 (상태 계열)
//
// done/no: 해당 단계에서만 적용할 추가 판정 토큰(부분일치).
//   전역 토큰(derive.js)보다 우선한다.
//
// 매핑/규칙은 시트의 실제 값 표기를 확인해 맞춘 것이다.
//   - 견적: 라벨 있는 컬럼은 '견적서(link)' 뿐이라 '발행' 한 단계로 둠
//     (발행일 컬럼은 헤더가 비어 있어 이름으로 특정 불가)
//   - 계약 '날인' 컬럼에 발송/날인 상태가 혼재("발송/수기","완료/수기"):
//     '완료' 포함 시 done, '발송' 포함 시 미완료(no)로 본다
//   - 시트엔 매입(발주서 등) 데이터가 비어 있어 매출만 구성
// ─────────────────────────────────────────────────────────────
export const GROUPS = [
  {
    key: 'contract',
    label: '계약',
    stages: [
      { key: 'c_draft', label: '기안', match: ['계약기안'], rule: 'token' },
    ],
  },
  {
    key: 'invoice',
    label: '계산서',
    stages: [
      { key: 'i_pre', label: '선금', match: ['상태(선금)', '선금상태'], rule: 'token', no: ['보류'] },
      { key: 'i_mid', label: '중도금', match: ['상태(중도금)', '중도금상태'], rule: 'token', no: ['보류'] },
      { key: 'i_bal', label: '잔금', match: ['상태(잔금)', '잔금상태'], rule: 'token', no: ['예정', '보류'] },
    ],
  },
  {
    key: 'inspect',
    label: '검수',
    stages: [
      { key: 'insp', label: '검수확인서', match: ['검수확인서'], rule: 'token' },
    ],
  },
  {
    key: 'report',
    label: '결과보고',
    stages: [
      { key: 'rep', label: '결과보고서', match: ['결과보고서'], rule: 'token' },
    ],
  },
]

// 모든 단계를 평탄화한 목록 (진행율 계산/렌더링용)
export const ALL_STAGES = GROUPS.flatMap((g) => g.stages)
