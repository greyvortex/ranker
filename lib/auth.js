export function checkPasscode(request) {
  const required = process.env.WATCHLOG_PASSCODE;
  if (!required) return true;
  const provided = request.headers.get('x-watchlog-passcode');
  return provided === required;
}
