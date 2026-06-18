import { useEffect, useMemo, useState } from 'react'
import { fetchSheet } from './sheet.js'
import { toProjects } from './derive.js'
import Summary from './components/Summary.jsx'
import Filters from './components/Filters.jsx'
import StageTable from './components/StageTable.jsx'

export default function App() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('전체')
  const [status, setStatus] = useState('전체')
  const [year, setYear] = useState('전체')
  const [category, setCategory] = useState('전체')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { header, rows } = await fetchSheet()
      setProjects(toProjects(header, rows))
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const owners = useMemo(
    () => ['전체', ...Array.from(new Set(projects.map((p) => p.owner).filter(Boolean))).sort()],
    [projects],
  )
  const statuses = useMemo(
    () => ['전체', ...Array.from(new Set(projects.map((p) => p.status).filter(Boolean))).sort()],
    [projects],
  )
  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(projects.map((p) => p.category).filter(Boolean))).sort()],
    [projects],
  )
  // 연도는 최신순(내림차순) 정렬
  const years = useMemo(
    () => [
      '전체',
      ...Array.from(new Set(projects.map((p) => p.year).filter(Boolean))).sort((a, b) =>
        b.localeCompare(a),
      ),
    ],
    [projects],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (year !== '전체' && p.year !== year) return false
      if (category !== '전체' && p.category !== category) return false
      if (owner !== '전체' && p.owner !== owner) return false
      if (status !== '전체' && p.status !== status) return false
      if (q && !`${p.code} ${p.name}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [projects, query, owner, status, year, category])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>계약 단계 체크</h1>
          <p className="sub">프로젝트별 매출 단계 진행 현황 · 체크 전용</p>
        </div>
        <div className="topbar-right">
          {updatedAt && (
            <span className="updated">갱신 {updatedAt.toLocaleTimeString('ko-KR')}</span>
          )}
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error">
          <strong>시트를 불러오지 못했습니다.</strong>
          <p>{error}</p>
          <p className="hint">
            시트 공유 설정이 "링크가 있는 모든 사용자 - 뷰어" 이상인지 확인하세요.
            URL 파라미터 <code>?sheetId=…&amp;gid=…</code> 로 다른 시트를 지정할 수도 있습니다.
          </p>
        </div>
      )}

      {!error && (
        <>
          <Summary projects={projects} filtered={filtered} />
          <Filters
            query={query}
            setQuery={setQuery}
            owner={owner}
            setOwner={setOwner}
            owners={owners}
            status={status}
            setStatus={setStatus}
            statuses={statuses}
            year={year}
            setYear={setYear}
            years={years}
            category={category}
            setCategory={setCategory}
            categories={categories}
          />
          {loading && projects.length === 0 ? (
            <div className="placeholder">불러오는 중…</div>
          ) : (
            <StageTable projects={filtered} />
          )}
        </>
      )}
    </div>
  )
}
