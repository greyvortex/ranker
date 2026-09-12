'use client';

import { useEffect, useRef, useState } from 'react';

const TYPES = ['Anime', 'Anime Movie', 'Movie', 'Series'];

export default function Page() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [query, setQuery] = useState('');
  const [type, setType] = useState('Anime');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addError, setAddError] = useState('');

  const [passcode, setPasscode] = useState('');
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockInput, setUnlockInput] = useState('');

  const [brokenImages, setBrokenImages] = useState(new Set());

  const debounceRef = useRef(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('watchlog_passcode');
    if (stored) setPasscode(stored);

    fetch('/api/entries')
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearchError('');
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=${encodeURIComponent(type)}`);
        const data = await res.json();
        if (!res.ok) {
          setSearchError(data.error || 'Search failed.');
          setResults([]);
        } else {
          setSearchError('');
          setResults(data);
        }
      } catch (err) {
        setSearchError('Search failed. Check your connection.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(debounceRef.current);
  }, [query, type]);

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (passcode) headers['x-watchlog-passcode'] = passcode;
    return headers;
  }

  function submitUnlock(e) {
    e.preventDefault();
    const val = unlockInput.trim();
    window.localStorage.setItem('watchlog_passcode', val);
    setPasscode(val);
    setUnlockInput('');
    setUnlockOpen(false);
    setAddError('');
  }

  async function pickResult(result) {
    setAddError('');
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: result.title,
        type,
        posterUrl: result.posterUrl,
        externalSource: result.externalSource,
        externalId: result.externalId,
        totalEpisodes: result.totalEpisodes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        setAddError('Wrong or missing passcode. Unlock editing above.');
        setUnlockOpen(true);
      } else {
        setAddError(data.error || 'Could not add that title.');
      }
      return;
    }
    setEntries([data, ...entries]);
    setQuery('');
    setResults([]);
  }

  async function updateEntry(id, patch) {
    const prev = entries;
    setEntries(entries.map((en) => (en.id === id ? { ...en, ...patch } : en)));
    const res = await fetch(`/api/entries/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setEntries(prev);
      if (res.status === 401) {
        setAddError('Wrong or missing passcode. Unlock editing above.');
        setUnlockOpen(true);
      }
    }
  }

  async function removeEntry(id) {
    const prev = entries;
    setEntries(entries.filter((en) => en.id !== id));
    const res = await fetch(`/api/entries/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      setEntries(prev);
      if (res.status === 401) {
        setAddError('Wrong or missing passcode. Unlock editing above.');
        setUnlockOpen(true);
      }
    }
  }

  function bumpEpisode(entry, delta) {
    const episode = Math.max(0, (entry.episode || 0) + delta);
    const patch = { episode };
    if (episode > 0 && entry.status === 'want') patch.status = 'watching';
    updateEntry(entry.id, patch);
  }

  function markImageBroken(id) {
    setBrokenImages((prev) => new Set(prev).add(id));
  }

  function renderCard(entry, small) {
    const hasEpisodes = entry.type === 'Anime' || entry.type === 'Series';
    const showPoster = entry.poster_url && !brokenImages.has(entry.id);

    return (
      <div className={`card status-${entry.status}`} key={entry.id}>
        {showPoster ? (
          <img
            className="poster"
            src={entry.poster_url}
            alt={entry.title}
            onError={() => markImageBroken(entry.id)}
          />
        ) : (
          <div className="poster-fallback">{entry.title}</div>
        )}
        <div className="card-body">
          <p className="card-title">{entry.title}</p>
          <p className="card-type">
            {entry.type}
            {hasEpisodes && entry.total_episodes ? ` · ${entry.total_episodes} ep` : ''}
          </p>
          {hasEpisodes && (
            <div className="progress">
              <button aria-label="Decrease episode count" onClick={() => bumpEpisode(entry, -1)}>
                -
              </button>
              <span className="ep">ep {entry.episode || 0}</span>
              <button aria-label="Increase episode count" onClick={() => bumpEpisode(entry, 1)}>
                +
              </button>
            </div>
          )}
          {!small && (
            <div className="card-controls">
              <select
                className="status-select"
                value={entry.status}
                onChange={(e) => updateEntry(entry.id, { status: e.target.value })}
              >
                <option value="want">Want to watch</option>
                <option value="watching">Watching</option>
                <option value="completed">Completed</option>
              </select>
              <button className="del" onClick={() => removeEntry(entry.id)}>
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const watching = entries.filter((e) => e.status === 'watching');
  const shown = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  return (
    <div className="wrap">
      <header>
        <div className="top">
          <div>
            <h1>Watchlog</h1>
            <p className="sub">Synced across your devices — never lose your place again.</p>
          </div>
          <div className="unlock">
            {passcode || unlockOpen ? (
              unlockOpen ? (
                <form className="unlock-form" onSubmit={submitUnlock}>
                  <input
                    type="password"
                    placeholder="Passcode"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value)}
                  />
                  <button type="submit">Save</button>
                </form>
              ) : (
                <span>Editing unlocked</span>
              )
            ) : (
              <button onClick={() => setUnlockOpen(true)}>Unlock editing</button>
            )}
          </div>
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="num">{entries.length}</div>
          <div className="lbl">total titles</div>
        </div>
        <div className="stat">
          <div className="num">{entries.filter((e) => e.status === 'completed').length}</div>
          <div className="lbl">completed</div>
        </div>
        <div className="stat">
          <div className="num">{watching.length}</div>
          <div className="lbl">in progress</div>
        </div>
      </div>

      <div className="search">
        <div className="search-row">
          <input
            type="text"
            placeholder="Search a title to add, e.g. Frieren, Game of Thrones"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {searching && <p className="msg">Searching.</p>}
        {searchError && <p className="msg error">{searchError}</p>}
        {addError && <p className="msg error">{addError}</p>}

        {results.length > 0 && (
          <div className="results">
            {results.map((r) => (
              <button className="result" key={`${r.externalSource}-${r.externalId}`} onClick={() => pickResult(r)}>
                {r.posterUrl ? <img src={r.posterUrl} alt={r.title} /> : <div className="ph" />}
                <span>
                  <span className="rt">{r.title}</span>
                  <br />
                  <span className="ry">{r.year || 'year unknown'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {watching.length > 0 && (
        <>
          <p className="section-title">Continue watching</p>
          <div className="strip">{watching.map((e) => renderCard(e, true))}</div>
        </>
      )}

      <div className="filters">
        {[
          ['all', 'All'],
          ['want', 'Want to watch'],
          ['watching', 'Watching'],
          ['completed', 'Completed'],
        ].map(([key, label]) => (
          <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Loading your watchlog.</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          {entries.length === 0 ? 'Nothing logged yet. Search a title above to add it.' : 'Nothing matches this filter.'}
        </div>
      ) : (
        <div className="grid">{shown.map((e) => renderCard(e, false))}</div>
      )}
    </div>
  );
}
