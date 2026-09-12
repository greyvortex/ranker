import { sql } from '../../../../lib/db';
import { checkPasscode } from '../../../../lib/auth';
import { NextResponse } from 'next/server';

export async function PATCH(request, { params }) {
  if (!checkPasscode(request)) {
    return NextResponse.json({ error: 'Wrong passcode.' }, { status: 401 });
  }

  const { id } = params;
  const body = await request.json();
  const { status, episode } = body;

  const rows = await sql`
    update entries
    set status = coalesce(${status ?? null}, status),
        episode = coalesce(${episode ?? null}, episode),
        updated_at = now()
    where id = ${id}
    returning *
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(request, { params }) {
  if (!checkPasscode(request)) {
    return NextResponse.json({ error: 'Wrong passcode.' }, { status: 401 });
  }

  const { id } = params;
  await sql`delete from entries where id = ${id}`;
  return NextResponse.json({ ok: true });
}
