// HTTP request debugger for intercepting PostgREST calls
const originalFetch = globalThis.fetch;

let debuggingEnabled = false;

export function enableHttpDebugging() {
  if (debuggingEnabled) return;
  
  debuggingEnabled = true;

  // Intercept all fetch requests
  globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    
    // Log Supabase/PostgREST requests
    if (url.includes('127.0.0.1:54321') || url.includes('localhost:54321')) {
      console.log(`[HTTP Debug] ${method} ${url}`);
      
      if (init?.headers) {
        console.log('[HTTP Debug] Headers:', init.headers);
      }
      
      if (init?.body) {
        console.log('[HTTP Debug] Body:', init.body);
      }
    }

    try {
      const response = await originalFetch(input, init);
      
      // Log Supabase responses
      if (url.includes('127.0.0.1:54321') || url.includes('localhost:54321')) {
        console.log(`[HTTP Debug] Response ${response.status} ${response.statusText} for ${method} ${url}`);
        
        // Clone response to read body without consuming the original
        const responseClone = response.clone();
        
        // Try to read response body
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const responseBody = await responseClone.json();
            console.log('[HTTP Debug] Response body:', responseBody);
            
            // Special handling for PGRST errors
            if (responseBody.code && responseBody.code.startsWith('PGRST')) {
              console.error(`[HTTP Debug] PostgREST Error Detected!`);
              console.error(`[HTTP Debug] Error Code: ${responseBody.code}`);
              console.error(`[HTTP Debug] Error Message: ${responseBody.message}`);
              console.error(`[HTTP Debug] Error Details: ${responseBody.details}`);
              console.error(`[HTTP Debug] Error Hint: ${responseBody.hint}`);
              console.error(`[HTTP Debug] Request URL: ${url}`);
              console.error(`[HTTP Debug] Request Method: ${method}`);
            }
          } else {
            const responseText = await responseClone.text();
            console.log('[HTTP Debug] Response text:', responseText.substring(0, 500));
          }
        } catch (bodyError) {
          console.log('[HTTP Debug] Could not read response body:', bodyError);
        }
      }
      
      return response;
    } catch (fetchError) {
      if (url.includes('127.0.0.1:54321') || url.includes('localhost:54321')) {
        console.error(`[HTTP Debug] Fetch error for ${method} ${url}:`, fetchError);
        
        // Check if it's a fetch failed error (like the one we're seeing)
        if (fetchError instanceof Error && fetchError.message.includes('fetch failed')) {
          console.error('[HTTP Debug] This looks like the "fetch failed" error from NextAuth!');
          console.error('[HTTP Debug] Stack trace:', fetchError.stack);
        }
      }
      throw fetchError;
    }
  };
}

export function disableHttpDebugging() {
  if (!debuggingEnabled) return;
  
  console.log('[HTTP Debugger] Disabling HTTP request interception');
  globalThis.fetch = originalFetch;
  debuggingEnabled = false;
}
