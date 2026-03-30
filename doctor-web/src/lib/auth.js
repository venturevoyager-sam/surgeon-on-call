/**
 * AUTH HELPERS — Doctor Web
 * Surgeon auth uses localStorage (matches surgeon mobile app pattern).
 * surgeon_id + surgeon_name stored on login, cleared on logout.
 */

export const getSurgeonId   = () => localStorage.getItem('surgeon_id');
export const getSurgeonName = () => localStorage.getItem('surgeon_name');

export const loginSurgeon = (id, name) => {
  localStorage.setItem('surgeon_id', id);
  localStorage.setItem('surgeon_name', name);
};

export const logoutSurgeon = () => {
  localStorage.removeItem('surgeon_id');
  localStorage.removeItem('surgeon_name');
};

export const isLoggedIn = () => !!getSurgeonId();
