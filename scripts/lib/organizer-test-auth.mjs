import assert from 'node:assert/strict';

// Use an admin-generated test session so verification never replaces a demo user's password.
export async function authenticateTestOrganizer({
  apiUrl, anonKey, serviceRoleKey, email, fetch: request = globalThis.fetch,
}) {
  async function post(endpoint, body, headers) {
    const response = await request(`${apiUrl}/auth/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    assert.ok(response.ok, `Organizer test auth ${endpoint.split('/').at(-1)} failed (${response.status}).`);
    return response.json();
  }

  const link = await post('admin/generate_link', { type: 'magiclink', email }, {
    apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
  });
  assert.ok(link.hashed_token, 'Missing organizer test auth token hash.');
  const session = await post('verify', { type: 'magiclink', token_hash: link.hashed_token }, {
    apikey: anonKey,
  });
  assert.ok(session.access_token && session.user?.id, 'Missing organizer test session.');
  return { accessToken: session.access_token, email, userId: session.user.id };
}
