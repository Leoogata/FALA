export interface EscolaSession { id: string; nome: string; codigo: string }
export function schoolToken() { return sessionStorage.getItem('fala-school-token') ?? ''; }
export function currentSchool(): EscolaSession | null {
  try { return JSON.parse(sessionStorage.getItem('fala-school') ?? 'null'); } catch { return null; }
}
export function saveSchool(token: string, escola: EscolaSession) {
  sessionStorage.setItem('fala-school-token', token);
  sessionStorage.setItem('fala-school', JSON.stringify(escola));
  window.dispatchEvent(new Event('school-session'));
}
export function clearSchool() {
  sessionStorage.removeItem('fala-school-token');
  sessionStorage.removeItem('fala-school');
  window.dispatchEvent(new Event('school-session'));
}
