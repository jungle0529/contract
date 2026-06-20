import { useMemo, useState } from 'react'

const won = (n) => '₩' + Math.round(n || 0).toLocaleString('ko-KR')

function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
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
function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const PRESETS = [
  { key: '12m', label: '최근 12개월' },
  { key: 'thisYear', label: '올해' },
  { key: 'lastYear', label: '작년' },
  { key: 'all', label: '전체' },
  { key: 'custom', label: '기간 직접지정' },
]

export default function Settlement({ transactions }) {
  const [preset, setPreset] = useState('12m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [category, setCategory] = useState('전체')
  const [owner, setOwner] = useState('전체')
  const [partnerQ, setPartnerQ] = useState('')
  const [openMonth, setOpenMonth] = useState(null)

  const nowYM = currentYM()
  const sorted = useMemo(() => transactions.map((t) => t.ym).sort(), [transactions])
  const dataMin = sorted[0] || nowYM
  const dataMax = sorted[sorted.length - 1] || nowYM

  const [from, to] = useMemo(() => {
    if (preset === 'thisYear') {
      const y = nowYM.slice(0, 4)
      return [`${y}-01`, `${y}-12`]
    }
    if (preset === 'lastYear') {
      const y = String(+nowYM.slice(0, 4) - 1)
      return [`${y}-01`, `${y}-12`]
    }
    if (preset === 'all') return [dataMin, dataMax]
    if (preset === 'custom') return [customFrom || dataMin, customTo || nowYM]
    return [addMonths(nowYM, -11), nowYM] // 최근 12개월
  }, [preset, customFrom, customTo, nowYM, dataMin, dataMax])

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))).sort()],
    [transactions],
  )
  const owners = useMemo(
    () => ['전체', ...Array.from(new Set(transactions.map((t) => t.owner).filter(Boolean))).sort()],
    [transactions],
  )

  const filtered = useMemo(() => {
    const pq = partnerQ.trim().toLowerCase()
    return transactions.filter((t) => {
      if (t.ym < from || t.ym > to) return false
      if (category !== '전체' && t.category !== category) return false
      if (owner !== '전체' && t.owner !== owner) return false
      if (pq && !(t.partner || '').toLowerCase().includes(pq)) return false
      return true
    })
  }, [transactions, from, to, category, owner, partnerQ])

  const months = useMemo(() => monthsBetween(from, to), [from, to])
  const rows = useMemo(() => {
    const map = new Map(months.map((m) => [m, { sales: 0, purchase: 0 }]))
    for (const t of filtered) {
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
  }, [months, filtered])

  const totalSales = filtered.reduce((s, t) => (t.kind === 'sales' ? s + t.amount : s), 0)
  const totalPurchase = filtered.reduce((s, t) => (t.kind === 'purchase' ? s + t.amount : s), 0)
  const maxBar = Math.max(1, ...rows.flatMap((r) => [r.sales, r.purchase]))

  const monthDetail = (m) =>
    filtered.filter((t) => t.ym === m).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="settle">
      <div className="settle-head">
        <h1>정산 (매출·매입)</h1>
        <p className="sub">선택 기간의 매출 회수금액과 매입 지급비용을 비교합니다. (실제 입·출금일 기준)</p>
      </div>

      <div className="settle-filters">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={`chip ${preset === p.key ? 'on' : ''}`}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <span className="custom-range">
            <input className="input sm" type="month" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span>~</span>
            <input className="input sm" type="month" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </span>
        )}
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>대분류: {c}</option>
          ))}
        </select>
        <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map((o) => (
            <option key={o} value={o}>담당자: {o}</option>
          ))}
        </select>
        <input
          className="input"
          type="search"
          placeholder="거래처 검색"
          value={partnerQ}
          onChange={(e) => setPartnerQ(e.target.value)}
        />
      </div>

      <section className="settle-cards">
        <div className="card"><div className="card-n blue">{won(totalSales)}</div><div className="card-label">매출 회수 합</div></div>
        <div className="card"><div className="card-n orange">{won(totalPurchase)}</div><div className="card-label">매입 지급 합</div></div>
        <div className="card"><div className="card-n green">{won(totalSales - totalPurchase)}</div><div className="card-label">순액 (매출−매입)</div></div>
        <div className="card"><div className="card-n">{from} ~ {to}</div><div className="card-label">기간 ({months.length}개월)</div></div>
      </section>

      <section className="panel">
        <div className="panel-title">월별 추이 (매출 vs 매입)</div>
        <div className="legend"><span className="dot blue" />매출 회수<span className="dot orange" />매입 지급</div>
        <div className="chart">
          {rows.map((r) => (
            <div className="bar-col" key={r.m} title={`${r.m}\n매출 ${won(r.sales)}\n매입 ${won(r.purchase)}`}>
              <div className="bars">
                <div className="b sales" style={{ height: `${(r.sales / maxBar) * 100}%` }} />
                <div className="b purchase" style={{ height: `${(r.purchase / maxBar) * 100}%` }} />
              </div>
              <div className="bar-x">{r.m.slice(2)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">월별 표 (행 클릭 시 그 달 거래 상세)</div>
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
            {rows.map((r) => (
              <FragmentRow
                key={r.m}
                r={r}
                open={openMonth === r.m}
                onToggle={() => setOpenMonth(openMonth === r.m ? null : r.m)}
                detail={openMonth === r.m ? monthDetail(r.m) : null}
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

function FragmentRow({ r, open, onToggle, detail }) {
  return (
    <>
      <tr className={`m-row ${open ? 'open' : ''}`} onClick={onToggle}>
        <td className="left">{r.m}</td>
        <td className="right">{won(r.sales)}</td>
        <td className="right">{won(r.purchase)}</td>
        <td className={`right ${r.net < 0 ? 'neg' : 'pos'}`}>{won(r.net)}</td>
        <td className={`right ${r.cum < 0 ? 'neg' : 'pos'}`}>{won(r.cum)}</td>
      </tr>
      {open && detail && (
        <tr className="detail-row">
          <td colSpan={5}>
            {detail.length === 0 ? (
              <div className="empty sm">이 달 거래 없음</div>
            ) : (
              <table className="detail-table">
                <tbody>
                  {detail.map((t, i) => (
                    <tr key={i}>
                      <td className={`kind ${t.kind}`}>{t.kind === 'sales' ? '매출' : '매입'}</td>
                      <td>{t.date}</td>
                      <td className="left">{t.partner || '-'}</td>
                      <td className="left dim">{t.kind === 'sales' ? t.name : t.code}</td>
                      <td className="dim">{t.label}</td>
                      <td className="right">{won(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
