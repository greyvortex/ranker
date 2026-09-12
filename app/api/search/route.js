import { NextResponse } from 'next/server';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';

function buildTvMazeResults(data, fallbackType = 'Series') {
  return (data || []).slice(0, 6).map((item) => {
    const show = item.show || item;
    const title = show.name || item.name || 'Untitled title';
    const year = show.premiered ? show.premiered.slice(0, 4) : show.startDate || null;
    const posterUrl = show.image?.original || show.image?.medium || null;
    const totalEpisodes = show.episodes || null;

    return {
      externalSource: 'tvmaze',
      externalId: String(show.id || item.id),
      title,
      year,
      posterUrl,
      totalEpisodes: fallbackType === 'Movie' ? null : totalEpisodes,
    };
  });
}

const animeProviders = [
  {
    name: 'jikan',
    ping: async () => {
      const res = await fetch('https://api.jikan.moe/v4/anime?q=bleach&limit=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Jikan ping failed: ${res.status}`);
      return true;
    },
    search: async (q) => {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=6`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Jikan search failed: ${res.status}`);
      const data = await res.json();
      return (data.data || []).map((item) => ({
        externalSource: 'jikan',
        externalId: String(item.mal_id),
        title: item.title || item.name || 'Untitled anime',
        year: item.year || null,
        posterUrl: item.images && item.images.jpg ? item.images.jpg.image_url : null,
        totalEpisodes: item.episodes || null,
      }));
    },
  },
  {
    name: 'anilist',
    ping: async () => {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `query { Page(perPage: 1) { media(type: ANIME, search: "Bleach") { id } } }`,
        }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`AniList ping failed: ${res.status}`);
      const payload = await res.json();
      if (!payload?.data?.Page?.media) throw new Error('AniList ping returned no media');
      return true;
    },
    search: async (q) => {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `query ($search: String) {
            Page(perPage: 6) {
              media(type: ANIME, search: $search) {
                id
                title { romaji english native }
                episodes
                seasonYear
                startDate { year }
                coverImage { extraLarge large medium }
              }
            }
          }`,
          variables: { search: q },
        }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`AniList search failed: ${res.status}`);
      const payload = await res.json();
      const media = payload?.data?.Page?.media || [];
      return media.map((item) => ({
        externalSource: 'anilist',
        externalId: String(item.id),
        title: item.title?.english || item.title?.romaji || item.title?.native || 'Untitled anime',
        year: item.seasonYear || item.startDate?.year || null,
        posterUrl: item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium || null,
        totalEpisodes: item.episodes || null,
      }));
    },
  },
  {
    name: 'kitsu',
    ping: async () => {
      const res = await fetch('https://kitsu.io/api/edge/anime?filter[text]=bleach&page[limit]=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Kitsu ping failed: ${res.status}`);
      return true;
    },
    search: async (q) => {
      const res = await fetch(
        `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=6`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`Kitsu search failed: ${res.status}`);
      const data = await res.json();
      return (data.data || []).map((item) => ({
        externalSource: 'kitsu',
        externalId: String(item.id),
        title:
          item.attributes?.titles?.en ||
          item.attributes?.titles?.en_jp ||
          item.attributes?.canonicalTitle ||
          item.attributes?.slug ||
          'Untitled anime',
        year: item.attributes?.startDate ? item.attributes.startDate.slice(0, 4) : null,
        posterUrl:
          item.attributes?.posterImage?.large ||
          item.attributes?.posterImage?.medium ||
          item.attributes?.posterImage?.small ||
          null,
        totalEpisodes: item.attributes?.episodeCount || null,
      }));
    },
  },
];

let animeProviderCache = { provider: null, expiresAt: 0 };

async function getActiveAnimeProvider(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && animeProviderCache.provider && animeProviderCache.expiresAt > now) {
    return animeProviderCache.provider;
  }

  for (const provider of animeProviders) {
    try {
      await provider.ping();
      animeProviderCache = { provider, expiresAt: now + 10 * 60 * 1000 };
      return provider;
    } catch (err) {
      // Try the next provider until one responds.
    }
  }

  return null;
}

async function searchAnimeWithFallback(q, preferredProviderName = null) {
  const preferred = preferredProviderName
    ? animeProviders.find((provider) => provider.name === preferredProviderName)
    : null;

  const fallbackTarget = preferred ? await getActiveAnimeProvider(true) : await getActiveAnimeProvider();
  const orderedProviders = preferred
    ? [preferred, ...animeProviders.filter((provider) => provider.name !== preferred.name)]
    : fallbackTarget
      ? [fallbackTarget, ...animeProviders.filter((provider) => provider.name !== fallbackTarget.name)]
      : animeProviders;

  let lastError = null;
  for (const provider of orderedProviders) {
    try {
      const results = await provider.search(q);
      if (results && results.length > 0) {
        animeProviderCache = { provider, expiresAt: Date.now() + 10 * 60 * 1000 };
        return { results, provider: provider.name };
      }
      if (results && results.length === 0) {
        return { results: [], provider: provider.name };
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { results: [], provider: null };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const type = searchParams.get('type') || 'Anime';
  const preferredProviderName = searchParams.get('provider');

  if (searchParams.get('probe') === '1') {
    const activeProvider = await getActiveAnimeProvider(true);
    return NextResponse.json({ ok: true, provider: activeProvider ? activeProvider.name : null });
  }

  if (!q) {
    return NextResponse.json([]);
  }

  try {
    if (type === 'Anime' || type === 'Anime Movie') {
      const { results, provider } = await searchAnimeWithFallback(q, preferredProviderName);
      return NextResponse.json({ results, provider });
    }

    const tmdbKey = process.env.TMDB_API_KEY;
    const providerRequests = [];

    if (tmdbKey) {
      providerRequests.push({
        name: 'tmdb',
        search: async () => {
          const endpoint = type === 'Series' ? 'tv' : 'movie';
          const res = await fetch(
            `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(q)}`
          );
          if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
          const data = await res.json();
          return (data.results || []).slice(0, 6).map((item) => ({
            externalSource: 'tmdb',
            externalId: String(item.id),
            title: item.title || item.name || '',
            year: (item.release_date || item.first_air_date || '').slice(0, 4) || null,
            posterUrl: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
            totalEpisodes: null,
          }));
        },
      });
    }

    providerRequests.push({
      name: 'tvmaze',
      search: async () => {
        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`TVMaze search failed: ${res.status}`);
        const data = await res.json();
        return buildTvMazeResults(data, type);
      },
    });

    for (const provider of providerRequests) {
      try {
        const results = await provider.search();
        if (results && results.length > 0) {
          return NextResponse.json({ results, provider: provider.name });
        }
        if (results && results.length === 0) {
          return NextResponse.json({ results: [], provider: provider.name });
        }
      } catch (err) {
        // Try the next free provider if the current one fails.
      }
    }

    return NextResponse.json({ error: 'Movie/series search failed. Try again.' }, { status: 502 });
  } catch (err) {
    return NextResponse.json({ error: 'Search failed. Try again.' }, { status: 502 });
  }
}
