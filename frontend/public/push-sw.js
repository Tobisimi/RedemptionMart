self.addEventListener("push", (event) => {
  let payload = { title: "RedemptionMart", body: "You have a new notification.", url: "/" };
  try {
    if (event.data) {
      payload = { ...payload, ...JSON.parse(event.data.text()) };
    }
  } catch {
    /* use defaults */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
