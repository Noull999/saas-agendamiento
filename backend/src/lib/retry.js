/**
 * Retries `fn` up to `maxAttempts` times with exponential backoff.
 * @param {Function} fn - async function to retry
 * @param {number} maxAttempts - max number of attempts (default: 3)
 * @param {number} baseDelayMs - base delay in ms, doubles each attempt (default: 1000)
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(`[retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, err.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

module.exports = { withRetry };
