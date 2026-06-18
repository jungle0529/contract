import { GROUPS } from '../config.js'

// 계약금(대외비 금액) 노출 여부. 공개 빌드는 false → 표시 안 함.
// 인증 호스팅에서 빌드 시 VITE_SHOW_AMOUNTS=true 로 켠다.
const SHOW_AMOUNTS = import.meta.env.VITE_SHOW_AMOUNTS === 'true'

const MARK = {
  done: { t: 'O', cls: 'm-done' },
  no: { t: 'X', cls: 'm-no' },
  na: { t: '-', cls: 'm-na' },
  pending: { t: '', cls: 'm-pending' },
}

function Mark({ status }) {
  const m = MARK[status] || MARK.pending
  return <span className={`mark ${m.cls}`}>{m.t}</span>
}

// 회수율 셀 (없으면 '-')
function Recovery({ rate }) {
  if (rate == null) return <span className="pct muted">-</span>
  return (
    <>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${rate}%` }} />
      </div>
      <span className="pct">{rate}%</span>
    </>
  )
}

export default function StageTable({ projects }) {
  if (projects.length === 0) {
    return <div className="placeholder">표시할 프로젝트가 없습니다.</div>
  }

  return (
    <div className="table-wrap">
      <table className="stage-table">
        <thead>
          <tr className="group-row">
            <th className="sticky-col" rowSpan={2}>코드</th>
            <th className="sticky-col2 left" rowSpan={2}>프로젝트명</th>
            <th rowSpan={2}>진행상황</th>
            <th rowSpan={2}>담당자</th>
            {GROUPS.map((g) => (
              <th key={g.key} colSpan={g.stages.length} className={`grp grp-${g.key}`}>
                {g.label}
              </th>
            ))}
            <th rowSpan={2}>매출 회수율</th>
            {SHOW_AMOUNTS && <th rowSpan={2}>계약금</th>}
            <th rowSpan={2}>계약링크</th>
          </tr>
          <tr className="sub-row">
            {GROUPS.flatMap((g) =>
              g.stages.map((s) => (
                <th key={s.key} className={`grp-${g.key}`}>
                  {s.label}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr key={`${p.code}-${i}`}>
              <td className="sticky-col code">{p.code}</td>
              <td className="sticky-col2 left name" title={p.name}>{p.name}</td>
              <td className="status">{p.status}</td>
              <td className="owner">{p.owner}</td>
              {GROUPS.flatMap((g) =>
                g.stages.map((s) => (
                  <td key={s.key} className="cell">
                    <Mark status={p.stages[s.key]} />
                  </td>
                )),
              )}
              <td className="progress">
                <Recovery rate={p.recoveryRate} />
              </td>
              {SHOW_AMOUNTS && <td className="amount">{p.amount || '-'}</td>}
              <td className="draft">
                {p.draftUrl ? (
                  <a href={p.draftUrl} target="_blank" rel="noreferrer">
                    {p.draft || '바로가기'}
                  </a>
                ) : (
                  p.draft || '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
