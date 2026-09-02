export function hasAnyRole(user, roles) {
  if (!user) return false;
  const userRoles = Array.isArray(user.roles)
    ? user.roles
    : (typeof user.roles === 'string' ? user.roles.replace(/^\{|\}$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean) : []);
  return userRoles.some((role) => roles.includes(role));
}

export function isStateAdmin(user) {
  return hasAnyRole(user, ['STATE_ADMIN']);
}

export function canAccessCity(user, cityName) {
  if (isStateAdmin(user)) return true;
  const userCities = Array.isArray(user.cities)
    ? user.cities
    : (typeof user.cities === 'string' ? user.cities.replace(/^\{|\}$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean) : []);
  return userCities.includes(cityName);
}

export function canManageDepartment(user, departmentId) {
  return isStateAdmin(user) || (hasAnyRole(user, ['DEPARTMENT_HEAD']) && user.departmentId === departmentId);
}

export function evaluateResourceAccess({ user, requiredRoles = [], departmentId, cityName, directGrant = false, resourceOwnerDepartmentId }) {
  if (isStateAdmin(user)) return { allowed: true, reason: 'STATE_ADMIN' };
  if (requiredRoles.length && !hasAnyRole(user, requiredRoles)) return { allowed: false, reason: 'ROLE_DENIED' };
  if (cityName && !canAccessCity(user, cityName)) return { allowed: false, reason: 'CITY_DENIED' };
  const inDepartment = !departmentId || user.departmentId === departmentId;
  const shared = directGrant === true && resourceOwnerDepartmentId !== user.departmentId;
  if (!inDepartment && !shared) return { allowed: false, reason: 'RESOURCE_DENIED' };
  return { allowed: true, reason: inDepartment ? 'DEPARTMENT_SCOPE' : 'SHARED_RESOURCE' };
}
