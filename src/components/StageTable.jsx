import { GROUPS } from '../config.js'

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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
