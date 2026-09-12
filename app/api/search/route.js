import { NextResponse } from 'next/server';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'Anime';

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    if (type === 'Anime' || type === 'Anime Movie') {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) {
        return NextResponse.json({ error: 'Anime search failed. Try again.' }, { status: 502 });
      }
      const data = await res.json();
      const results = (data.data || []).map((item) => ({
        externalSource: 'jikan',
        externalId: String(item.mal_id),
        title: item.title,
        year: item.year || null,
        posterUrl: item.images && item.images.jpg ? item.images.jpg.image_url : null,
        totalEpisodes: item.episodes || null,
      }));
      return NextResponse.json(results);
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB_API_KEY is not set on the server.' }, { status: 500 });
    }

    const endpoint = type === 'Series' ? 'tv' : 'movie';
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(q)}`
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Movie/series search failed. Try again.' }, { status: 502 });
    }
    const data = await res.json();
    const results = (data.results || []).slice(0, 6).map((item) => ({
      externalSource: 'tmdb',
      externalId: String(item.id),
      title: item.title || item.name || '',
      year: (item.release_date || item.first_air_date || '').slice(0, 4) || null,
      posterUrl: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
      totalEpisodes: null,
    }));
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: 'Search failed. Try again.' }, { status: 502 });
  }
}
