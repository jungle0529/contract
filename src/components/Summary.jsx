// 상단 요약 카드 (첨부 이미지의 통계 카드와 유사)
export default function Summary({ projects, filtered }) {
  const total = projects.length
  const done = projects.filter((p) => p.progress >= 100).length
  const inProgress = projects.filter((p) => p.progress > 0 && p.progress < 100).length
  const notStarted = projects.filter((p) => p.progress === 0).length

  const cards = [
    { n: total, label: '전체 프로젝트' },
    { n: done, label: '완료 (100%)' },
    { n: inProgress, label: '진행 중' },
    { n: notStarted, label: '미착수' },
  ]

  return (
    <section className="summary">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="card-n">{c.n}</div>
          <div className="card-label">{c.label}</div>
        </div>
      ))}
      <div className="card card-muted">
        <div className="card-n">{filtered.length}</div>
        <div className="card-label">현재 표시 중</div>
      </div>
    </section>
  )
}
