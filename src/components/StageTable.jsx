import { Fragment, useState } from 'react'
import { GROUPS } from '../config.js'

// 계약금(대외비 금액) 노출 여부. 공개 빌드는 false → 표시 안 함.
// 인증 호스팅에서 빌드 시 VITE_SHOW_AMOUNTS=true 로 켠다.
const SHOW_AMOUNTS = import.meta.env.VITE_SHOW_AMOUNTS === 'true'

// 계약링크 컬럼을 어느 그룹 오른쪽에 둘지
const DRAFT_AFTER = 'contract'

// 본문 전체 컬럼 수 (매입 하위행 colSpan용)
const STAGE_COUNT = GROUPS.reduce((n, g) => n + g.stages.length, 0)
const COLS = 4 + STAGE_COUNT + 1 /*계약링크*/ + 1 /*회수율*/ + (SHOW_AMOUNTS ? 1 : 0)

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

function Rate({ rate }) {
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

function LinkCell({ url, text }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {text || '바로가기'}
      </a>
    )
  }
  return text || '-'
}

// 매입 하위 표 (모든 인스턴스 동일 폭: table-layout fixed + colgroup)
function BuyTable({ rows }) {
  return (
    <table className="buy-table">
      <colgroup>
        <col style={{ width: '120px' }} />
        <col style={{ width: '260px' }} />
        <col style={{ width: '64px' }} />
        <col style={{ width: '90px' }} />
        <col style={{ width: '64px' }} />
        <col style={{ width: '64px' }} />
        <col style={{ width: '64px' }} />
        <col style={{ width: '150px' }} />
      </colgroup>
      <thead>
        <tr>
          <th rowSpan={2}>매입코드</th>
          <th rowSpan={2} className="left">업체</th>
          <th rowSpan={2}>계약</th>
          <th rowSpan={2}>계약링크</th>
          <th colSpan={3}>지급요청서</th>
          <th rowSpan={2}>지급율</th>
        </tr>
        <tr>
          <th>선금</th>
          <th>중도금</th>
          <th>잔금</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => (
          <tr key={`${b.buyCode}-${i}`}>
            <td className="code">{b.buyCode || '-'}</td>
            <td className="left" title={b.vendor}>{b.vendor || '-'}</td>
            <td className="cell"><Mark status={b.stages.b_draft} /></td>
            <td className="draft"><LinkCell url={b.draftUrl} text={b.draft} /></td>
            <td className="cell"><Mark status={b.stages.b_pre} /></td>
            <td className="cell"><Mark status={b.stages.b_mid} /></td>
            <td className="cell"><Mark status={b.stages.b_bal} /></td>
            <td className="progress"><Rate rate={b.payRate} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function StageTable({ projects }) {
  const [expanded, setExpanded] = useState(() => new Set())

  if (projects.length === 0) {
    return <div className="placeholder">표시할 프로젝트가 없습니다.</div>
  }

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="table-wrap">
      <table className="stage-table">
        <thead>
          <tr className="group-row">
            <th className="sticky-col" rowSpan={2}>코드</th>
            <th className="sticky-col2 left" rowSpan={2}>프로젝트명</th>
            <th className="sticky-col3" rowSpan={2}>진행상황</th>
            <th className="sticky-col4" rowSpan={2}>담당자</th>
            {GROUPS.map((g) => (
              <Fragment key={g.key}>
                <th colSpan={g.stages.length} className={`grp grp-${g.key}`}>
                  {g.label}
                </th>
                {g.key === DRAFT_AFTER && <th rowSpan={2}>계약링크</th>}
              </Fragment>
            ))}
            <th rowSpan={2}>매출 회수율</th>
            {SHOW_AMOUNTS && <th rowSpan={2}>계약금</th>}
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
          {projects.map((p, i) => {
            const key = `${p.code}-${i}`
            const hasChildren = p.children && p.children.length > 0
            const open = expanded.has(key)
            return (
              <Fragment key={key}>
                <tr className={hasChildren ? 'has-children' : ''}>
                  <td className="sticky-col code">
                    {hasChildren && (
                      <button
                        className="expander"
                        onClick={() => toggle(key)}
                        title={`매입 ${p.children.length}건`}
                      >
                        {open ? '▾' : '▸'}
                      </button>
                    )}
                    {p.displayCode || '-'}
                  </td>
                  <td className="sticky-col2 left name" title={p.name}>{p.name}</td>
                  <td className="status sticky-col3">{p.status}</td>
                  <td className="owner sticky-col4">{p.owner}</td>
                  {GROUPS.map((g) => (
                    <Fragment key={g.key}>
                      {g.stages.map((s) => (
                        <td key={s.key} className="cell">
                          <Mark status={p.stages[s.key]} />
                        </td>
                      ))}
                      {g.key === DRAFT_AFTER && (
                        <td className="draft">
                          <LinkCell url={p.draftUrl} text={p.draft} />
                        </td>
                      )}
                    </Fragment>
                  ))}
                  <td className="progress">
                    <Rate rate={p.recoveryRate} />
                  </td>
                  {SHOW_AMOUNTS && <td className="amount">{p.amount || '-'}</td>}
                </tr>
                {open && hasChildren && (
                  <tr className="child-row">
                    <td colSpan={COLS} className="child-cell">
                      <div className="buy-panel">
                        <div className="buy-title">매입 {p.children.length}건</div>
                        <BuyTable rows={p.children} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
