const CACHE_VERSION = "v5";
const CACHE_PREFIX = "tiku";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);

const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
  "worker",
]);

function isApplicationDataRequest(request, url) {
  return (
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.searchParams.has("_rsc") ||
    request.headers.has("rsc") ||
    request.headers.has("next-router-state-tree")
  );
}

function isCacheable(response) {
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(SHELL_CACHE), caches.open(STATIC_CACHE)]).then(async ([shellCache, staticCache]) => {
      try {
        const response = await fetch(new Request("/", { cache: "reload" }));
        if (isCacheable(response)) {
          await shellCache.put("/", response.clone());

          const html = await response.text();
          const assetUrls = new Set(
            [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
              .map((match) => new URL(match[1], self.location.origin))
              .filter((url) => url.origin === self.location.origin)
              .map((url) => `${url.pathname}${url.search}`),
          );

          await Promise.all(
            [...assetUrls].map(async (url) => {
              try {
                const assetResponse = await fetch(new Request(url, { cache: "reload" }));
                if (isCacheable(assetResponse)) {
                  await staticCache.put(url, assetResponse);
                }
              } catch {
                // Other assets can still make the shell useful if one request fails.
              }
            }),
          );
        }
      } catch {
        // A transient install-time network failure should not break registration.
      }
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith(`${CACHE_PREFIX}-`) && !CURRENT_CACHES.has(name),
          )
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApplicationDataRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirstStatic(request));
  }
});
