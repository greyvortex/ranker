import { sql } from '../../../lib/db';
import { checkPasscode } from '../../../lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const rows = await sql`select * from entries order by updated_at desc`;
  return NextResponse.json(rows);
}

export async function POST(request) {
  if (!checkPasscode(request)) {
    return NextResponse.json({ error: 'Wrong passcode.' }, { status: 401 });
  }

  const body = await request.json();
  const { title, type, posterUrl, externalSource, externalId, totalEpisodes } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: 'Type is required.' }, { status: 400 });
  }

  const id =
    (externalSource && externalId ? `${externalSource}-${externalId}` : 'e' + Date.now()) +
    '-' +
    Math.floor(Math.random() * 1000);

  const rows = await sql`
    insert into entries (id, title, type, poster_url, external_source, external_id, status, episode, total_episodes)
    values (
      ${id},
      ${title.trim()},
      ${type},
      ${posterUrl || null},
      ${externalSource || null},
      ${externalId || null},
      'want',
      0,
      ${totalEpisodes || null}
    )
    returning *
  `;

  return NextResponse.json(rows[0]);
}
