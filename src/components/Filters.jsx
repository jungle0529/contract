export default function Filters({
  query,
  setQuery,
  owner,
  setOwner,
  owners,
  status,
  setStatus,
  statuses,
  year,
  setYear,
  years,
  category,
  setCategory,
  categories,
}) {
  return (
    <section className="filters">
      <input
        className="input"
        type="search"
        placeholder="코드 · 프로젝트명 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
        {years.map((y) => (
          <option key={y} value={y}>
            연도: {y}
          </option>
        ))}
      </select>
      <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories.map((c) => (
          <option key={c} value={c}>
            구분: {c}
          </option>
        ))}
      </select>
      <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
        {owners.map((o) => (
          <option key={o} value={o}>
            담당자: {o}
          </option>
        ))}
      </select>
      <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
        {statuses.map((s) => (
          <option key={s} value={s}>
            진행상황: {s}
          </option>
        ))}
      </select>
    </section>
  )
}
