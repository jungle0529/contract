import { useMemo, useState, useEffect } from 'react'
import DateRangePicker from './DateRangePicker.jsx'

const EXCLUDE_KEY = 'settle-excluded-v1'

const won = (n) => '₩' + Math.round(n || 0).toLocaleString('ko-KR')
const pad = (n) => String(n).padStart(2, '0')

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}
function monthsBetween(from, to) {
  const out = []
  let c = from
  while (c <= to && out.length < 240) {
    out.push(c)
    c = addMonths(c, 1)
  }
  return out
}
const lastDay = (y, m) => new Date(y, m, 0).getDate() // m: 1-based

const PRESETS = [
  { key: '12m', label: '최근 12개월' },
  { key: 'thisYear', label: '올해' },
  { key: 'lastYear', label: '작년' },
  { key: 'all', label: '전체' },
  { key: 'month', label: '월 선택' },
  { key: 'range', label: '기간 선택' },
]

// 제외 변경을 Apps Script로 전송(text/plain + no-cors로 CORS 우회, fire-and-forget)
function postExclude(apiUrl, payload) {
  if (!apiUrl) return
  try {
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    })
  } catch {
    /* 전송 실패 무시(다음 로드 시 서버값으로 재동기화) */
  }
}

export default function Settlement({ transactions, excluded = [], serverExcluded = null, apiUrl = '' }) {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

  const [preset, setPreset] = useState('12m')
  const [selMonth, setSelMonth] = useState(thisMonth)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [category, setCategory] = useState('전체')

  // 측정 제외(가라견적 등) — 거래 id 집합, 로컬에 저장
  const [excludedIds, setExcludedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(EXCLUDE_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(EXCLUDE_KEY, JSON.stringify([...excludedIds]))
    } catch {
      /* 저장 실패 무시 */
    }
  }, [excludedIds])

  // 제외 탭(공유) 값이 도착하면 그걸 정본으로 동기화
  useEffect(() => {
    if (Array.isArray(serverExcluded)) setExcludedIds(new Set(serverExcluded))
  }, [serverExcluded])

  // 거래 단위 제외/포함 토글 + 제외 탭에 기록
  const toggleExclude = (t) =>
    setExcludedIds((prev) => {
      const n = new Set(prev)
      if (n.has(t.id)) {
        n.delete(t.id)
        postExclude(apiUrl, { action: 'remove', id: t.id })
      } else {
        n.add(t.id)
        postExclude(apiUrl, {
          action: 'add',
          id: t.id,
          meta: { kind: t.kind, code: t.code, label: t.label, date: t.dateKey, amount: t.amount, partner: t.partner },
        })
      }
      return n
    })
  const clearExcluded = () => {
    setExcludedIds(new Set())
    postExclude(apiUrl, { action: 'clear' })
  }

  const dateKeys = useMemo(
    () => transactions.map((t) => t.dateKey).filter(Boolean).sort(),
    [transactions],
  )
  const dataMin = dateKeys[0] || `${thisMonth}-01`
  const dataMax = dateKeys[dateKeys.length - 1] || `${thisMonth}-31`

  const [from, to] = useMemo(() => {
    const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
    if (preset === 'thisYear') {
      const y = now.getFullYear()
      return [ymd(y, 1, 1), ymd(y, 12, 31)]
    }
    if (preset === 'lastYear') {
      const y = now.getFullYear() - 1
      return [ymd(y, 1, 1), ymd(y, 12, 31)]
    }
    if (preset === 'all') return [dataMin, dataMax]
    if (preset === 'month') {
      const [y, m] = selMonth.split('-').map(Number)
      return [ymd(y, m, 1), ymd(y, m, lastDay(y, m))]
    }
    if (preset === 'range') {
      return [rangeFrom || dataMin, rangeTo || dataMax]
    }
    // 최근 12개월
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return [
      ymd(start.getFullYear(), start.getMonth() + 1, 1),
      ymd(end.getFullYear(), end.getMonth() + 1, end.getDate()),
    ]
  }, [preset, selMonth, rangeFrom, rangeTo, dataMin, dataMax])

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort()],
    [transactions],
  )

  // 기간·대분류 범위(제외 전) — 상세에는 제외건도 보여 토글할 수 있게
  const inScope = useMemo(
    () =>
      transactions.filter((t) => {
        if (!t.dateKey || t.dateKey < from || t.dateKey > to) return false
        if (category !== '전체' && t.category !== category) return false
        return true
      }),
    [transactions, from, to, category],
  )
  // 측정에 실제 반영되는 거래(제외건 뺀 것)
  const active = useMemo(() => inScope.filter((t) => !excludedIds.has(t.id)), [inScope, excludedIds])

  const months = useMemo(() => monthsBetween(from.slice(0, 7), to.slice(0, 7)), [from, to])
  const rows = useMemo(() => {
    const map = new Map(months.map((m) => [m, { sales: 0, purchase: 0 }]))
    for (const t of active) {
      const b = map.get(t.ym)
      if (b) b[t.kind] += t.amount
    }
    let cum = 0
    return months.map((m) => {
      const b = map.get(m)
      const net = b.sales - b.purchase
      cum += net
      return { m, sales: b.sales, purchase: b.purchase, net, cum }
    })
  }, [months, active])

  const totalSales = active.reduce((s, t) => (t.kind === 'sales' ? s + t.amount : s), 0)
  const totalPurchase = active.reduce((s, t) => (t.kind === 'purchase' ? s + t.amount : s), 0)
  const maxBar = Math.max(1, ...rows.flatMap((r) => [r.sales, r.purchase]))
  const displayRows = useMemo(() => [...rows].reverse(), [rows]) // 최신순(최근이 위)
  const monthDetail = (m) => inScope.filter((t) => t.ym === m).sort((a, b) => a.dateKey.localeCompare(b.dateKey))

  // 사용자가 제외한 거래(가라견적 등) 요약
  const excludedTx = useMemo(() => transactions.filter((t) => excludedIds.has(t.id)), [transactions, excludedIds])
  const excludedSum = excludedTx.reduce((s, t) => s + t.amount, 0)

  // 금액은 있으나 입·출금일 미입력 → 정산 미반영
  const exSales = excluded.filter((e) => e.kind === 'sales')
  const exBuy = excluded.filter((e) => e.kind === 'purchase')
  const exSalesSum = exSales.reduce((s, e) => s + e.amount, 0)
  const exBuySum = exBuy.reduce((s, e) => s + e.amount, 0)
  const [showEx, setShowEx] = useState(false)

  return (
    <div className="settle">
      <div className="settle-head">
        <h1>정산 (매출·매입)</h1>
        <p className="sub">선택 기간의 매출 회수금액과 매입 지급비용을 비교합니다. (실제 입·출금일 기준)</p>
      </div>

      <div className="settle-filters">
        {PRESETS.map((p) => (
          <button key={p.key} className={`chip ${preset === p.key ? 'on' : ''}`} onClick={() => setPreset(p.key)}>
            {p.label}
          </button>
        ))}
        {preset === 'month' && (
          <input className="input sm" type="month" value={selMonth} onChange={(e) => setSelMonth(e.target.value)} />
        )}
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>대분류: {c}</option>
          ))}
        </select>
      </div>

      {preset === 'range' && (
        <DateRangePicker from={rangeFrom} to={rangeTo} onChange={(a, b) => { setRangeFrom(a); setRangeTo(b) }} />
      )}

      <section className="settle-cards">
        <div className="card"><div className="card-n blue">{won(totalSales)}</div><div className="card-label">매출 회수 합</div></div>
        <div className="card"><div className="card-n orange">{won(totalPurchase)}</div><div className="card-label">매입 지급 합</div></div>
        <div className="card"><div className="card-n green">{won(totalSales - totalPurchase)}</div><div className="card-label">순액 (매출−매입)</div></div>
        <div className="card"><div className="card-n sm-n">{from} ~ {to}</div><div className="card-label">기간 ({months.length}개월)</div></div>
      </section>

      {excluded.length > 0 && (
        <div className="ex-notice">
          <div className="ex-head" onClick={() => setShowEx(!showEx)}>
            <strong>입·출금일 미입력으로 정산 미반영</strong>{' '}
            매출 {exSales.length}건 {won(exSalesSum)} · 매입 {exBuy.length}건 {won(exBuySum)}
            <span className="ex-toggle">{showEx ? '접기 ▾' : '자세히 ▸'}</span>
          </div>
          {showEx && (
            <ul className="ex-list">
              {excluded.map((e, i) => (
                <li key={i}>
                  <span className={`kind ${e.kind}`}>{e.kind === 'sales' ? '매출' : '매입'}</span>
                  {e.code} · {e.partner || '-'} · {e.label} · {won(e.amount)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {excludedTx.length > 0 && (
        <div className="xx-notice">
          측정 제외(가라견적 등) <strong>{excludedTx.length}건 {won(excludedSum)}</strong>
          <span className="xx-share">· 모든 사용자 공유</span>
          <button className="xx-clear" onClick={clearExcluded}>모두 해제</button>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">월별 추이 (매출 vs 매입)</div>
        <div className="legend"><span className="dot blue" />매출 회수<span className="dot orange" />매입 지급</div>
        <div className="hchart">
          {displayRows.map((r) => (
            <div className="hrow" key={r.m} title={`${r.m}\n매출 ${won(r.sales)}\n매입 ${won(r.purchase)}`}>
              <div className="hlabel">{r.m}</div>
              <div className="htrack">
                <div className="hbar sales" style={{ width: `${(r.sales / maxBar) * 100}%` }} />
                <div className="hbar purchase" style={{ width: `${(r.purchase / maxBar) * 100}%` }} />
              </div>
            </div>
          ))}
          {displayRows.length === 0 && <div className="empty sm">기간 내 거래가 없습니다.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">월별 표</div>
        <table className="settle-table">
          <thead>
            <tr>
              <th className="left">월</th>
              <th className="right">매출 회수</th>
              <th className="right">매입 지급</th>
              <th className="right">순액</th>
              <th className="right">누계</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <MonthRow
                key={r.m}
                r={r}
                detail={monthDetail(r.m)}
                excludedIds={excludedIds}
                toggleExclude={toggleExclude}
              />
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="empty">기간 내 거래가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function MonthRow({ r, detail, excludedIds, toggleExclude }) {
  return (
    <>
      <tr className="m-row static">
        <td className="left">{r.m}</td>
        <td className="right">{won(r.sales)}</td>
        <td className="right">{won(r.purchase)}</td>
        <td className={`right ${r.net < 0 ? 'neg' : 'pos'}`}>{won(r.net)}</td>
        <td className={`right ${r.cum < 0 ? 'neg' : 'pos'}`}>{won(r.cum)}</td>
      </tr>
      {detail && detail.length > 0 && (
        <tr className="detail-row">
          <td colSpan={5}>
            {detail.length === 0 ? (
              <div className="empty sm">이 달 거래 없음</div>
            ) : (
              <table className="detail-table">
                <tbody>
                  {detail.map((t, i) => {
                    const off = excludedIds.has(t.id)
                    return (
                      <tr key={i} className={off ? 'excluded' : ''}>
                        <td className={`kind ${t.kind}`}>{t.kind === 'sales' ? '매출' : '매입'}</td>
                        <td>{t.dateKey}</td>
                        <td className="left">{t.partner || '-'}</td>
                        <td className="left dim">{t.name || t.code}</td>
                        <td className="dim">{t.label}</td>
                        <td className="right">{won(t.amount)}</td>
                        <td className="right">
                          <button
                            className={`xx-btn ${off ? 'on' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleExclude(t) }}
                            title={off ? '측정에 다시 포함' : '측정에서 제외(가라견적 등)'}
                          >
                            {off ? '포함' : '제외'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
