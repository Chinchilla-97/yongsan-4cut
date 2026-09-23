// 네컷 부스 서비스 워커: 앱 설치와 인터넷이 불안정할 때의 실행을 지원
const CACHE = "booth-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !isFont) return;

  // 화면과 프레임 목록은 항상 최신을 먼저 받고, 인터넷이 끊기면 저장본 사용
  const networkFirst = req.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/frames.json");
  if (networkFirst) {
    e.respondWith(
      fetch(req).then(res => saveCopy(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }
  // 프레임 이미지·아이콘·글꼴은 저장본을 먼저 사용
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => saveCopy(req, res))));
});
