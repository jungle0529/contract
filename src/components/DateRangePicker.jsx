import { useState } from 'react'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// year, month(1-based) → 6주 x 7일 셀 배열 [{y,m,d,out}]
function monthCells(y, m) {
  const first = new Date(y, m - 1, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay()) // 그 주 일요일부터
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push({
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      d: d.getDate(),
      out: d.getMonth() + 1 !== m,
    })
  }
  return cells
}

function MonthGrid({ y, m, from, to, onPick }) {
  const cells = monthCells(y, m)
  return (
    <div className="cal">
      <div className="cal-grid cal-wds">
        {WD.map((w, i) => (
          <div key={w} className={`cal-wd ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((c, i) => {
          const key = ymd(c.y, c.m, c.d)
          const inRange = from && to && key >= from && key <= to
          const end = key === from || key === to
          return (
            <button
              key={i}
              className={`cal-day ${c.out ? 'out' : ''} ${inRange ? 'inrange' : ''} ${end ? 'end' : ''}`}
              onClick={() => onPick(key)}
            >
              {c.d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ from, to, onChange }) {
  const init = from ? from.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1, 1]
  const [view, setView] = useState({ y: init[0], m: init[1] })
  const [pendingStart, setPendingStart] = useState(null)

  const shift = (months) => {
    const t = view.y * 12 + (view.m - 1) + months
    setView({ y: Math.floor(t / 12), m: (t % 12) + 1 })
  }
  const next = { ...view }
  {
    const t = view.y * 12 + (view.m - 1) + 1
    next.y = Math.floor(t / 12)
    next.m = (t % 12) + 1
  }

  const pick = (key) => {
    if (!pendingStart) {
      setPendingStart(key)
      onChange(key, key)
    } else {
      let a = pendingStart
      let b = key
      if (b < a) [a, b] = [b, a]
      onChange(a, b)
      setPendingStart(null)
    }
  }

  return (
    <div className="cal-pop">
      <div className="cal-side">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => shift(-12)} title="이전 해">«</button>
          <button className="cal-nav" onClick={() => shift(-1)} title="이전 달">‹</button>
          <span className="cal-title">{view.y}년 {view.m}월</span>
        </div>
        <MonthGrid y={view.y} m={view.m} from={from} to={to} onPick={pick} />
      </div>
      <div className="cal-side">
        <div className="cal-head">
          <span className="cal-title">{next.y}년 {next.m}월</span>
          <button className="cal-nav" onClick={() => shift(1)} title="다음 달">›</button>
          <button className="cal-nav" onClick={() => shift(12)} title="다음 해">»</button>
        </div>
        <MonthGrid y={next.y} m={next.m} from={from} to={to} onPick={pick} />
      </div>
    </div>
  )
}
