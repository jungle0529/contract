import { useEffect, useMemo, useState } from 'react'
import { fetchSheet, fetchSheetGviz, hasAppsScript, appsScriptUrl } from './sheet.js'
import { toProjects, toBuyRows, groupBuyByCode, money } from './derive.js'
import { buildTransactions } from './settle.js'
import Filters from './components/Filters.jsx'
import StageTable from './components/StageTable.jsx'
import Settlement from './components/Settlement.jsx'

export default function App() {
  const [projects, setProjects] = useState([])
  const [transactions, setTransactions] = useState([])
  const [excluded, setExcluded] = useState([])
  const [serverExcluded, setServerExcluded] = useState(null) // 제외 탭 공유 id 목록
  const [tab, setTab] = useState('contract')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('전체')
  const [status, setStatus] = useState('전체')
  const [year, setYear] = useState('전체')
  const [category, setCategory] = useState('전체')

  // 가져온 데이터를 화면 모델로 변환해 반영
  function applyData(data) {
    const { header, rows, draftUrls, buy } = data
    if (Array.isArray(data.excludedIds)) setServerExcluded(data.excludedIds)
    const list = toProjects(header, rows, draftUrls)
    const buyMap = buy
      ? groupBuyByCode(toBuyRows(buy.header, buy.rows, buy.draftUrls))
      : new Map()
    for (const p of list) {
      p.children = buyMap.get(p.displayCode) || []
      const sales = money(p.amount)
      const cost = p.children.reduce((s, b) => s + (b.cost || 0), 0)
      p.cost = cost
      p.grossProfit = sales > 0 ? sales - cost : null
      p.profitRate = sales > 0 ? Math.round(((sales - cost) / sales) * 1000) / 10 : null
    }
    setProjects(list)
    const settle = buildTransactions(header, rows, buy?.header, buy?.rows)
    setTransactions(settle.transactions)
    setExcluded(settle.excluded)
    setUpdatedAt(new Date())
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // 1단계: gviz로 빠르게 그린다(링크 제외)
      applyData(await fetchSheetGviz())
      setLoading(false)
      // 2단계: Apps Script로 계약링크 URL을 백그라운드에서 받아 채운다
      if (hasAppsScript()) {
        fetchSheet()
          .then((full) => applyData(full))
          .catch(() => {}) // 링크 보강 실패는 무시(데이터는 이미 표시됨)
      }
    } catch (e) {
      setError(e.message || String(e))
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
    const list = projects.filter((p) => {
      if (year !== '전체' && p.year !== year) return false
      if (category !== '전체' && p.category !== category) return false
      if (owner !== '전체' && p.owner !== owner) return false
      if (status !== '전체' && p.status !== status) return false
      if (q) {
        // 매출(코드·계약코드·프로젝트명) + 매입(매입코드·업체·품목) 모두 검색
        const hay = (
          `${p.code} ${p.displayCode} ${p.name} ` +
          (p.children || []).map((b) => `${b.buyCode} ${b.vendor} ${b.item}`).join(' ')
        ).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    return list.reverse() // 최근(시트 뒤쪽 = 최신 계약)부터
  }, [projects, query, owner, status, year, category])

  return (
    <div className="app">
      <header className="topbar">
        <div className="tabs">
          <button className={`tab ${tab === 'contract' ? 'on' : ''}`} onClick={() => setTab('contract')}>
            계약 단계
          </button>
          <button className={`tab ${tab === 'settle' ? 'on' : ''}`} onClick={() => setTab('settle')}>
            정산
          </button>
        </div>
        <div className="topbar-right">
          {updatedAt && (
            <span className="updated">갱신 {updatedAt.toLocaleDateString('ko-KR')}</span>
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

      {!error && tab === 'contract' && (
        <>
          <div className="settle-head">
            <h1>계약 단계 체크</h1>
            <p className="sub">프로젝트별 매출 단계 진행 현황 · 체크 전용</p>
          </div>
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
            <StageTable projects={filtered} query={query} />
          )}
        </>
      )}

      {!error && tab === 'settle' && (
        loading && transactions.length === 0 ? (
          <div className="placeholder">불러오는 중…</div>
        ) : (
          <Settlement
            transactions={transactions}
            excluded={excluded}
            serverExcluded={serverExcluded}
            apiUrl={appsScriptUrl()}
          />
        )
      )}
    </div>
  )
}
