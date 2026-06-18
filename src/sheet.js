// 구글 시트를 브라우저에서 실시간으로 읽어와 행(row) 배열로 파싱한다.
//
// gviz CSV 엔드포인트(tqx=out:csv)는 공개 시트에 대해 CORS 를 허용하고,
// 리다이렉트 없이 text/csv 를 돌려주므로 브라우저 직접 호출에 가장 안전하다.
// headers=0 으로 헤더 자동해석을 끄고, 헤더 행을 직접 찾는다.

import { SHEET_ID, GID } from './config.js'

function getParam(name, fallback) {
  const v = new URLSearchParams(window.location.search).get(name)
  return v && v.trim() ? v.trim() : fallback
}

export function sheetCsvUrl() {
  const id = getParam('sheetId', SHEET_ID)
  const gid = getParam('gid', GID)
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}&headers=0`
}

// RFC4180 기반의 작은 CSV 파서 (따옴표/줄바꿈/이스케이프 처리)
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // \r\n 의 \r 무시
    } else {
      field += ch
    }
  }
  // 마지막 필드/행 flush
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase()

// '견적코드' 가 들어있는 행을 헤더 행으로 간주한다.
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (rows[i].some((c) => norm(c).includes('견적코드'))) return i
  }
  return 0
}

// 헤더명 후보(부분일치)로 컬럼 인덱스를 찾는다.
export function resolveIndex(header, candidates) {
  const normed = header.map(norm)
  for (const cand of candidates) {
    const target = norm(cand)
    const idx = normed.findIndex((h) => h && h.includes(target))
    if (idx !== -1) return idx
  }
  return -1
}

// 시트를 가져와 { header, rows } 형태로 반환
export async function fetchSheet() {
  const res = await fetch(sheetCsvUrl())
  if (!res.ok) {
    throw new Error(`시트 응답 오류 (${res.status}). 시트 공유 설정을 확인하세요.`)
  }
  const text = await res.text()
  const all = parseCsv(text)
  if (all.length === 0) throw new Error('시트가 비어 있습니다.')

  const headerIdx = findHeaderRow(all)
  const header = all[headerIdx].map((c) => (c || '').trim())
  const dataRows = all.slice(headerIdx + 1)
  return { header, rows: dataRows }
}
