self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Game request', body: 'You have a new game request.' }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: data.data }))
})
