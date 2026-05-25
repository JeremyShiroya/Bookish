export const getThemeCssVar = (name, fallback = "") => {
  if (!import.meta.client) return fallback;

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

export const getThemeCssVars = (tokens) => (
  tokens.map(({ name, fallback }) => getThemeCssVar(name, fallback))
);
