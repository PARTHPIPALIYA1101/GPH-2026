export const success = (res, data, message = undefined, status = 200) =>
  res.status(status).json({ success: true, data, ...(message ? { message } : {}) });

export const failure = (res, code, message, status = 500) =>
  res.status(status).json({ success: false, error: { code, message } });
