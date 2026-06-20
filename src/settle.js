// 정산용 거래 추출: 매출 '회수'와 매입 '지급'을 (날짜, 금액) 단위 거래로 변환.
// 컬럼 위치는 실제 마스터 시트에서 검증한 값(헤더가 비어 있어 letter로 지정).
//   매출 회수: 선금 AV/AZ, 중도 BI/BM, 잔금 BV/BZ
//   매입 지급: 선금 Y/Z,  중도 AF/AG, 잔금 AM/AN

import { money } from './derive.js'

const idx = (letter) => {
  let n = 0
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

const SALES = {
  name: idx('C'),
  category: idx('D'), // 대분류
  partner: idx('I'), // 고객사
  owner: idx('K'), // 사업부 담당자
  code: idx('S'), // 계약코드
  recv: [
    { label: '선금', d: idx('AV'), a: idx('AZ') },
    { label: '중도금', d: idx('BI'), a: idx('BM') },
    { label: '잔금', d: idx('BV'), a: idx('BZ') },
  ],
}

const BUY = {
  code: idx('A'),
  category: idx('J'), // 종류
  partner: idx('L'), // 업체
  owner: idx('N'), // 담당자
  pay: [
    { label: '선금', d: idx('Y'), a: idx('Z'), plan: idx('U') },
    { label: '중도금', d: idx('AF'), a: idx('AG'), plan: idx('AB') },
    { label: '잔금', d: idx('AM'), a: idx('AN'), plan: idx('AI') },
  ],
}

const cell = (r, i) => (i >= 0 && i < r.length ? (r[i] || '').trim() : '')

// 'YYYY-M-D...' → 'YYYY-MM'
export function toYM(s) {
  const m = (s || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}`
}

// 'YYYY-M-D...' → 'YYYY-MM-DD' (정렬·범위비교용 정규화)
function toDateKey(s) {
  const m = (s || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

export function buildTransactions(sHeader, sRows, bHeader, bRows) {
  const tx = []
  const excluded = [] // 금액은 있으나 입·출금일이 없어 정산에 못 올라간 항목
  for (const r of sRows || []) {
    for (const inst of SALES.recv) {
      const date = cell(r, inst.d)
      const amount = money(cell(r, inst.a))
      if (amount <= 0) continue
      const ym = toYM(date)
      if (!ym) {
        excluded.push({ kind: 'sales', label: inst.label, amount, code: cell(r, SALES.code), partner: cell(r, SALES.partner) })
        continue
      }
      tx.push({
        id: `sales|${cell(r, SALES.code)}|${inst.label}|${toDateKey(date)}|${amount}|${cell(r, SALES.partner)}`,
        ym,
        dateKey: toDateKey(date),
        date,
        amount,
        kind: 'sales',
        label: inst.label,
        category: cell(r, SALES.category),
        owner: cell(r, SALES.owner),
        partner: cell(r, SALES.partner),
        code: cell(r, SALES.code),
        name: cell(r, SALES.name),
      })
    }
  }
  for (const r of bRows || []) {
    for (const inst of BUY.pay) {
      const date = cell(r, inst.d)
      const amount = money(cell(r, inst.a))
      if (amount <= 0) continue
      let ym = toYM(date)
      let dateKey = toDateKey(date)
      let label = inst.label
      // 지급일이 날짜가 아니면(상계처리예정 등) 발행일정 월로 기준
      if (!ym) {
        const plan = cell(r, inst.plan)
        if (toYM(plan)) {
          ym = toYM(plan)
          dateKey = toDateKey(plan)
          label = inst.label + ' (상계)'
        }
      }
      if (!ym) {
        excluded.push({ kind: 'purchase', label: inst.label, amount, code: cell(r, BUY.code), partner: cell(r, BUY.partner) })
        continue
      }
      tx.push({
        id: `purchase|${cell(r, BUY.code)}|${label}|${dateKey}|${amount}|${cell(r, BUY.partner)}`,
        ym,
        dateKey,
        date: dateKey,
        amount,
        kind: 'purchase',
        label,
        category: cell(r, BUY.category),
        owner: cell(r, BUY.owner),
        partner: cell(r, BUY.partner),
        code: cell(r, BUY.code),
        name: cell(r, BUY.partner),
      })
    }
  }
  return { transactions: tx, excluded }
}
