import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ALL, GROUPS, PICKS, specialDetail } from './data.js'
import { INFO, PLAN, PHRASES } from './info.js'
import L from 'leaflet'
import 'leaflet.markercluster'

/* ---------- helpers ---------- */
const openUrl = (u) => window.open(u, '_blank', 'noopener')
const dirUrl = (name, lat, lng, pos) => {
  const dest = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(name + ' 오사카')
  const o = pos ? `&origin=${pos.lat},${pos.lng}` : ''
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${dest}&travelmode=walking`
}
const seeUrl = (name, lat, lng) => {
  const q = (lat && lng) ? `${lat},${lng}(${encodeURIComponent(name)})` : encodeURIComponent(name + ' 오사카')
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}
const igUrl = (name, h) => h ? `https://instagram.com/${h}` : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(name + ' 大阪')}`
const hav = (a, b, c, d) => { const R = 6371000, p = Math.PI / 180; const x = (c - a) * p, y = (d - b) * p; const s = Math.sin(x / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)) }
const fmtD = (m) => m < 1000 ? Math.round(m) + 'm' : (m / 1000).toFixed(1) + 'km'

// 🔒 비밀번호: 바꾸려면 따옴표 안 값만 수정 후 재빌드/배포
const PASS = '0627'
const grad = (c) => `linear-gradient(135deg, ${c}, ${c}bb)`

function useLS(key, init) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init } catch { return init } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, setV]
}

/* ---------- App ---------- */
export default function App() {
  const [authed, setAuthed] = useLS('og_auth', false)
  const [view, setView] = useState('explore')
  const [pos, setPos] = useState(null)
  const [favs, setFavs] = useLS('og_favs', [])
  const [itin, setItin] = useLS('og_itin', {})
  const [detail, setDetail] = useState(null)
  const [gpsMsg, setGpsMsg] = useState('')

  const isFav = (id) => favs.includes(id)
  const toggleFav = (id) => setFavs(favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id])
  const addToDay = (day, id) => setItin(prev => {
    const arr = prev[day] || []
    return { ...prev, [day]: arr.includes(id) ? arr : [...arr, id] }
  })
  const removeFromDay = (day, id) => setItin(prev => ({ ...prev, [day]: (prev[day] || []).filter(x => x !== id) }))

  const locate = (cb) => {
    if (!navigator.geolocation) { alert('위치 미지원'); return }
    setGpsMsg('📡 위치 잡는 중…')
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsMsg('✅ 현재 위치 (±' + Math.round(p.coords.accuracy) + 'm)'); cb && cb() },
      () => { setGpsMsg('❌ 위치 실패 — 권한 허용 필요'); alert('위치 권한을 허용해 주세요') },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  if (!authed) return <Login onOk={() => setAuthed(true)} />

  return (
    <div className="app">
      <header className="hdr">
        <div className="h1">🐙 오사카 커플 가이드</div>
        <div className="hsub">Crystal Court Namba · 6.27–7.1 · 오타쿠·패션·카페·맛집 ☔</div>
      </header>

      <main className="main">
        {view === 'explore' && <Explore {...{ pos, locate, gpsMsg, favs, isFav, toggleFav, setDetail }} />}
        {view === 'map' && <MapView {...{ pos, locate, gpsMsg, setDetail }} />}
        {view === 'plan' && <Plan {...{ itin, removeFromDay, setDetail }} />}
        {view === 'fav' && <Favs {...{ favs, isFav, toggleFav, pos, setDetail }} />}
        {view === 'info' && <Info />}
      </main>

      {detail && <Detail item={detail} {...{ pos, isFav, toggleFav, addToDay, onClose: () => setDetail(null) }} />}

      <nav className="bnav">
        {[['explore', '🔎', '탐색'], ['map', '🗺️', '지도'], ['plan', '📅', '일정'], ['fav', '♥', '즐겨찾기'], ['info', 'ℹ️', '정보']].map(([k, e, l]) =>
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}><span className="be">{e}</span>{l}</button>
        )}
      </nav>
    </div>
  )
}

/* ---------- Spot Card ---------- */
function Card({ it, pos, isFav, toggleFav, onOpen }) {
  const g = GROUPS[it.g] || { color: '#888', emoji: '📍', label: it.gl }
  const dist = (pos && it.lat) ? hav(pos.lat, pos.lng, it.lat, it.lng) : null
  return (
    <div className="card">
      <div className="thumb" style={{ background: grad(g.color) }} onClick={onOpen}>{g.emoji}</div>
      <div className="cinfo" onClick={onOpen}>
        <div className="cnm">{it.n}</div>
        {it.note && <div className="cnote">{it.note}</div>}
        <div className="ctags">
          <span className="pill area">📍{it.a}</span>
          <span className="pill cat">{it.tag || g.label}</span>
          {it.rain && <span className="pill rain">☔실내</span>}
          {dist != null && <span className="pill dist">{fmtD(dist)}</span>}
        </div>
      </div>
      <div className="cbtns">
        <button className={'ib' + (isFav(it.id) ? ' fav' : '')} onClick={() => toggleFav(it.id)} aria-label="즐겨찾기">{isFav(it.id) ? '♥' : '♡'}</button>
        <button className="ib ig" onClick={() => openUrl(igUrl(it.n, it.ig))}>📷</button>
        <button className="ib go" onClick={() => openUrl(dirUrl(it.n, it.lat, it.lng, pos))}>🧭</button>
      </div>
    </div>
  )
}

/* ---------- Explore ---------- */
function Explore({ pos, locate, gpsMsg, favs, isFav, toggleFav, setDetail }) {
  const [q, setQ] = useState('')
  const [grp, setGrp] = useState('all')
  const groupKeys = Object.keys(GROUPS).filter(k => ALL.some(x => x.g === k))

  const items = useMemo(() => {
    let r = ALL.filter(x => grp === 'all' ? true : grp === 'rain' ? x.rain : x.g === grp)
    if (q.trim()) { const ql = q.trim().toLowerCase(); r = r.filter(x => (x.n + x.a + x.tag + x.note + x.gl).toLowerCase().includes(ql)) }
    if (pos) r = [...r].map(x => ({ ...x, _d: x.lat ? hav(pos.lat, pos.lng, x.lat, x.lng) : 9e9 })).sort((a, b) => a._d - b._d)
    return r
  }, [q, grp, pos])

  const showHome = grp === 'all' && !q.trim()
  const PG = ['linear-gradient(135deg,#ff4d8d,#ff8a3d)', 'linear-gradient(135deg,#7c5cff,#2a9df4)', 'linear-gradient(135deg,#15c39a,#2a9df4)', 'linear-gradient(135deg,#ff8a00,#ff5638)', 'linear-gradient(135deg,#ff5638,#ff4d8d)', 'linear-gradient(135deg,#2a9df4,#7c5cff)']
  return (
    <div>
      <input className="search" placeholder="🔎 라멘, 가챠, 비오는날 카페, 우메다…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="gpsRow">
        <button className="gpsBtn" onClick={() => locate()}>📍 내 위치 · 가까운 순</button>
        {gpsMsg && <span className="muted">{gpsMsg}</span>}
      </div>

      {showHome &&
        <div className="cats">
          {groupKeys.map(k =>
            <button key={k} className="catTile" style={{ background: grad(GROUPS[k].color) }} onClick={() => setGrp(k)}>
              <span className="catE">{GROUPS[k].emoji}</span>
              <span className="catL">{GROUPS[k].label}</span>
              <span className="catC">{ALL.filter(x => x.g === k).length}곳</span>
            </button>
          )}
        </div>}

      {showHome &&
        <div className="picks">
          <div className="picksH">📸 인스타 감성 PICK</div>
          <div className="picksRow">
            {PICKS.map((p, i) => {
              const m = ALL.find(x => x.n.includes(p.n.slice(0, 4)) || p.n.includes(x.n.slice(0, 4)))
              const em = (m && GROUPS[m.g]) ? GROUPS[m.g].emoji : '✨'
              return (
                <div key={i} className="pick" onClick={() => { if (m) setDetail(m) }}>
                  <div className="pickTop" style={{ background: PG[i % PG.length] }}>{em}</div>
                  <div className="pickBody">
                    <div className="pickN">{p.n}</div>
                    <div className="pickA">📍 {p.a}</div>
                    <div className="pickC">{p.cap}</div>
                    <div className="pickL">
                      <button onClick={(e) => { e.stopPropagation(); openUrl(igUrl(p.n, p.ig)) }}>📷 인스타</button>
                      <button onClick={(e) => { e.stopPropagation(); openUrl(dirUrl(p.n, null, null, pos)) }}>🧭 길찾기</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>}

      <div className="chips">
        <Chip on={grp === 'all'} onClick={() => setGrp('all')}>전체 {ALL.length}</Chip>
        <Chip on={grp === 'rain'} onClick={() => setGrp('rain')}>☔ 실내</Chip>
        {groupKeys.map(k => <Chip key={k} on={grp === k} onClick={() => setGrp(k)}>{GROUPS[k].emoji} {GROUPS[k].label}</Chip>)}
      </div>
      <div className="count">{items.length}곳{pos ? ' · 가까운 순' : ''}{showHome ? ' · 전체' : ''}</div>
      <div className="list">
        {items.map(it => <Card key={it.id} {...{ it, pos, isFav, toggleFav }} onOpen={() => setDetail(it)} />)}
      </div>
    </div>
  )
}
const Chip = ({ on, onClick, children }) => <button className={'chip' + (on ? ' on' : '')} onClick={onClick}>{children}</button>

/* ---------- Map ---------- */
function MapView({ pos, locate, gpsMsg, setDetail }) {
  const ref = useRef(null), mapRef = useRef(null), meRef = useRef(null)
  useEffect(() => {
    if (mapRef.current || !ref.current) return
    const map = L.map(ref.current).setView([34.6665, 135.502], 14)
    mapRef.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map)
    const cluster = L.markerClusterGroup({ maxClusterRadius: 45 })
    ALL.filter(x => x.lat).forEach(x => {
      const g = GROUPS[x.g] || { color: '#888' }
      const mk = L.circleMarker([x.lat, x.lng], { radius: 7, color: '#0b0d12', weight: 1, fillColor: g.color, fillOpacity: .95 })
      mk.on('click', () => setDetail(x))
      mk.bindTooltip(x.n, { direction: 'top' })
      cluster.addLayer(mk)
    })
    map.addLayer(cluster)
    setTimeout(() => map.invalidateSize(), 100)
  }, [])
  useEffect(() => {
    const map = mapRef.current; if (!map || !pos) return
    if (meRef.current) meRef.current.setLatLng([pos.lat, pos.lng])
    else meRef.current = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2a6cff', fillOpacity: 1 }).addTo(map).bindPopup('📍 내 위치')
    map.setView([pos.lat, pos.lng], 15)
  }, [pos])
  return (
    <div>
      <div className="gpsRow">
        <button className="gpsBtn" onClick={() => locate()}>📍 내 위치 잡기</button>
        {gpsMsg && <span className="muted">{gpsMsg}</span>}
      </div>
      <div ref={ref} className="map" />
      <div className="note blue">지도 배경은 인터넷 필요(설치 후 본 곳은 캐시됨). 오프라인이면 핀 탭 → 상세 → 🧭길찾기(구글맵 앱). GPS는 데이터 없이 작동.</div>
    </div>
  )
}

/* ---------- Plan ---------- */
function Plan({ itin, removeFromDay, setDetail }) {
  const byId = useMemo(() => Object.fromEntries(ALL.map(x => [x.id, x])), [])
  return (
    <div>
      <div className="secT">📅 4박 추천 일정 (6.27–7.1)</div>
      <div className="note pink">커플 맞춤+장마 대비. 상세에서 "이 날에 담기"로 내 일정 추가 가능!</div>
      {PLAN.map((day, i) => {
        const saved = (itin[i] || []).map(id => byId[id]).filter(Boolean)
        return (
          <div key={i} className="dayCard">
            <div className="dayH">{day.d}</div>
            <div className="dayT">{day.t}</div>
            <ul className="dayList">{day.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
            {saved.length > 0 && <div className="savedBox">
              <div className="savedH">⭐ 내가 담은 곳</div>
              {saved.map(s => <div key={s.id} className="savedItem"><span onClick={() => setDetail(s)}>{s.n}</span><button onClick={() => removeFromDay(i, s.id)}>✕</button></div>)}
            </div>}
          </div>
        )
      })}
      <div className="note blue">💡 비 예보 보고 Day2·Day3 바꾸면 야외(USJ/나라)를 맑은 날에!</div>
    </div>
  )
}

/* ---------- Favorites ---------- */
function Favs({ favs, isFav, toggleFav, pos, setDetail }) {
  const items = ALL.filter(x => favs.includes(x.id))
  return (
    <div>
      <div className="secT">♥ 즐겨찾기 {items.length > 0 && `(${items.length})`}</div>
      {items.length === 0 ? <div className="empty">아직 없어요. 장소의 ♡를 눌러 담아보세요!</div> :
        <div className="list">{items.map(it => <Card key={it.id} {...{ it, pos, isFav, toggleFav }} onOpen={() => setDetail(it)} />)}</div>}
    </div>
  )
}

/* ---------- Info ---------- */
function Info() {
  const [open, setOpen] = useState('coupon')
  return (
    <div>
      <div className="secT">ℹ️ 정보</div>
      {INFO.map(s =>
        <div key={s.key} className="acc">
          <button className="accH" onClick={() => setOpen(open === s.key ? '' : s.key)}>{s.icon} {s.title}<span>{open === s.key ? '▾' : '▸'}</span></button>
          {open === s.key && <div className="accB" dangerouslySetInnerHTML={{ __html: s.html }} />}
        </div>
      )}
      <div className="acc">
        <button className="accH" onClick={() => setOpen(open === 'jp' ? '' : 'jp')}>🗣️ 일본어 회화<span>{open === 'jp' ? '▾' : '▸'}</span></button>
        {open === 'jp' && <div className="accB"><table className="jp">{PHRASES.map((p, i) => <tr key={i}><td>{p[0]}</td><td>{p[1]}<br /><b>{p[2]}</b></td></tr>)}</table></div>}
      </div>
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <button className="lockBtn" onClick={() => { localStorage.removeItem('og_auth'); location.reload() }}>🔒 잠그기(로그아웃)</button>
      </div>
      <div className="foot">정보는 2026.6 기준 · 영업시간·요금·이벤트는 현지 재확인</div>
    </div>
  )
}

/* ---------- Detail modal ---------- */
function Detail({ item, pos, isFav, toggleFav, addToDay, onClose }) {
  const g = GROUPS[item.g] || { emoji: '📍', label: item.gl, color: '#888' }
  const sp = specialDetail(item.n)
  const dist = (pos && item.lat) ? hav(pos.lat, pos.lng, item.lat, item.lng) : null
  return (
    <div className="modal">
      <div className="modalHead">
        <button className="back" onClick={onClose}>← 뒤로</button>
        <span className="muted">{g.emoji} {g.label} · {item.a}</span>
      </div>
      <div className="modalBody">
        <div className="dHero" style={{ background: grad(g.color) }}>{g.emoji}</div>
        <div className="modalIn">
        <div className="dTitle">{item.n}</div>
        <div className="ctags">
          <span className="pill area">{item.a}</span>
          <span className="pill cat">{item.tag || g.label}</span>
          {item.rain && <span className="pill rain">☔ 실내</span>}
          {dist != null && <span className="pill dist">{fmtD(dist)}</span>}
        </div>
        {item.note && <p className="dNote">{item.note}</p>}
        {sp && <div className="note" dangerouslySetInnerHTML={{ __html: sp }} />}
        <div className="dBtns">
          <button className={'db' + (isFav(item.id) ? ' fav' : '')} onClick={() => toggleFav(item.id)}>{isFav(item.id) ? '♥ 저장됨' : '♡ 즐겨찾기'}</button>
          <button className="db ig" onClick={() => openUrl(igUrl(item.n, item.ig))}>📷 인스타</button>
          <button className="db go" onClick={() => openUrl(dirUrl(item.n, item.lat, item.lng, pos))}>🧭 길찾기</button>
          <button className="db see" onClick={() => openUrl(seeUrl(item.n, item.lat, item.lng))}>🔍 지도</button>
        </div>
        <div className="addDay">
          <div className="addH">📅 일정에 담기</div>
          <div className="addRow">{PLAN.map((d, i) => <button key={i} onClick={() => { addToDay(i, item.id); alert(d.d + '에 담았어요!') }}>{d.d.replace(/·.*/, '').replace(/[^0-9A-Za-z가-힣/ ]/g, '').trim() || ('Day' + i)}</button>)}</div>
        </div>
        <div className="muted small">📷 실제 인스타 피드 / 🧭 현재위치→여기 길찾기(구글맵 앱)</div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Login (passcode) ---------- */
function Login({ onOk }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    if (v.trim() === PASS) onOk()
    else { setErr(true); setV('') }
  }
  return (
    <div className="login">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginEmoji">🐙</div>
        <div className="loginT">오사카 커플 가이드</div>
        <div className="loginS">우리만의 비밀번호를 입력하세요 🔒</div>
        <input
          autoFocus type="password" inputMode="numeric"
          value={v} onChange={e => { setV(e.target.value); setErr(false) }}
          placeholder="비밀번호" className="loginInput"
        />
        {err && <div className="loginErr">비밀번호가 틀렸어요 😢</div>}
        <button className="loginBtn" type="submit">들어가기</button>
      </form>
    </div>
  )
}
